import { readFile } from "node:fs/promises";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";
import { validateStandings } from "../src/core/schema.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { calculateStandings } from "../src/core/standings-calculator.js";
import { fixtureKickoffInstant } from "../src/core/fixture-state.js";
import { JIANGSU_CONFIG } from "../src/leagues/jiangsu/config.js";

const source = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url), "utf8"));
const published = JSON.parse(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"));
const adapted = adaptJiangsuSnapshot(source);
validateStandings(published);
const fixtures = JSON.parse(await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8"));
validateFixtures(fixtures);
const postBaselineFixtures = fixtures.fixtures.filter((fixture) =>
  fixtureKickoffInstant(fixture) > new Date(source.publishedAt)
);
const expectedStandings = calculateStandings({
  baseline: adapted,
  fixtures: postBaselineFixtures,
  scoring: JIANGSU_CONFIG.scoring,
  updatedAt: fixtures.updatedAt
});
if (JSON.stringify(expectedStandings) !== JSON.stringify(published)) {
  throw new Error("Published standings JSON is out of sync with the standings calculator");
}
const deviceFixtures = JSON.parse(await readFile(new URL("../data/fixtures-device-test.json", import.meta.url), "utf8"));
validateFixtures(deviceFixtures);
console.log(`Validated ${published.standings.length} teams; snapshot ${published.updatedAt}`);
console.log(`Validated ${fixtures.fixtures.length} fixtures; snapshot ${fixtures.updatedAt}`);
console.log(`Validated ${deviceFixtures.fixtures.length} synthetic device fixtures; matrix ${deviceFixtures.updatedAt}`);
