import { readFile } from "node:fs/promises";
import { validateStandings } from "../src/core/schema.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";
import { buildJiangsuStandings } from "../src/leagues/jiangsu/standings-builder.js";
import { parseYangtzeEveningNewsResults } from "../src/adapters/results/yangtze-evening-news.js";
import {
  parseChangzhouSportsBureauResult,
  parseHuaianPoliceResult,
  parseYangzhouReleaseResult
} from "../src/adapters/results/official-local-government.js";
import { matchResultObservationToFixture } from "../src/core/result-fixture-matcher.js";
import { RESULT_SOURCES } from "../src/sources/result-sources.js";

const source = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-22.json", import.meta.url), "utf8"));
const published = JSON.parse(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"));
const rankingReference = JSON.parse(await readFile(
  new URL("../data/sources/results/2026-08-29-w19-official-standings-reference.json", import.meta.url), "utf8"
));
validateStandings(published);
const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
validateFixtures(fixtures);
const expectedStandings = buildJiangsuStandings({ source, fixturesData: fixtures, rankingReference });
if (JSON.stringify(expectedStandings) !== JSON.stringify(published)) {
  throw new Error("Published standings JSON is out of sync with the standings calculator");
}
const deviceFixtures = JSON.parse(await readFile(new URL("../data/fixtures-device-test.json", import.meta.url), "utf8"));
validateFixtures(deviceFixtures);
const resultCandidates = JSON.parse(await readFile(new URL("../data/result-candidates.json", import.meta.url), "utf8"));
validateResultCandidates(resultCandidates);
const resultAdapters = new Map([
  ["yangtze-evening-news-final-report-v1", parseYangtzeEveningNewsResults],
  ["changzhou-sports-bureau-final-result-v1", parseChangzhouSportsBureauResult],
  ["huaian-police-final-result-v1", parseHuaianPoliceResult],
  ["yangzhou-release-final-result-v1", parseYangzhouReleaseResult]
]);
const validatedSources = [];
for (const config of RESULT_SOURCES) {
  const snapshot = JSON.parse(await readFile(
    new URL(`../data/sources/results/${config.fileName}`, import.meta.url), "utf8"
  ));
  const adapter = resultAdapters.get(snapshot.adapter);
  if (!adapter) throw new Error(`No validation adapter registered for ${snapshot.adapter}`);
  const observations = adapter(snapshot);
  for (const observation of observations) matchResultObservationToFixture(observation, fixtures);
  validatedSources.push({ snapshot, observations });
}
if (rankingReference.rows.length !== published.standings.length ||
  rankingReference.requiredFixtureIds.some((id) => !fixtures.fixtures.some((fixture) => fixture.id === id))) {
  throw new Error("Official standings reference is incomplete or does not match fixtures");
}
console.log(`Validated ${published.standings.length} teams; snapshot ${published.updatedAt}`);
console.log(`Validated ${fixtures.fixtures.length} fixtures; snapshot ${fixtures.updatedAt}`);
console.log(`Validated ${deviceFixtures.fixtures.length} synthetic device fixtures; matrix ${deviceFixtures.updatedAt}`);
console.log(`Validated ${resultCandidates.candidates.length} result candidates; snapshot ${resultCandidates.updatedAt}`);
for (const { snapshot, observations } of validatedSources) {
  console.log(`Validated ${observations.length} result observations from ${snapshot.source.name}`);
}
