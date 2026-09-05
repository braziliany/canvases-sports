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
import { evaluateGitSyncGate } from "../src/core/git-sync-gate.js";
import { prepareProductionResultSync } from "../src/core/production-result-sync.js";
import { RECONCILIATION_STATUS, reconcileResultObservations } from "../src/core/result-reconciliation.js";
import { SourceFetchError, fetchSourceSnapshot } from "../src/core/source-fetch.js";

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-22.json", import.meta.url), "utf8"));
const rankingReference = JSON.parse(await readFile(new URL(
  "../data/sources/results/2026-08-29-w19-official-standings-reference.json", import.meta.url
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
  const data = structuredClone(fixtures);
  data.updatedAt = "2026-08-29T13:33:14.115Z";
  data.effectiveStatusAt = "2026-08-29T13:33:14.115Z";
  for (const fixture of data.fixtures) {
    Object.assign(fixture, {
      status: "scheduled",
      effectiveStatus: "live",
      homeScore: null,
      awayScore: null
    });
  }
  return data;
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

test("git publication gate requires changes, validation, and tests", () => {
  assert.equal(evaluateGitSyncGate({ hasChanges: false, validationPassed: true, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: false, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: false }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: true }).commitEligible, true);
});
