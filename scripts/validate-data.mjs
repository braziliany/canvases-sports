import { readFile } from "node:fs/promises";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";
import { validateStandings } from "../src/core/schema.js";

const source = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url), "utf8"));
const published = JSON.parse(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"));
const adapted = adaptJiangsuSnapshot(source);
validateStandings(published);
if (JSON.stringify(adapted) !== JSON.stringify(published)) throw new Error("Published JSON is out of sync with the source adapter");
console.log(`Validated ${published.standings.length} teams; snapshot ${published.updatedAt}`);
