import { readFile, writeFile } from "node:fs/promises";
import { buildJiangsuStandings } from "../src/leagues/jiangsu/standings-builder.js";

const source = JSON.parse(await readFile(
  new URL("../data/sources/jiangsu-2026-08-22.json", import.meta.url),
  "utf8"
));
const fixturesData = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));
const rankingReference = JSON.parse(await readFile(
  new URL("../data/sources/results/2026-08-29-w19-official-standings-reference.json", import.meta.url),
  "utf8"
));
const standings = buildJiangsuStandings({ source, fixturesData, rankingReference });
const outputUrl = new URL("../data/standings.json", import.meta.url);

await writeFile(outputUrl, `${JSON.stringify(standings, null, 2)}\n`, "utf8");
console.log(
  `Built ${standings.standings.length} standings rows from ${standings.source.countedFixtureIds?.length ?? 0} finished fixtures`
);
