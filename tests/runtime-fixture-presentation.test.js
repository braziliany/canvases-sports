import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveRuntimeFixturePresentation } from "../src/core/fixture-state.js";

const frozenSeptember7Data = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));
const scenarios = JSON.parse(await readFile(
  new URL("./fixtures/runtime-presentation-scenarios.json", import.meta.url),
  "utf8"
));

function finishRound(data, round) {
  const copy = structuredClone(data);
  for (const fixture of copy.fixtures) {
    if (fixture.round !== round) continue;
    fixture.status = "finished";
    fixture.homeScore = 0;
    fixture.awayScore = 0;
  }
  return copy;
}

test("a frozen September 7 payload changes presentation as device time advances", () => {
  const originalBytes = JSON.stringify(frozenSeptember7Data);
  for (const { id, now, displayRound, effectiveStatus } of scenarios.scenarios) {
    const projection = deriveRuntimeFixturePresentation(frozenSeptember7Data, { now });
    assert.equal(projection.displayRound, displayRound, id);
    assert.equal(
      projection.displayFixtures.every((fixture) => fixture.effectiveStatus === effectiveStatus),
      true,
      id
    );
  }

  assert.equal(JSON.stringify(frozenSeptember7Data), originalBytes);
  assert.equal(frozenSeptember7Data.displayRound, 20);
});

test("the September 11 20:11 field reproduction selects all six week 21 fixtures", () => {
  const projection = deriveRuntimeFixturePresentation(frozenSeptember7Data, {
    now: "2026-09-11T20:11:00+08:00"
  });

  assert.equal(projection.displayRound, 21);
  assert.equal(projection.displaySelectionReason, "NEXT_ROUND_WINDOW");
  assert.deepEqual(
    projection.displayFixtures.map(({ homeTeam, awayTeam }) => [homeTeam, awayTeam]),
    scenarios.fieldReproductionFixtures
  );
});

test("runtime projection ignores stale persisted display fields", () => {
  const stale = structuredClone(frozenSeptember7Data);
  stale.displayRound = 999;
  stale.displaySelectionReason = "STALE";
  stale.displayFixtures = [];

  const projection = deriveRuntimeFixturePresentation(stale, {
    now: "2026-09-11T20:11:00+08:00"
  });
  assert.equal(projection.displayRound, 21);
  assert.equal(projection.displayFixtures.length, 6);
});

test("time can make a scheduled fixture live but can never make it finished", () => {
  const projection = deriveRuntimeFixturePresentation(frozenSeptember7Data, {
    now: "2026-09-13T20:11:00+08:00"
  });
  assert.equal(projection.displayRound, 21);
  assert.equal(
    projection.displayFixtures.every((fixture) => fixture.effectiveStatus === "live"),
    true
  );
  assert.equal(
    projection.displayFixtures.every((fixture) => fixture.status === "scheduled"),
    true
  );
});

test("confirmed week 21 results remain visible until the week 22 runtime boundary", () => {
  const settled = finishRound(frozenSeptember7Data, 21);
  const before = deriveRuntimeFixturePresentation(settled, {
    now: "2026-09-18T19:39:59.999+08:00"
  });
  const atBoundary = deriveRuntimeFixturePresentation(settled, {
    now: "2026-09-18T19:40:00+08:00"
  });

  assert.equal(before.displayRound, 21);
  assert.equal(before.displayFixtures.every(({ effectiveStatus }) => effectiveStatus === "finished"), true);
  assert.equal(atBoundary.displayRound, 22);
  assert.equal(atBoundary.displayFixtures.every(({ effectiveStatus }) => effectiveStatus === "scheduled"), true);
});
