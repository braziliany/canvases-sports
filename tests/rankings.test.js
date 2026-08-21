import test from "node:test";
import assert from "node:assert/strict";
import { rankRows, assertSourceRanks } from "../src/core/rankings.js";

test("general ranking orders by points, goal difference, then goals", () => {
  const rows = [
    { team: { name: "乙" }, points: 7, goalDifference: 2, goalsFor: 5 },
    { team: { name: "甲" }, points: 9, goalDifference: 0, goalsFor: 3 },
    { team: { name: "丙" }, points: 7, goalDifference: 3, goalsFor: 4 }
  ];
  assert.deepEqual(rankRows(rows).map((row) => row.team.name), ["甲", "丙", "乙"]);
});

test("official source ranks form a complete sequence", () => {
  assert.equal(assertSourceRanks([{ rank: 2 }, { rank: 1 }, { rank: 3 }]), true);
  assert.equal(assertSourceRanks([{ rank: 1 }, { rank: 3 }]), false);
});
