import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFixtureStatuses } from "../src/core/fixture-state.js";
import { createUnsettledRoundFixtures } from "./helpers/result-fixtures.js";

const published = JSON.parse(await readFile(
  new URL("../data/fixtures.json", import.meta.url),
  "utf8"
));

const WEEK20_SCORES = Object.freeze([[0, 1], [1, 1], [2, 2]]);

function finishRound(data, round, scores, count = scores.length) {
  const next = structuredClone(data);
  let index = 0;
  for (const fixture of next.fixtures) {
    if (fixture.round !== round || index >= count) continue;
    fixture.status = "finished";
    fixture.effectiveStatus = "finished";
    [fixture.homeScore, fixture.awayScore] = scores[index];
    index += 1;
  }
  return next;
}

function syntheticScores(count) {
  return Array.from({ length: count }, (_, index) => [index % 3, (index + 1) % 3]);
}

const week20Unsettled = createUnsettledRoundFixtures(published, 20, {
  now: "2026-09-05T18:00:00+08:00"
});
const week20Finished = finishRound(week20Unsettled, 20, WEEK20_SCORES);
const week21Finished = finishRound(week20Finished, 21, syntheticScores(6));
const week22Finished = finishRound(week21Finished, 22, syntheticScores(6));

const timeline = [
  { scenario: "A", now: "2026-09-05T18:00:00+08:00", data: week20Unsettled, round: 20, count: 3, date: "2026-09-05", status: "scheduled" },
  { scenario: "B", now: "2026-09-05T20:00:00+08:00", data: week20Unsettled, round: 20, count: 3, date: "2026-09-05", status: "live" },
  { scenario: "C/D", now: "2026-09-07T20:00:00+08:00", data: week20Finished, round: 20, count: 3, date: "2026-09-05", status: "finished" },
  { scenario: "E", now: "2026-09-11T19:39:00+08:00", data: week20Finished, round: 20, count: 3, date: "2026-09-05", status: "finished" },
  { scenario: "F", now: "2026-09-11T19:40:00+08:00", data: week20Finished, round: 21, count: 6, date: "2026-09-12", status: "scheduled" },
  { scenario: "G", now: "2026-09-12T20:00:00+08:00", data: week20Finished, round: 21, count: 6, date: "2026-09-12", status: "live" },
  { scenario: "I", now: "2026-09-14T20:00:00+08:00", data: week21Finished, round: 21, count: 6, date: "2026-09-12", status: "finished" },
  { scenario: "I", now: "2026-09-18T19:39:00+08:00", data: week21Finished, round: 21, count: 6, date: "2026-09-12", status: "finished" },
  { scenario: "J", now: "2026-09-18T19:40:00+08:00", data: week21Finished, round: 22, count: 6, date: "2026-09-19", status: "scheduled" },
  { scenario: "K-pre", now: "2026-09-19T20:00:00+08:00", data: week21Finished, round: 22, count: 6, date: "2026-09-19", status: "live" },
  { scenario: "K", now: "2026-09-21T20:00:00+08:00", data: week22Finished, round: 22, count: 6, date: "2026-09-19", status: "finished" }
];

test("season flow advances deterministically from week 20 through the final round", () => {
  for (const item of timeline) {
    const actual = normalizeFixtureStatuses(item.data, { now: item.now });
    assert.equal(actual.displayRound, item.round, `${item.scenario} displayRound`);
    assert.equal(actual.displayFixtures.length, item.count, `${item.scenario} fixture count`);
    assert.equal(actual.displayFixtures.every((fixture) => fixture.date === item.date), true, `${item.scenario} date`);
    assert.equal(actual.displayFixtures.every((fixture) => fixture.effectiveStatus === item.status), true, `${item.scenario} effectiveStatus`);
  }
});

test("week 20 settlement preserves the three reviewed final scores", () => {
  const actual = normalizeFixtureStatuses(week20Finished, { now: "2026-09-07T20:00:00+08:00" });
  assert.deepEqual(actual.displayFixtures.map((fixture) => [fixture.homeTeam, fixture.homeScore, fixture.awayScore, fixture.awayTeam]), [
    ["连云港", 0, 1, "南通"],
    ["盐城", 1, 1, "徐州"],
    ["南京", 2, 2, "泰州"]
  ]);
});

test("a partially settled week keeps four finished and two live fixtures independently", () => {
  const partial = finishRound(week20Finished, 21, syntheticScores(6), 4);
  const actual = normalizeFixtureStatuses(partial, { now: "2026-09-12T20:00:00+08:00" });
  assert.equal(actual.displayRound, 21);
  assert.deepEqual(
    actual.displayFixtures.map((fixture) => fixture.effectiveStatus),
    ["finished", "finished", "finished", "finished", "live", "live"]
  );
});

test("the final completed round remains visible after the season ends", () => {
  const actual = normalizeFixtureStatuses(week22Finished, { now: "2026-10-01T12:00:00+08:00" });
  assert.equal(actual.displayRound, 22);
  assert.equal(actual.displayFixtures.length, 6);
  assert.equal(actual.displaySelectionReason, "FINAL_ROUND");
});
