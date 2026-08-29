import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  deriveEffectiveStatus,
  deriveScoreState,
  normalizeFixtureStatuses
} from "../src/core/fixture-state.js";

const kickoffFixture = {
  date: "2026-08-29",
  time: "19:40",
  status: "scheduled",
  homeScore: null,
  awayScore: null
};

test("scheduled remains scheduled before kickoff", () => {
  assert.equal(
    deriveEffectiveStatus(kickoffFixture, { now: "2026-08-29T19:39:59+08:00" }),
    "scheduled"
  );
});

test("scheduled becomes live exactly at kickoff", () => {
  assert.equal(
    deriveEffectiveStatus(kickoffFixture, { now: "2026-08-29T19:40:00+08:00" }),
    "live"
  );
});

test("scheduled remains effectively live after kickoff without auto-finishing", () => {
  assert.equal(
    deriveEffectiveStatus(kickoffFixture, { now: "2026-08-30T19:40:00+08:00" }),
    "live"
  );
});

for (const status of ["postponed", "cancelled", "finished"]) {
  test(`${status} overrides elapsed kickoff time`, () => {
    assert.equal(
      deriveEffectiveStatus(
        { ...kickoffFixture, status },
        { now: "2026-08-30T19:40:00+08:00" }
      ),
      status
    );
  });
}

test("live 0:0 has a real score", () => {
  const fixture = { ...kickoffFixture, status: "live", homeScore: 0, awayScore: 0 };
  assert.equal(deriveEffectiveStatus(fixture), "live");
  assert.deepEqual(deriveScoreState(fixture), { hasScore: true, score: "0 : 0" });
});

test("live with a missing score has no score", () => {
  const fixture = { ...kickoffFixture, status: "live", homeScore: null, awayScore: 1 };
  assert.equal(deriveEffectiveStatus(fixture), "live");
  assert.deepEqual(deriveScoreState(fixture), { hasScore: false, score: null });
});

test("2026-08-29 20:53 regression marks all three published fixtures live", async () => {
  const published = JSON.parse(
    await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8")
  );
  const normalized = normalizeFixtureStatuses(published, {
    now: "2026-08-29T20:53:00+08:00"
  });

  assert.deepEqual(
    normalized.fixtures.map(({ homeTeam, awayTeam, effectiveStatus, homeScore, awayScore }) => ({
      match: `${homeTeam} VS ${awayTeam}`,
      effectiveStatus,
      hasScore: deriveScoreState({ homeScore, awayScore }).hasScore
    })),
    [
      { match: "常州 VS 无锡", effectiveStatus: "live", hasScore: false },
      { match: "淮安 VS 连云港", effectiveStatus: "live", hasScore: false },
      { match: "扬州 VS 宿迁", effectiveStatus: "live", hasScore: false }
    ]
  );
});
