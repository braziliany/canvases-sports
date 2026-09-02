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
const publishedFixtures = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));

function candidateData(candidates = []) {
  return {
    schemaVersion: 1,
    league: {
      id: "jiangsu-city-football-league",
      season: 2026
    },
    updatedAt: "2026-08-29T22:05:00+08:00",
    candidates: structuredClone(candidates)
  };
}

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

test("accepts an empty candidate collection", () => {
  assert.doesNotThrow(() => validateResultCandidates(candidateData()));
});

test("accepts one or multiple pending candidates", () => {
  const one = candidateData([candidate()]);
  assert.equal(validateResultCandidates(one).candidates.length, 1);

  const multiple = candidateData([
    candidate(),
    candidate({
      id: "candidate-2",
      source: "第二个可靠来源",
      sourceUrl: null
    })
  ]);
  assert.equal(validateResultCandidates(multiple).candidates.length, 2);
});

test("accepts a pending candidate with a real 0:0 score", () => {
  const data = candidateData([candidate({ homeScore: 0, awayScore: 0 })]);
  assert.deepEqual(validateResultCandidates(data).candidates[0].homeScore, 0);
});

test("rejects malformed scores, sources, and review state", () => {
  const invalid = candidateData([candidate({
    homeScore: -1,
    sourceUrl: "not-a-url",
    reviewStatus: "approved",
    confirmedAt: "2026-08-29T22:05:00+08:00"
  })]);
  assert.throws(() => validateResultCandidates(invalid), ResultCandidatesValidationError);
});

test("confirmed candidates require an auditable confirmation instant", () => {
  const invalid = candidateData([
    candidate({ reviewStatus: "confirmed", confirmedAt: null })
  ]);
  assert.throws(() => validateResultCandidates(invalid), ResultCandidatesValidationError);

  const valid = candidateData([candidate({
    reviewStatus: "confirmed",
    confirmedAt: "2026-08-29T22:05:00+08:00"
  })]);
  assert.doesNotThrow(() => validateResultCandidates(valid));
});

test("rejects duplicate candidate IDs", () => {
  const duplicate = candidateData([
    candidate(),
    candidate({ source: "第二个可靠来源", sourceUrl: null })
  ]);
  assert.throws(() => validateResultCandidates(duplicate), ResultCandidatesValidationError);
});

test("published candidates satisfy schema, fixture links, audit state, and pollution checks", () => {
  const validated = validateResultCandidates(published);
  const fixturesById = new Map(publishedFixtures.fixtures.map((fixture) => [fixture.id, fixture]));
  const testMarker = /(^test[-_]|\bmock\b|phase 4 mock|example\.com)/i;

  for (const item of validated.candidates) {
    const fixture = fixturesById.get(item.fixtureId);
    assert.ok(fixture, `Candidate ${item.id} must reference a published fixture`);
    assert.deepEqual(
      [item.homeTeam, item.awayTeam],
      [fixture.homeTeam, fixture.awayTeam],
      `Candidate ${item.id} teams must match its published fixture`
    );
    assert.equal(
      testMarker.test([item.id, item.fixtureId, item.source, item.sourceUrl ?? ""].join(" ")),
      false,
      `Candidate ${item.id} contains an explicit test/mock marker`
    );
    if (item.reviewStatus === "confirmed") {
      assert.equal(fixture.status, "finished", `Confirmed candidate ${item.id} requires finished fixture`);
      assert.deepEqual(
        [item.homeScore, item.awayScore],
        [fixture.homeScore, fixture.awayScore],
        `Confirmed candidate ${item.id} must match the authoritative score`
      );
    }
  }
});
