import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveEffectiveStatus,
  normalizeFixtureStatuses,
  selectCurrentFixtures
} from "../src/core/fixture-state.js";

function fixture({
  id,
  round,
  date,
  status = "scheduled",
  homeScore = null,
  awayScore = null
}) {
  return {
    id,
    round,
    date,
    time: "19:40",
    homeTeam: `${id}-home`,
    awayTeam: `${id}-away`,
    homeScore,
    awayScore,
    status,
    effectiveStatus: status,
    venue: null
  };
}

function data(fixtures) {
  return {
    schemaVersion: 1,
    league: { id: "test", name: "test", shortName: "test", season: 2026 },
    updatedAt: "2026-09-01T00:00:00.000Z",
    effectiveStatusAt: "2026-09-01T00:00:00.000Z",
    fixtures
  };
}

const historical = fixture({
  id: "w19",
  round: 19,
  date: "2026-08-29",
  status: "finished",
  homeScore: 1,
  awayScore: 0
});
const current = fixture({ id: "w20", round: 20, date: "2026-09-05" });
const next = fixture({ id: "w21", round: 21, date: "2026-09-12" });

test("selects the nearest future round before its kickoff window", () => {
  const result = normalizeFixtureStatuses(data([current, next]), {
    now: "2026-09-04T18:00:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.equal(result.displaySelectionReason, "NEXT_UPCOMING_ROUND");
});

test("selects the round exactly at kickoff", () => {
  const result = normalizeFixtureStatuses(data([historical, current, next]), {
    now: "2026-09-05T19:40:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.equal(result.displayFixtures[0].effectiveStatus, "live");
});

test("keeps the current round while matches are in progress", () => {
  const result = normalizeFixtureStatuses(data([historical, current, next]), {
    now: "2026-09-05T20:30:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.equal(result.displaySelectionReason, "CURRENT_ROUND");
});

test("keeps a finished round until the next-round lead window", () => {
  const finished = fixture({
    id: "w20-finished",
    round: 20,
    date: "2026-09-05",
    status: "finished",
    homeScore: 2,
    awayScore: 1
  });
  const result = normalizeFixtureStatuses(data([historical, finished, next]), {
    now: "2026-09-10T12:00:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.equal(result.displaySelectionReason, "RECENT_TERMINAL_ROUND");
});

test("switches to the next round 24 hours before kickoff", () => {
  const result = normalizeFixtureStatuses(data([historical, current, next]), {
    now: "2026-09-11T19:40:00+08:00"
  });
  assert.equal(result.displayRound, 21);
  assert.equal(result.displaySelectionReason, "NEXT_ROUND_WINDOW");
});

test("selects the next round on its formal match day", () => {
  const result = normalizeFixtureStatuses(data([historical, current, next]), {
    now: "2026-09-12T08:00:00+08:00"
  });
  assert.equal(result.displayRound, 21);
});

test("historical rounds never win over the deterministic current window", () => {
  const result = normalizeFixtureStatuses(data([historical, current, next]), {
    now: "2026-09-06T08:00:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.deepEqual(result.displayFixtures.map(({ id }) => id), ["w20"]);
});

test("a scoreless current round remains live rather than guessed finished", () => {
  const result = normalizeFixtureStatuses(data([current, next]), {
    now: "2026-09-06T08:00:00+08:00"
  });
  assert.equal(result.displayFixtures[0].effectiveStatus, "live");
  assert.equal(result.displayFixtures[0].homeScore, null);
  assert.equal(result.displayFixtures[0].awayScore, null);
});

test("partial finished and live fixtures remain in one current round", () => {
  const finished = fixture({
    id: "finished",
    round: 20,
    date: "2026-09-05",
    status: "finished",
    homeScore: 1,
    awayScore: 0
  });
  const live = fixture({ id: "live", round: 20, date: "2026-09-05" });
  const result = normalizeFixtureStatuses(data([finished, live, next]), {
    now: "2026-09-05T21:00:00+08:00"
  });
  assert.equal(result.displayRound, 20);
  assert.deepEqual(result.displayFixtures.map(({ effectiveStatus }) => effectiveStatus), [
    "finished",
    "live"
  ]);
});

test("postponed and cancelled statuses remain authoritative", () => {
  const postponed = fixture({
    id: "postponed",
    round: 20,
    date: "2026-09-05",
    status: "postponed"
  });
  const cancelled = fixture({
    id: "cancelled",
    round: 20,
    date: "2026-09-05",
    status: "cancelled"
  });
  const result = normalizeFixtureStatuses(data([postponed, cancelled, next]), {
    now: "2026-09-06T08:00:00+08:00"
  });
  assert.deepEqual(result.displayFixtures.map(({ effectiveStatus }) => effectiveStatus), [
    "postponed",
    "cancelled"
  ]);
});

test("Asia/Shanghai kickoff comparison does not depend on host timezone", () => {
  assert.equal(
    deriveEffectiveStatus(current, { now: "2026-09-05T11:39:59.999Z" }),
    "scheduled"
  );
  assert.equal(
    deriveEffectiveStatus(current, { now: "2026-09-05T11:40:00.000Z" }),
    "live"
  );
});

test("repeated normalize and selection are stable for a fixed now", () => {
  const now = "2026-09-06T08:00:00+08:00";
  const once = normalizeFixtureStatuses(data([historical, current, next]), { now });
  const twice = normalizeFixtureStatuses(once, { now });
  assert.deepEqual(twice, once);
  assert.deepEqual(selectCurrentFixtures(twice, { now }), {
    displayRound: once.displayRound,
    displaySelectionReason: once.displaySelectionReason,
    displayFixtures: once.displayFixtures
  });
});
