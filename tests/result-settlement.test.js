import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitJsonFilesAtomically } from "../src/core/json-file-transaction.js";
import {
  executePreparedSettlement,
  prepareResultSettlement
} from "../src/core/result-settlement-pipeline.js";
import {
  formatResultCandidateReview,
  ResultConflictError,
  ResultSettlementError,
  settleResultCandidate
} from "../src/core/result-settlement.js";
import { calculateStandings, isCountedResult } from "../src/core/standings-calculator.js";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";
import { buildJiangsuStandings } from "../src/leagues/jiangsu/standings-builder.js";

const source = JSON.parse(await readFile(
  new URL("../data/sources/jiangsu-2026-08-15.json", import.meta.url),
  "utf8"
));
const baseline = adaptJiangsuSnapshot(source);
const publishedFixtures = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));
const formalFixtures = structuredClone(publishedFixtures);
for (const fixture of formalFixtures.fixtures) {
  Object.assign(fixture, {
    status: "scheduled",
    effectiveStatus: "live",
    homeScore: null,
    awayScore: null
  });
}

const CONFIRMED_AT = "2026-08-29T22:05:00+08:00";

function resultCandidate(fixture = formalFixtures.fixtures[0], overrides = {}) {
  return {
    id: `mock-${fixture.id}`,
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeScore: 1,
    awayScore: 0,
    source: "Phase 3 mock source — not a real result",
    sourceUrl: "https://example.com/mock-result",
    observedAt: "2026-08-29T22:00:00+08:00",
    reviewStatus: "candidate",
    confirmedAt: null,
    ...overrides
  };
}

function candidateData(candidates) {
  return {
    schemaVersion: 1,
    league: {
      id: formalFixtures.league.id,
      season: formalFixtures.league.season
    },
    updatedAt: "2026-08-29T22:00:00+08:00",
    candidates
  };
}

function row(table, name) {
  return table.standings.find((item) => item.team.name === name);
}

test("candidate 1:0 requires confirmation before fixtures and standings change", () => {
  const candidate = resultCandidate();
  const candidatesData = candidateData([candidate]);
  const beforeFixtures = structuredClone(formalFixtures);
  const beforeStandings = calculateStandings({
    baseline,
    fixtures: formalFixtures.fixtures,
    updatedAt: formalFixtures.updatedAt
  });

  assert.deepEqual(formalFixtures, beforeFixtures);
  assert.deepEqual(beforeStandings, baseline);
  assert.equal(candidatesData.candidates[0].reviewStatus, "candidate");

  const settled = settleResultCandidate({
    fixturesData: formalFixtures,
    candidatesData,
    candidateId: candidate.id,
    confirmedAt: CONFIRMED_AT
  });
  const fixture = settled.fixturesData.fixtures[0];
  assert.deepEqual(
    [fixture.status, fixture.effectiveStatus, fixture.homeScore, fixture.awayScore],
    ["finished", "finished", 1, 0]
  );
  assert.equal(settled.candidatesData.candidates[0].reviewStatus, "confirmed");

  const standings = buildJiangsuStandings({ source, fixturesData: settled.fixturesData });
  assert.deepEqual(
    [row(standings, "常州").points, row(standings, "无锡").points],
    [19, 18]
  );
});

test("candidate 0:0 is confirmed and settled as a draw", () => {
  const fixture = formalFixtures.fixtures[1];
  const candidate = resultCandidate(fixture, { homeScore: 0, awayScore: 0 });
  const settled = settleResultCandidate({
    fixturesData: formalFixtures,
    candidatesData: candidateData([candidate]),
    candidateId: candidate.id,
    confirmedAt: CONFIRMED_AT
  });
  const authoritative = settled.fixturesData.fixtures[1];
  assert.deepEqual([authoritative.homeScore, authoritative.awayScore], [0, 0]);

  const standings = buildJiangsuStandings({ source, fixturesData: settled.fixturesData });
  assert.deepEqual(
    [row(standings, "淮安").drawn, row(standings, "连云港").drawn],
    [2, 5]
  );
});

