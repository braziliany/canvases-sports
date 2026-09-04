import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseYangtzeEveningNewsResults } from "../src/adapters/results/yangtze-evening-news.js";
import { parseXinhuaDailyHuaweiResults } from "../src/adapters/results/xinhua-daily-huawei.js";
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

test("fetch layer fails closed on network, non-200, and unexpected content", async () => {
  const config = { adapter: "test", name: "测试来源", type: "trusted-media", url: "https://source.test.invalid", title: "战报", context: {}, requiredMarkers: ["战报"] };
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => { throw new Error("offline"); } }), SourceFetchError);
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => new Response("no", { status: 503, headers: { "content-type": "text/html" } }) }), /HTTP 503/);
  await assert.rejects(fetchSourceSnapshot(config, { fetchImpl: async () => new Response("<p>other</p>", { status: 200, headers: { "content-type": "text/html" } }) }), /missing marker/);
});

test("reconciliation implements official, corroboration, single-source and conflict rules", () => {
  const twoAgree = reconcileResultObservations({ observations: [observation(), observation({ source: "来源 B", sourceUrl: "https://b.test.invalid/result" })], fixturesData: fixtures });
  assert.equal(twoAgree.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
  const one = reconcileResultObservations({ observations: [observation()], fixturesData: fixtures });
  assert.equal(one.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
  const official = reconcileResultObservations({ observations: [observation({ sourceType: "official" })], fixturesData: fixtures });
  assert.equal(official.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
  const conflict = reconcileResultObservations({ observations: [observation(), observation({ source: "来源 B", sourceUrl: "https://b.test.invalid/result", homeScore: 2 })], fixturesData: fixtures });
  assert.equal(conflict.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
  assert.match(conflict.decisions[0].reason, /conflicting/);
});

test("duplicate observations do not count as independent corroboration", () => {
  const item = observation();
  const result = reconcileResultObservations({ observations: [item, structuredClone(item)], fixturesData: fixtures });
  assert.equal(result.matched.length, 1);
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.NEEDS_REVIEW);
});

test("production sync settles all corroborated 8/29 results and matches official table", async () => {
  const secondSnapshot = structuredClone(yangtzeSnapshot);
  secondSnapshot.adapter = "xinhua-daily-huawei-final-report-v1";
  secondSnapshot.source = { name: "新华日报（华为资讯官方账号）", type: "official-republish", url: "https://feeds.example.invalid/xinhua", retrievedAt: "2026-08-30T08:10:00+08:00" };
  const observations = [...parseYangtzeEveningNewsResults(yangtzeSnapshot), ...parseXinhuaDailyHuaweiResults(secondSnapshot)];
  const first = prepareProductionResultSync({ source: baseline, rankingReference, fixturesData: fixtures, candidatesData: candidateData(), observations, confirmedAt: "2026-09-03T00:00:00Z" });
  assert.deepEqual(first.fixturesData.fixtures.map((x) => [x.status, x.homeScore, x.awayScore]), [["finished", 1, 5], ["finished", 2, 0], ["finished", 0, 1]]);
  assert.equal(first.candidatesData.candidates.length, 6);
  assert.equal(first.candidatesData.candidates.every((x) => x.reviewStatus === "confirmed"), true);
  assert.deepEqual(first.standingsData.standings.map((x) => [x.rank, x.team.name, x.points]), rankingReference.rows.map((x) => [x.rank, x.team, x.points]));

  const second = prepareProductionResultSync({ source: baseline, rankingReference, fixturesData: first.fixturesData, candidatesData: first.candidatesData, observations, confirmedAt: "2026-09-04T00:00:00Z" });
  assert.equal(second.settlements.length, 0);
  assert.deepEqual(second.fixturesData, first.fixturesData);
  assert.deepEqual(second.candidatesData, first.candidatesData);
  assert.deepEqual(second.standingsData, first.standingsData);
});

test("zero scores remain valid evidence", () => {
  const result = reconcileResultObservations({ observations: [observation({ homeScore: 0, awayScore: 0, sourceType: "official" })], fixturesData: fixtures });
  assert.deepEqual(result.decisions[0].score, [0, 0]);
  assert.equal(result.decisions[0].status, RECONCILIATION_STATUS.AUTO_SETTLE);
});

test("git publication gate requires changes, validation, and tests", () => {
  assert.equal(evaluateGitSyncGate({ hasChanges: false, validationPassed: true, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: false, testsPassed: true }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: false }).commitEligible, false);
  assert.equal(evaluateGitSyncGate({ hasChanges: true, validationPassed: true, testsPassed: true }).commitEligible, true);
});
