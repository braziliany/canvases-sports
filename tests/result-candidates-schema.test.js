import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ResultCandidatesValidationError,
  validateResultCandidates
} from "../src/core/result-candidates-schema.js";

const published = JSON.parse(await readFile(
  new URL("../data/result-candidates.json", import.meta.url),
  "utf8"
));

function candidate(overrides = {}) {
  return {
    id: "candidate-1",
    fixtureId: "2026-regular-w19-changzhou-wuxi",
    homeTeam: "常州",
    awayTeam: "无锡",
    homeScore: 1,
    awayScore: 0,
    source: "人工复核的测试来源",
    sourceUrl: "https://example.com/result",
    observedAt: "2026-08-29T22:00:00+08:00",
    reviewStatus: "candidate",
    confirmedAt: null,
    ...overrides
  };
}

test("empty production result candidate file passes validation", () => {
  assert.equal(validateResultCandidates(published).candidates.length, 0);
});

test("accepts a pending candidate with a real 0:0 score", () => {
  const data = structuredClone(published);
  data.candidates.push(candidate({ homeScore: 0, awayScore: 0 }));
  assert.deepEqual(validateResultCandidates(data).candidates[0].homeScore, 0);
});

test("rejects malformed scores, sources, and review state", () => {
  const invalid = structuredClone(published);
  invalid.candidates.push(candidate({
    homeScore: -1,
    sourceUrl: "not-a-url",
    confirmedAt: "2026-08-29T22:05:00+08:00"
  }));
  assert.throws(() => validateResultCandidates(invalid), ResultCandidatesValidationError);
});

test("confirmed candidates require an auditable confirmation instant", () => {
  const invalid = structuredClone(published);
  invalid.candidates.push(candidate({ reviewStatus: "confirmed", confirmedAt: null }));
  assert.throws(() => validateResultCandidates(invalid), ResultCandidatesValidationError);

  const valid = structuredClone(published);
  valid.candidates.push(candidate({
    reviewStatus: "confirmed",
    confirmedAt: "2026-08-29T22:05:00+08:00"
  }));
  assert.doesNotThrow(() => validateResultCandidates(valid));
});
