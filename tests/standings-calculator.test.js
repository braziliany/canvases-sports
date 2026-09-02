import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateStandings,
  InsufficientTieBreakerDataError,
  isCountedResult
} from "../src/core/standings-calculator.js";
import { adaptJiangsuSnapshot } from "../src/leagues/jiangsu/adapter.js";

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

function result(overrides = {}) {
  return {
    id: "test-result",
    homeTeam: "常州",
    awayTeam: "无锡",
    status: "finished",
    effectiveStatus: "finished",
    homeScore: 1,
    awayScore: 0,
    ...overrides
  };
}

function rowByName(table, name) {
  return table.standings.find((row) => row.team.name === name);
}

test("counts only explicitly finished fixtures with two scores", () => {
  const fixtures = [
    result(),
    result({ id: "scheduled", status: "scheduled", effectiveStatus: "live" }),
    result({ id: "live", status: "live", effectiveStatus: "live" }),
    result({ id: "postponed", status: "postponed", effectiveStatus: "postponed" }),
    result({ id: "cancelled", status: "cancelled", effectiveStatus: "cancelled" }),
    result({ id: "missing-score", homeScore: null }),
    result({ id: "effective-only", status: "scheduled", effectiveStatus: "finished" })
  ];
  const table = calculateStandings({
    baseline,
    fixtures,
    updatedAt: "2026-08-29T22:00:00+08:00"
  });

  const changzhou = rowByName(table, "常州");
  const wuxi = rowByName(table, "无锡");
  assert.deepEqual(
    [changzhou.played, changzhou.won, changzhou.goalsFor, changzhou.goalsAgainst, changzhou.points, changzhou.rank],
    [10, 6, 14, 7, 19, 1]
  );
  assert.deepEqual(
    [wuxi.played, wuxi.lost, wuxi.goalsFor, wuxi.goalsAgainst, wuxi.points, wuxi.rank],
    [10, 2, 14, 9, 18, 2]
  );
  assert.deepEqual(table.source.countedFixtureIds, ["test-result"]);
});

test("formal live-effective fixtures do not settle before source status is finished", () => {
  const table = calculateStandings({
    baseline,
    fixtures: formalFixtures.fixtures,
    updatedAt: formalFixtures.updatedAt
  });
  assert.deepEqual(table, baseline);
});

test("a confirmed result cloned from the formal fixture updates both teams", () => {
  const confirmed = {
    ...structuredClone(formalFixtures.fixtures[0]),
    status: "finished",
    effectiveStatus: "finished",
    homeScore: 1,
    awayScore: 0
  };
  const table = calculateStandings({
    baseline,
    fixtures: [confirmed],
    updatedAt: "2026-08-29T22:00:00+08:00"
  });
  assert.deepEqual(
    [rowByName(table, "常州").points, rowByName(table, "无锡").points],
    [19, 18]
  );
});

test("treats 0:0 as a finished draw", () => {
  const fixture = result({
    homeTeam: "淮安",
    awayTeam: "连云港",
    homeScore: 0,
    awayScore: 0
  });
  assert.equal(isCountedResult(fixture), true);

  const table = calculateStandings({
    baseline,
    fixtures: [fixture],
    updatedAt: "2026-08-29T22:00:00+08:00"
  });
  const huaian = rowByName(table, "淮安");
  const lianyungang = rowByName(table, "连云港");
  assert.deepEqual([huaian.played, huaian.drawn, huaian.points], [9, 2, 8]);
  assert.deepEqual([lianyungang.played, lianyungang.drawn, lianyungang.points], [10, 5, 5]);
});

test("returns byte-equivalent data for repeated calculations", () => {
  const input = {
    baseline,
    fixtures: [result()],
    updatedAt: "2026-08-29T22:00:00+08:00"
  };
  assert.equal(
    JSON.stringify(calculateStandings(input)),
    JSON.stringify(calculateStandings(input))
  );
});

function emptyRow(id, name, rank) {
  return {
    rank,
    previousRank: null,
    trend: null,
    team: { id, name, shortName: name, logo: null },
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

const miniBaseline = {
  schemaVersion: 1,
  league: { id: "test", name: "测试联赛", shortName: "测试", season: 2026 },
  updatedAt: "2026-01-01T00:00:00+08:00",
  stage: "regular-season",
  qualification: { type: "top", count: 2, label: "晋级" },
  source: { name: "test" },
  standings: [emptyRow("a", "甲", 1), emptyRow("b", "乙", 2), emptyRow("c", "丙", 3)]
};

test("uses head-to-head points, goal difference, then goals for tied teams", () => {
  const fixtures = [
    result({ id: "a-b", homeTeam: "甲", awayTeam: "乙", homeScore: 1, awayScore: 0 }),
    result({ id: "b-c", homeTeam: "乙", awayTeam: "丙", homeScore: 2, awayScore: 0 }),
    result({ id: "c-a", homeTeam: "丙", awayTeam: "甲", homeScore: 3, awayScore: 0 })
  ];
  const table = calculateStandings({
    baseline: miniBaseline,
    fixtures,
    updatedAt: "2026-01-02T00:00:00+08:00"
  });
  assert.deepEqual(table.standings.map((row) => row.team.name), ["丙", "乙", "甲"]);
});

test("fails instead of inventing missing fair-play or draw tie-breakers", () => {
  assert.throws(
    () => calculateStandings({
      baseline: {
        ...miniBaseline,
        standings: miniBaseline.standings.slice(0, 2)
      },
      fixtures: [result({ homeTeam: "甲", awayTeam: "乙", homeScore: 0, awayScore: 0 })],
      updatedAt: "2026-01-02T00:00:00+08:00"
    }),
    InsufficientTieBreakerDataError
  );
});
