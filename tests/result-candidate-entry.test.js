import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import {
  appendResultCandidate,
  createUniqueCandidateId,
  listEligibleResultFixtures,
  normalizeResultSource,
  normalizeResultSourceUrl,
  parseResultScore,
  pendingCandidatesForFixture,
  persistCandidateIfApproved,
  ResultCandidateEntryError,
  selectResultFixture
} from "../src/core/result-candidate-entry.js";
import { validateResultCandidates } from "../src/core/result-candidates-schema.js";
import { settleResultCandidate } from "../src/core/result-settlement.js";

const fixturesData = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));
const publishedCandidates = JSON.parse(await readFile(
  new URL("../data/result-candidates.json", import.meta.url),
  "utf8"
));
const publishedStandingsText = await readFile(
  new URL("../data/standings.json", import.meta.url),
  "utf8"
);
const OBSERVED_AT = "2026-08-29T22:00:00+08:00";

function append(overrides = {}) {
  return appendResultCandidate({
    fixturesData,
    candidatesData: publishedCandidates,
    fixtureId: fixturesData.fixtures[0].id,
    homeScore: 1,
    awayScore: 0,
    source: "Phase 4 mock source — not a real result",
    sourceUrl: "https://example.com/mock-result",
    observedAt: OBSERVED_AT,
    ...overrides
  });
}

test("eligible fixture selection includes scheduled/live and excludes terminal or exceptional states", () => {
  const mixed = structuredClone(fixturesData);
  Object.assign(mixed.fixtures[0], {
    status: "cancelled",
    effectiveStatus: "cancelled",
    homeScore: null,
    awayScore: null
  });
  Object.assign(mixed.fixtures[1], {
    status: "postponed",
    effectiveStatus: "postponed",
    homeScore: null,
    awayScore: null
  });
  Object.assign(mixed.fixtures[2], {
    status: "finished",
    effectiveStatus: "finished",
    homeScore: 2,
    awayScore: 1
  });
  assert.deepEqual(listEligibleResultFixtures(mixed), []);

  const eligible = listEligibleResultFixtures(fixturesData);
  assert.equal(eligible.length, 3);
  assert.equal(selectResultFixture("1", eligible).id, fixturesData.fixtures[0].id);
  assert.equal(selectResultFixture(fixturesData.fixtures[1].id, eligible).id, fixturesData.fixtures[1].id);
  assert.throws(() => selectResultFixture("99", eligible), ResultCandidateEntryError);
});

test("score parsing accepts zero and positive integers", () => {
  assert.deepEqual(["0", "1", "2"].map((value) => parseResultScore(value)), [0, 1, 2]);
});

test("score parsing rejects negatives, decimals, text, and empty input", () => {
  for (const value of ["-1", "1.5", "abc", "", " "]) {
    assert.throws(() => parseResultScore(value), ResultCandidateEntryError);
  }
});

test("source is required and source URL may be empty or valid HTTP(S)", () => {
  assert.throws(() => normalizeResultSource("  "), ResultCandidateEntryError);
  assert.equal(normalizeResultSource("  江苏省体育局  "), "江苏省体育局");
  assert.equal(normalizeResultSourceUrl(""), null);
  assert.equal(normalizeResultSourceUrl("https://example.com/result"), "https://example.com/result");
  assert.throws(() => normalizeResultSourceUrl("not-a-url"), ResultCandidateEntryError);
  assert.throws(() => normalizeResultSourceUrl("ftp://example.com/result"), ResultCandidateEntryError);
});

test("a valid candidate appends without changing existing candidates and passes the contract", () => {
  const prepared = append({ homeScore: "0", awayScore: "0", sourceUrl: "" });
  assert.equal(publishedCandidates.candidates.length, 0);
  assert.equal(prepared.candidatesData.candidates.length, 1);
  assert.deepEqual(
    [prepared.candidate.homeScore, prepared.candidate.awayScore, prepared.candidate.sourceUrl],
    [0, 0, null]
  );
  assert.doesNotThrow(() => validateResultCandidates(prepared.candidatesData));
});

test("candidate IDs are unique and multiple sources for one fixture coexist", () => {
  const first = append({ source: "source A" });
  const second = appendResultCandidate({
    fixturesData,
    candidatesData: first.candidatesData,
    fixtureId: fixturesData.fixtures[0].id,
    homeScore: 1,
    awayScore: 0,
    source: "source B",
    sourceUrl: null,
    observedAt: OBSERVED_AT
  });
  assert.notEqual(first.candidate.id, second.candidate.id);
  assert.equal(second.candidate.id, `${first.candidate.id}-2`);
  assert.deepEqual(second.candidatesData.candidates.map((item) => item.source), ["source A", "source B"]);
  assert.deepEqual(
    pendingCandidatesForFixture(second.candidatesData, fixturesData.fixtures[0].id).map((item) => item.id),
    [first.candidate.id, second.candidate.id]
  );
});

test("candidate ID generation never overwrites an existing ID", () => {
  const first = createUniqueCandidateId("fixture", OBSERVED_AT, []);
  const second = createUniqueCandidateId("fixture", OBSERVED_AT, [first]);
  const third = createUniqueCandidateId("fixture", OBSERVED_AT, [first, second]);
  assert.deepEqual([second, third], [`${first}-2`, `${first}-3`]);
});

test("results:add output can be consumed directly by the existing confirmation contract", () => {
  const prepared = append();
  const settled = settleResultCandidate({
    fixturesData,
    candidatesData: prepared.candidatesData,
    candidateId: prepared.candidate.id,
    confirmedAt: "2026-08-29T22:05:00+08:00"
  });
  assert.deepEqual(
    [settled.fixturesData.fixtures[0].status, settled.fixturesData.fixtures[0].homeScore,
      settled.fixturesData.fixtures[0].awayScore],
    ["finished", 1, 0]
  );
});

test("anything other than exact ADD cancels without invoking persistence", async () => {
  const prepared = append();
  let writes = 0;
  for (const answer of ["", "add", "YES", "CANCEL"]) {
    const added = await persistCandidateIfApproved({
      answer,
      candidatesData: prepared.candidatesData,
      persist: async () => { writes += 1; }
    });
    assert.equal(added, false);
  }
  assert.equal(writes, 0);
});

test("approved entry safely writes only the candidate file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "canvases-result-entry-"));
  const fixturesPath = join(directory, "fixtures.json");
  const standingsPath = join(directory, "standings.json");
  const candidatesPath = join(directory, "result-candidates.json");
  const fixturesText = `${JSON.stringify(fixturesData, null, 2)}\n`;
  const candidatesText = `${JSON.stringify(publishedCandidates, null, 2)}\n`;
  await writeFile(fixturesPath, fixturesText, "utf8");
  await writeFile(standingsPath, publishedStandingsText, "utf8");
  await writeFile(candidatesPath, candidatesText, "utf8");

  try {
    const prepared = append();
    const added = await persistCandidateIfApproved({
      answer: "ADD",
      candidatesData: prepared.candidatesData,
      persist: (data) => commitJsonFilesAtomically([{ path: candidatesPath, data }])
    });
    assert.equal(added, true);
    assert.equal(await readFile(fixturesPath, "utf8"), fixturesText);
    assert.equal(await readFile(standingsPath, "utf8"), publishedStandingsText);
    assert.equal(
      JSON.parse(await readFile(candidatesPath, "utf8")).candidates[0].id,
      prepared.candidate.id
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production candidate data remains free of mock results", () => {
  assert.deepEqual(publishedCandidates.candidates, []);
});
