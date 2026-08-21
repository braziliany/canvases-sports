import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";

test("adapter emits the unified schema and preserves official rank", async () => {
  const raw = JSON.parse(await readFile(new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url), "utf8"));
  const data = adaptJiangsuSnapshot(raw);
  assert.equal(data.league.id, "jiangsu-city-football-league");
  assert.equal(data.standings[0].team.name, "无锡");
  assert.equal(data.standings[7].rank, 8);
  assert.equal(data.standings[7].trend, null);
});
