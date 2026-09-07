import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseYangtzeEveningNewsResults } from "../src/adapters/results/yangtze-evening-news.js";
import { parseXinhuaDailyHuaweiResults } from "../src/adapters/results/xinhua-daily-huawei.js";
import {
  parseChangzhouSportsBureauResult,
  parseHuaianPoliceResult,
  parseYangzhouReleaseResult
} from "../src/adapters/results/official-local-government.js";
import {
  parseNanjingMorningPostWeek20Results,
  parseXinhuaDailyWechatWeek20Results
} from "../src/adapters/results/week20-final-reports.js";
import { evaluateGitSyncGate } from "../src/core/git-sync-gate.js";
import { prepareProductionResultSync } from "../src/core/production-result-sync.js";
import { RECONCILIATION_STATUS, reconcileResultObservations } from "../src/core/result-reconciliation.js";
import { SourceFetchError, fetchSourceSnapshot } from "../src/core/source-fetch.js";
import {
  createUnsettledRoundFixtures,
  createUnsettledWeek19Fixtures
} from "./helpers/result-fixtures.js";

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-22.json", import.meta.url), "utf8"));
const rankingReference = JSON.parse(await readFile(new URL(
  "../data/sources/results/2026-08-29-w19-official-standings-reference.json", import.meta.url
), "utf8"));
const week20RankingReference = JSON.parse(await readFile(new URL(
  "../data/sources/results/2026-09-05-w20-official-standings-reference.json", import.meta.url
), "utf8"));
const yangtzeSnapshot = JSON.parse(await readFile(new URL(
  "../data/sources/results/2026-08-29-w19-yangzi-evening-news.json", import.meta.url
), "utf8"));
const officialSnapshots = await Promise.all([
  ["../data/sources/results/2026-08-29-w19-changzhou-sports-bureau.json", parseChangzhouSportsBureauResult],
  ["../data/sources/results/2026-08-29-w19-huaian-police.json", parseHuaianPoliceResult],
  ["../data/sources/results/2026-08-29-w19-yangzhou-release.json", parseYangzhouReleaseResult]
].map(async ([path, parser]) => ({ snapshot: JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")), parser })));

function unsettledFixtures() {
  return createUnsettledWeek19Fixtures(fixtures);
}

function candidateData(candidates = []) {
  return { schemaVersion: 1, league: { id: fixtures.league.id, season: 2026 }, updatedAt: "2026-08-30T00:00:00+08:00", candidates };
}

function observation(overrides = {}) {
  return {
    leagueId: fixtures.league.id, season: 2026, round: 19, matchDate: "2026-08-29",
    homeTeam: "常州", awayTeam: "无锡", homeScore: 1, awayScore: 5,
    source: "来源 A", sourceType: "trusted-media", sourceUrl: "https://a.test.invalid/result",
    observedAt: "2026-08-30T00:00:00Z", ...overrides
  };
}

test("fetch layer creates stable snapshots without parsing match business", async () => {
  const config = { adapter: "test", name: "测试来源", type: "trusted-media", url: "https://source.test.invalid/article", title: "战报", context: { season: 2026 }, requiredMarkers: ["战报"] };
  const fetchImpl = async () => new Response("<html><p>战报</p><p>常州队1:5无锡队</p></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  const first = await fetchSourceSnapshot(config, { fetchImpl, now: new Date("2026-09-01T00:00:00Z") });
  const second = await fetchSourceSnapshot(config, { fetchImpl, previousSnapshot: first, now: new Date("2026-09-02T00:00:00Z") });
  assert.match(first.rawText, /常州队1:5无锡队/);
  assert.equal(second.source.retrievedAt, first.source.retrievedAt);
  assert.equal(second.contentHash, first.contentHash);
});

test("fetch layer can exclude dynamic related-content paragraphs from a stable snapshot", async () => {
  const config = {
    adapter: "test", name: "测试来源", type: "trusted-media", url: "https://source.test.invalid/article",
    title: "战报", context: { season: 2026 }, requiredMarkers: ["终场"], contentLineMarkers: ["终场", "比分"]
  };
  const response = (extra) => async () => new Response(`<p>终场 比分 1:0</p><p>${extra}</p>`, {
    status: 200, headers: { "content-type": "text/html" }
  });
  const first = await fetchSourceSnapshot(config, { fetchImpl: response("动态推荐 A"), now: new Date("2026-09-01T00:00:00Z") });
  const second = await fetchSourceSnapshot(config, { fetchImpl: response("动态推荐 B"), previousSnapshot: first, now: new Date("2026-09-02T00:00:00Z") });
  assert.equal(first.rawText, "终场 比分 1:0");
  assert.equal(second.contentHash, first.contentHash);
  assert.equal(second.source.retrievedAt, first.source.retrievedAt);
});

test("fetch layer fails closed on network, non-200, and unexpected content", async () => {
  const config = { adapter: "test", name: "测试来源", type: "trusted-media", url: "https://source.test.invalid", title: "战报", context: {}, requiredMarkers: ["战报"] };
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => { throw new Error("offline"); } }), SourceFetchError);
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => new Response("no", { status: 503, headers: { "content-type": "text/html" } }) }), /HTTP 503/);
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => new Response("<p>other</p>", { status: 200, headers: { "content-type": "text/html" } }) }), /missing marker/);
});