test("effectiveStatus never authorizes settlement and missing final scores are ignored", () => {
  assert.equal(isCountedResult({
    status: "scheduled",
    effectiveStatus: "finished",
    homeScore: 1,
    awayScore: 0
  }), false);
  assert.equal(isCountedResult({
    status: "finished",
    effectiveStatus: "finished",
    homeScore: null,
    awayScore: 0
  }), false);
});

test("confirming the same candidate and score twice is idempotent", () => {
  const candidate = resultCandidate();
  const first = settleResultCandidate({
    fixturesData: formalFixtures,
    candidatesData: candidateData([candidate]),
    candidateId: candidate.id,
    confirmedAt: CONFIRMED_AT
  });
  const second = settleResultCandidate({
    fixturesData: first.fixturesData,
    candidatesData: first.candidatesData,
    candidateId: candidate.id,
    confirmedAt: "2026-08-29T22:10:00+08:00"
  });
  assert.equal(second.outcome.idempotent, true);
  assert.equal(second.outcome.changed, false);
  assert.deepEqual(second.fixturesData, first.fixturesData);
  assert.deepEqual(second.candidatesData, first.candidatesData);
});

test("confirmed candidate with a non-finished fixture is rejected as inconsistent audit state", () => {
  const candidate = resultCandidate(formalFixtures.fixtures[0], {
    reviewStatus: "confirmed",
    confirmedAt: CONFIRMED_AT
  });
  assert.throws(() => settleResultCandidate({
    fixturesData: formalFixtures,
    candidatesData: candidateData([candidate]),
    candidateId: candidate.id,
    confirmedAt: "2026-08-29T22:10:00+08:00"
  }), /not authoritative finished/);
});

test("a different score conflicts with an existing authoritative result", () => {
  const finished = structuredClone(formalFixtures);
  Object.assign(finished.fixtures[0], {
    status: "finished",
    effectiveStatus: "finished",
    homeScore: 1,
    awayScore: 0
  });
  const conflicting = resultCandidate(finished.fixtures[0], { homeScore: 2, awayScore: 0 });
  assert.throws(() => settleResultCandidate({
    fixturesData: finished,
    candidatesData: candidateData([conflicting]),
    candidateId: conflicting.id,
    confirmedAt: CONFIRMED_AT
  }), ResultConflictError);
  assert.deepEqual([finished.fixtures[0].homeScore, finished.fixtures[0].awayScore], [1, 0]);
});

for (const status of ["cancelled", "postponed"]) {
  test(`${status} fixtures cannot be settled directly from a candidate`, () => {
    const fixturesData = structuredClone(formalFixtures);
    Object.assign(fixturesData.fixtures[0], {
      status,
      effectiveStatus: status,
      homeScore: null,
      awayScore: null
    });
    const candidate = resultCandidate(fixturesData.fixtures[0]);
    assert.throws(() => settleResultCandidate({
      fixturesData,
      candidatesData: candidateData([candidate]),
      candidateId: candidate.id,
      confirmedAt: CONFIRMED_AT
    }), ResultSettlementError);
  });
}

test("candidate teams must match the authoritative fixture", () => {
  const candidate = resultCandidate(formalFixtures.fixtures[0], { awayTeam: "宿迁" });
  assert.throws(() => settleResultCandidate({
    fixturesData: formalFixtures,
    candidatesData: candidateData([candidate]),
    candidateId: candidate.id,
    confirmedAt: CONFIRMED_AT
  }), /teams do not match/);
});

test("review output contains every fact needed for human confirmation", () => {
  const candidate = resultCandidate();
  const output = formatResultCandidateReview(candidate, formalFixtures.fixtures[0]);
  for (const text of ["常州 VS 无锡", "2026-08-29 19:40", "scheduled", "常州 1 : 0 无锡", candidate.source, candidate.observedAt]) {
    assert.equal(output.includes(text), true);
  }
});

