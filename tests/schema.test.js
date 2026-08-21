import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateStandings, ValidationError } from "../src/core/schema.js";

const fixture = JSON.parse(await readFile(new URL("../data/standings.json", import.meta.url), "utf8"));

test("validates the fixed 13-team snapshot", () => {
  assert.equal(validateStandings(fixture).standings.length, 13);
});

test("rejects inconsistent match totals", () => {
  const invalid = structuredClone(fixture);
  invalid.standings[0].played = 99;
  assert.throws(() => validateStandings(invalid), ValidationError);
});

test("rejects fabricated trend without previous rank", () => {
  const invalid = structuredClone(fixture);
  invalid.standings[0].trend = 2;
  assert.throws(() => validateStandings(invalid), ValidationError);
});
