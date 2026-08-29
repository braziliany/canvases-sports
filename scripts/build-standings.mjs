import { readFile, writeFile } from "node:fs/promises";
import { calculateStandings } from "../src/core/standings-calculator.js";
import { fixtureKickoffInstant } from "../src/core/fixture-state.js";
import { validateFixtures } from "../src/core/fixtures-schema.js";
import { validateStandings } from "../src/core/schema.js";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";
import { JIANGSU_CONFIG } from "../src/leagues/jiangsu/config.js";

const source = JSON.parse(await readFile(
  new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url),
  "utf8"
));
const fixturesData = validateFixtures(JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
)));
const baseline = adaptJiangsuSnapshot(source);
const baselineInstant = new Date(source.publishedAt);
const postBaselineFixtures = fixturesData.fixtures.filter((fixture) =>
  fixtureKickoffInstant(fixture) > baselineInstant
);
const standings = validateStandings(calculateStandings({
  baseline,
  fixtures: postBaselineFixtures,
  scoring: JIANGSU_CONFIG.scoring,
  updatedAt: fixturesData.updatedAt
}));
const outputUrl = new URL("../data/standings.json", import.meta.url);

await writeFile(outputUrl, `${JSON.stringify(standings, null, 2)}\n`, "utf8");
console.log(
  `Built ${standings.standings.length} standings rows from ${standings.source.countedFixtureIds?.length ?? 0} finished fixtures`
);