test("all three 2026-08-29 matches pass the mock confirmation transition without changing production input", () => {
  const scores = [[1, 0], [0, 0], [2, 1]];
  const candidates = formalFixtures.fixtures.map((fixture, index) => resultCandidate(fixture, {
    homeScore: scores[index][0],
    awayScore: scores[index][1]
  }));
  let fixturesData = formalFixtures;
  let candidatesState = candidateData(candidates);
  for (const [index, candidate] of candidates.entries()) {
    const settled = settleResultCandidate({
      fixturesData,
      candidatesData: candidatesState,
      candidateId: candidate.id,
      confirmedAt: `2026-08-29T22:${String(5 + index).padStart(2, "0")}:00+08:00`
    });
    fixturesData = settled.fixturesData;
    candidatesState = settled.candidatesData;
  }

  assert.deepEqual(
    fixturesData.fixtures.map((fixture) => [fixture.id, fixture.status, fixture.homeScore, fixture.awayScore]),
    formalFixtures.fixtures.map((fixture, index) => [fixture.id, "finished", ...scores[index]])
  );
  assert.equal(formalFixtures.fixtures.every((fixture) => fixture.status === "scheduled"), true);
});

test("verification failure prevents the commit callback from running", async () => {
  const candidate = resultCandidate();
  let committed = false;
  await assert.rejects(() => executePreparedSettlement({
    prepare: () => prepareResultSettlement({
      source,
      fixturesData: formalFixtures,
      candidatesData: candidateData([candidate]),
      candidateId: candidate.id,
      confirmedAt: CONFIRMED_AT
    }),
    verify: async () => {
      throw new Error("simulated validation failure");
    },
    commit: async () => {
      committed = true;
    }
  }), /simulated validation failure/);
  assert.equal(committed, false);
  assert.equal(formalFixtures.fixtures[0].status, "scheduled");
});

test("default transaction replaces every existing file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "canvases-result-transaction-success-"));
  const fixturesPath = join(directory, "fixtures.json");
  const standingsPath = join(directory, "standings.json");
  await writeFile(fixturesPath, '{"state":"fixtures-before"}\n', "utf8");
  await writeFile(standingsPath, '{"state":"standings-before"}\n', "utf8");

  try {
    await commitJsonFilesAtomically([
      { path: fixturesPath, data: { state: "fixtures-after" } },
      { path: standingsPath, data: { state: "standings-after" } }
    ]);
    assert.deepEqual(JSON.parse(await readFile(fixturesPath, "utf8")), { state: "fixtures-after" });
    assert.deepEqual(JSON.parse(await readFile(standingsPath, "utf8")), { state: "standings-after" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("multi-file write failure rolls every formal file back", async () => {
  const directory = await mkdtemp(join(tmpdir(), "canvases-result-transaction-"));
  const fixturesPath = join(directory, "fixtures.json");
  const standingsPath = join(directory, "standings.json");
  const originalFixtures = '{"state":"fixtures-before"}\n';
  const originalStandings = '{"state":"standings-before"}\n';
  await writeFile(fixturesPath, originalFixtures, "utf8");
  await writeFile(standingsPath, originalStandings, "utf8");

  try {
    await assert.rejects(() => commitJsonFilesAtomically([
      { path: fixturesPath, data: { state: "fixtures-after" } },
      { path: standingsPath, data: { state: "standings-after" } }
    ], {
      replaceFile: async (sourcePath, targetPath, index) => {
        if (index === 1) throw new Error("simulated second-file failure");
        await copyFile(sourcePath, targetPath);
      }
    }), /simulated second-file failure/);
    assert.equal(await readFile(fixturesPath, "utf8"), originalFixtures);
    assert.equal(await readFile(standingsPath, "utf8"), originalStandings);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
