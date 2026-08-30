import { readFile } from "node:fs/promises";
import { validateStandings } from "../src/core/schema.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";
import { buildJiangsuStandings } from "../src/leagues/jiangsu/standings-builder.js";

const source = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url), "utf8"));
const published = JSON.parse(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"));
validateStandings(published);
const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
validateFixtures(fixtures);
const expectedStandings = buildJiangsuStandings({ source, fixturesData: fixtures });
if (JSON.stringify(expectedStandings) !== JSON.stringify(published)) {
  throw new Error("Published standings JSON is out of sync with the standings calculator");
}
const deviceFixtures = JSON.parse(await readFile(new URL("../data/fixtures-device-test.json", import.meta.url), "utf8"));
validateFixtures(deviceFixtures);
const resultCandidates = JSON.parse(await readFile(new URL("../data/result-candidates.json", import.meta.url), "utf8"));
validateResultCandidates(resultCandidates);
console.log(`Validated ${published.standings.length} teams; snapshot ${published.updatedAt}`);
console.log(`Validated ${fixtures.fixtures.length} fixtures; snapshot ${fixtures.updatedAt}`);
console.log(`Validated ${deviceFixtures.fixtures.length} synthetic device fixtures; matrix ${deviceFixtures.updatedAt}`);
console.log(`Validated ${resultCandidates.candidates.length} result candidates; snapshot ${resultCandidates.updatedAt}`);