test("three controlled local-government snapshots parse the authoritative 8/29 scores offline", () => {
  const observations = officialSnapshots.flatMap(({ snapshot, parser }) => parser(snapshot));
  assert.deepEqual(observations.map((item) => [item.homeTeam, item.homeScore, item.awayScore, item.awayTeam]), [
    ["常州", 1, 5, "无锡"],
    ["淮安", 2, 0, "连云港"],
    ["扬州", 0, 1, "宿迁"]
  ]);
});

test("reconciliation implements official, corroboration, single-source and conflict rules", () => {
  const sourcePolicies = [
    { name: "来源 A", type: "trusted-media", url: "https://a.test.invalid/result", publisherId: "publisher-a" },
    { name: "来源 B", type: "trusted-media", url: "https://b.test.invalid/result", publisherId: "publisher-b" },
    { name: "官方来源", type: "official", url: "https://official.test.invalid/result", publisherId: "official-owner" }
  ];
  const data = unsettledFixtures();
  const twoAgree = reconcileResultObservations({ observations: [observation(), observation({ source: "来源 B", sourceUrl: "https://b.test.invalid/result" })], fixturesData: data, sourcePolicies });
  assert.equal(twoAgree.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
  const one = reconcileResultObservations({ observations: [observation()], fixturesData: data, sourcePolicies });
  assert.equal(one.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
  const official = reconcileResultObservations({ observations: [observation({ source: "官方来源", sourceType: "official", sourceUrl: "https://official.test.invalid/result" })], fixturesData: data, sourcePolicies });
  assert.equal(official.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
  const conflict = reconcileResultObservations({ observations: [observation(), observation({ source: "来源 B", sourceUrl: "https://b.test.invalid/result", homeScore: 2 })], fixturesData: data, sourcePolicies });
  assert.equal(conflict.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
  assert.match(conflict.decisions[0].reason, /conflicting/);
});

test("duplicate observations do not count as independent corroboration", () => {
  const item = observation();
  const result = reconcileResultObservations({ observations: [item, structuredClone(item)], fixturesData: unsettledFixtures(), sourcePolicies: [
    { name: "来源 A", type: "trusted-media", url: "https://a.test.invalid/result", publisherId: "publisher-a" }
  ] });
  assert.equal(result.matched.length, 1);
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
});

test("two pages from the same publisher do not count as independent evidence", () => {
  const result = reconcileResultObservations({
    observations: [observation(), observation({ source: "来源 B", sourceUrl: "https://b.test.invalid/result" })],
    fixturesData: unsettledFixtures(),
    sourcePolicies: [
      { name: "来源 A", type: "trusted-media", url: "https://a.test.invalid/result", publisherId: "same-publisher" },
      { name: "来源 B", type: "trusted-media", url: "https://b.test.invalid/result", publisherId: "same-publisher" }
    ]
  });
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
});

test("unregistered source labels cannot claim official authority", () => {
  const result = reconcileResultObservations({
    observations: [observation({ sourceType: "official" })],
    fixturesData: unsettledFixtures(),
    sourcePolicies: []
  });
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
});

test("production sync settles all corroborated 8/29 results and matches official table", async () => {
  const firstSnapshot = structuredClone(yangtzeSnapshot);
  firstSnapshot.source.retrievedAt = "2026-08-30T00:00:00Z";
  const secondSnapshot = structuredClone(firstSnapshot);
  secondSnapshot.adapter = "xinhua-daily-huawei-final-report-v1";
  secondSnapshot.source = { name: "新华日报（华为资讯官方账号）", type: "official-republish", url: "https://feeds.example.invalid/xinhua", retrievedAt: "2026-08-30T08:10:00+08:00" };
  const observations = [...parseYangtzeEveningNewsResults(firstSnapshot), ...parseXinhuaDailyHuaweiResults(secondSnapshot)];
  const sourcePolicies = [
    { name: firstSnapshot.source.name, type: firstSnapshot.source.type, url: firstSnapshot.source.url, publisherId: "publisher-a" },
    { name: secondSnapshot.source.name, type: secondSnapshot.source.type, url: secondSnapshot.source.url, publisherId: "publisher-b" }
  ];
  const first = prepareProductionResultSync({ source: baseline, rankingReference, fixturesData: unsettledFixtures(), candidatesData: candidateData(), observations, confirmedAt: "2026-09-03T00:00:00Z", sourcePolicies });
  assert.deepEqual(first.fixturesData.fixtures.map((x) => [x.status, x.homeScore, x.awayScore]), [["finished", 1, 5], ["finished", 2, 0], ["finished", 0, 1]]);
  assert.equal(first.candidatesData.candidates.length, 6);
  assert.equal(first.candidatesData.candidates.every((x) => x.reviewStatus === "confirmed"), true);
  assert.deepEqual(first.standingsData.standings.map((x) => [x.rank, x.team.name, x.points]), rankingReference.rows.map((x) => [x.rank, x.team, x.points]));

  const second = prepareProductionResultSync({ source: baseline, rankingReference, fixturesData: first.fixturesData, candidatesData: first.candidatesData, observations, confirmedAt: "2026-09-04T00:00:00Z", sourcePolicies });
  assert.equal(second.settlements.length, 0);
  assert.deepEqual(second.fixturesData, first.fixturesData);
  assert.deepEqual(second.candidatesData, first.candidatesData);
  assert.deepEqual(second.standingsData, first.standingsData);
});

test("zero scores remain valid evidence", () => {
  const sourcePolicies = [{ name: "官方来源", type: "official", url: "https://official.test.invalid/result", publisherId: "official-owner" }];
  const result = reconcileResultObservations({ observations: [observation({ homeScore: 0, awayScore: 0, source: "官方来源", sourceType: "official", sourceUrl: "https://official.test.invalid/result" })], fixturesData: unsettledFixtures(), sourcePolicies });
  assert.deepEqual(result.decisions[0].score, [0, 0]);
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
});

test("week 20 reports reconcile through the existing pipeline and match every public table field", () => {
  const xinhuaSnapshot = {
    schemaVersion: 1,
    adapter: "xinhua-daily-wechat-week20-final-report-v1",
    source: {
      name: "新华日报微信公众号（扬子晚报转载）",
      type: "official-republish",
      url: "https://www.yzwb.net/news/qjsc/202609/t20260905_389881.html",
      retrievedAt: "2026-09-05T14:23:00Z"
    },
    context: { leagueId: fixtures.league.id, season: 2026, round: 20, date: "2026-09-05" },
    rawText: "连云港队0:1南通队\n盐城队1:1徐州队\n南京队2:2泰州队"
  };
  const morningSnapshot = {
    schemaVersion: 1,
    adapter: "nanjing-morning-post-week20-final-report-v1",
    source: {
      name: "南京晨报（新浪财经转载）",
      type: "trusted-media",
      url: "https://finance.sina.com.cn/jjxw/2026-09-07/doc-iniqxiqs6133523.shtml",
      retrievedAt: "2026-09-07T00:30:00Z"
    },
    context: xinhuaSnapshot.context,
    rawText: "南京队和泰州队赛前合影。终场哨响，两队最终以2比2握手言和。\n第20周落幕，盐城队1比1战平徐州队，连云港队0比1不敌南通队。"
  };
  const observations = [
    ...parseXinhuaDailyWechatWeek20Results(xinhuaSnapshot),
    ...parseNanjingMorningPostWeek20Results(morningSnapshot)
  ];
  const sourcePolicies = [
    { ...xinhuaSnapshot.source, publisherId: "xinhua-daily-media-group" },
    { ...morningSnapshot.source, publisherId: "nanjing-daily-media-group" }
  ];
  const prepared = prepareProductionResultSync({
    source: baseline,
    rankingReference: [rankingReference, week20RankingReference],
    fixturesData: createUnsettledRoundFixtures(fixtures, 20),
    candidatesData: candidateData(),
    observations,
    confirmedAt: "2026-09-07T01:00:00Z",
    sourcePolicies
  });

  const week20 = prepared.fixturesData.fixtures.filter((item) => item.round === 20);
  assert.deepEqual(week20.map((item) => [item.homeTeam, item.homeScore, item.awayScore, item.awayTeam, item.status]), [
    ["连云港", 0, 1, "南通", "finished"],
    ["盐城", 1, 1, "徐州", "finished"],
    ["南京", 2, 2, "泰州", "finished"]
  ]);
  assert.equal(prepared.settlements.length, 6);
  assert.equal(prepared.candidatesData.candidates.every((item) => item.reviewStatus === "confirmed"), true);
  assert.deepEqual(
    prepared.standingsData.standings.map((row) => ({
      rank: row.rank,
      team: row.team.name,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points
    })),
    week20RankingReference.rows.map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst
    }))
  );
});

test("git publication gate requires changes, validation, and tests", () => {
  assert.equal(evaluateGitSyncGate({ hasChanges: false, validationPassed: true, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: false, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: false }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: true }).commitEligible, true);
});
