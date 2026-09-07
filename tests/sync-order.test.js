import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFixtureStatuses } from "../src/core/fixture-state.js";
import { prepareProductionResultSync } from "../src/core/production-result-sync.js";
import { createUnsettledRoundFixtures } from "./helpers/result-fixtures.js";

const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-22.json", import.meta.url), "utf8"));
const references = await Promise.all([
  "../data/sources/results/2026-08-29-w19-official-standings-reference.json",
  "../data/sources/results/2026-09-05-w20-official-standings-reference.json"
].map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))));

const confirmedAt = "2026-09-07T12:00:00.000Z";
const unsettledFixtures = createUnsettledRoundFixtures(fixtures, 20, { now: confirmedAt });
const officialUrl = "https://official.test.invalid/week20";
const observations = [
  ["连云港", 0, 1, "南通"],
  ["盐城", 1, 1, "徐州"],
  ["南京", 2, 2, "泰州"]
].map(([homeTeam, homeScore, awayScore, awayTeam]) => ({
  leagueId: fixtures.league.id,
  season: 2026,
  round: 20,
  matchDate: "2026-09-05",
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  source: "测试中的受控官方源",
  sourceType: "official",
  sourceUrl: officialUrl,
  observedAt: "2026-09-06T00:00:00.000Z"
}));
const sourcePolicies = [{
  name: "测试中的受控官方源",
  type: "official",
  url: officialUrl,
  publisherId: "controlled-official-test"
}];
const emptyCandidates = {
  schemaVersion: 1,
  league: { id: fixtures.league.id, season: 2026 },
  updatedAt: "2026-09-06T00:00:00.000Z",
  candidates: []
};

function resultSync(fixturesData, candidatesData = emptyCandidates) {
  return prepareProductionResultSync({
    source: baseline,
    rankingReference: references,
    fixturesData,
    candidatesData,
    observations,
    confirmedAt,
    sourcePolicies
  });
}

test("fixture presentation sync and result sync converge in either order", () => {
  const fixtureThenResult = resultSync(normalizeFixtureStatuses(unsettledFixtures, { now: confirmedAt }));
  const resultThenFixture = resultSync(unsettledFixtures);
  const presentedAfterResult = normalizeFixtureStatuses(resultThenFixture.fixturesData, { now: confirmedAt });

  assert.deepEqual(fixtureThenResult.fixturesData, presentedAfterResult);
  assert.deepEqual(fixtureThenResult.standingsData, resultThenFixture.standingsData);
  assert.deepEqual(fixtureThenResult.candidatesData, resultThenFixture.candidatesData);
});

test("repeated and interleaved syncs are idempotent", () => {
  const first = resultSync(normalizeFixtureStatuses(unsettledFixtures, { now: confirmedAt }));
  const presentationAgain = normalizeFixtureStatuses(first.fixturesData, { now: confirmedAt });
  const resultAgain = resultSync(presentationAgain, first.candidatesData);

  assert.equal(resultAgain.settlements.length, 0);
  assert.deepEqual(resultAgain.fixturesData, first.fixturesData);
  assert.deepEqual(resultAgain.standingsData, first.standingsData);
  assert.deepEqual(resultAgain.candidatesData, first.candidatesData);
});
