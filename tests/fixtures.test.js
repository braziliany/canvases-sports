import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FixturesValidationError,
  sortFixturesChronologically,
  validateFixtures
} from "../src/core/fixtures-schema.js";
import { mapJiangsuFixtureStatus } from "../src/leagues/jiangsu/fixture-status.js";

const fixtureData = JSON.parse(
  await readFile(new URL("../data/fixtures.json", import.meta.url), "utf8")
);
const deviceFixtureData = JSON.parse(
  await readFile(new URL("../data/fixtures-device-test.json", import.meta.url), "utf8")
);

test("fixtures.json passes the fixtures schema", () => {
  assert.equal(validateFixtures(fixtureData).fixtures.length, 3);
});

test("device fixture covers the device status and score matrix", () => {
  const fixtures = validateFixtures(deviceFixtureData).fixtures;
  assert.deepEqual(
    fixtures.map(({ status, effectiveStatus, homeScore, awayScore }) => [
      status,
      effectiveStatus,
      homeScore,
      awayScore
    ]),
    [
      ["scheduled", "scheduled", null, null],
      ["live", "live", 1, 0],
      ["finished", "finished", 2, 2],
      ["postponed", "postponed", null, null],
      ["cancelled", "cancelled", null, null],
      ["live", "live", null, null]
    ]
  );
});

test("rejects an effective status inconsistent with its derivation time", () => {
  const invalid = structuredClone(fixtureData);
  invalid.fixtures[0].effectiveStatus = "scheduled";
  assert.throws(() => validateFixtures(invalid), FixturesValidationError);
});

test("rejects duplicate fixture ids", () => {
  const invalid = structuredClone(fixtureData);
  invalid.fixtures[1].id = invalid.fixtures[0].id;
  assert.throws(() => validateFixtures(invalid), FixturesValidationError);
});

test("rejects invalid calendar dates and times", () => {
  const invalidDate = structuredClone(fixtureData);
  invalidDate.fixtures[0].date = "2026-02-30";
  assert.throws(() => validateFixtures(invalidDate), FixturesValidationError);

  const invalidTime = structuredClone(fixtureData);
  invalidTime.fixtures[0].time = "24:00";
  assert.throws(() => validateFixtures(invalidTime), FixturesValidationError);
});

test("rejects a fixture where both teams are the same", () => {
  const invalid = structuredClone(fixtureData);
  invalid.fixtures[0].awayTeam = invalid.fixtures[0].homeTeam;
  assert.throws(() => validateFixtures(invalid), FixturesValidationError);
});

test("scheduled scores must be null and finished scores must exist", () => {
  const scheduledWithScore = structuredClone(fixtureData);
  scheduledWithScore.fixtures[0].homeScore = 1;
  scheduledWithScore.fixtures[0].awayScore = 0;
  assert.throws(() => validateFixtures(scheduledWithScore), FixturesValidationError);

  const finishedWithoutScore = structuredClone(fixtureData);
  finishedWithoutScore.fixtures[0].status = "finished";
  finishedWithoutScore.fixtures[0].effectiveStatus = "finished";
  assert.throws(() => validateFixtures(finishedWithoutScore), FixturesValidationError);

  const finished = structuredClone(fixtureData);
  finished.fixtures[0].status = "finished";
  finished.fixtures[0].effectiveStatus = "finished";
  finished.fixtures[0].homeScore = 2;
  finished.fixtures[0].awayScore = 1;
  assert.doesNotThrow(() => validateFixtures(finished));
});

test("maps known Jiangsu source statuses and rejects unknown ones", () => {
  assert.equal(mapJiangsuFixtureStatus("未开始"), "scheduled");
  assert.equal(mapJiangsuFixtureStatus("进行中"), "live");
  assert.equal(mapJiangsuFixtureStatus("已结束"), "finished");
  assert.equal(mapJiangsuFixtureStatus("延期"), "postponed");
  assert.equal(mapJiangsuFixtureStatus("取消"), "cancelled");
  assert.throws(() => mapJiangsuFixtureStatus("待确认"), /Unknown Jiangsu fixture status/);
});

test("rejects a fixture status outside the unified enum", () => {
  const invalid = structuredClone(fixtureData);
  invalid.fixtures[0].status = "delayed";
  assert.throws(() => validateFixtures(invalid), FixturesValidationError);
});

test("sorts fixtures chronologically and rejects unsorted data", () => {
  const later = {
    ...structuredClone(fixtureData.fixtures[0]),
    id: "later",
    date: "2026-09-05"
  };
  const earlier = {
    ...structuredClone(fixtureData.fixtures[0]),
    id: "earlier",
    date: "2026-08-29"
  };
  assert.deepEqual(
    sortFixturesChronologically([later, earlier]).map((fixture) => fixture.id),
    ["earlier", "later"]
  );

  const invalid = structuredClone(fixtureData);
  invalid.fixtures[0].date = "2026-09-05";
  assert.throws(() => validateFixtures(invalid), FixturesValidationError);
});
