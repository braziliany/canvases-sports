const DEFAULT_SCORING = Object.freeze({ win: 3, draw: 1, loss: 0 });

export class InsufficientTieBreakerDataError extends Error {
  constructor(teamNames, reason) {
    super(`Cannot resolve official ranking for ${teamNames.join(" / ")}: ${reason}`);
    this.name = "InsufficientTieBreakerDataError";
    this.teamNames = teamNames;
  }
}

export function isCountedResult(fixture) {
  return fixture.status === "finished" &&
    Number.isInteger(fixture.homeScore) && fixture.homeScore >= 0 &&
    Number.isInteger(fixture.awayScore) && fixture.awayScore >= 0;
}

function applyResult(row, goalsFor, goalsAgainst, scoring) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += scoring.win;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += scoring.draw;
  } else {
    row.lost += 1;
    row.points += scoring.loss;
  }

  row.goalDifference = row.goalsFor - row.goalsAgainst;
}

function compareHeadToHead(left, right) {
  return right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor;
}

function rankAffectedTieGroup(group, countedFixtures) {
  const names = new Set(group.map((row) => row.team.name));
  const pairKeys = new Set();
  const headToHead = new Map(group.map((row) => [row.team.name, {
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0
  }]));

  for (const fixture of countedFixtures) {
    if (!names.has(fixture.homeTeam) || !names.has(fixture.awayTeam)) continue;
    pairKeys.add([fixture.homeTeam, fixture.awayTeam].sort().join("\u0000"));

    const home = headToHead.get(fixture.homeTeam);
    const away = headToHead.get(fixture.awayTeam);
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;

    if (fixture.homeScore > fixture.awayScore) home.points += 3;
    else if (fixture.homeScore < fixture.awayScore) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  const requiredPairs = group.length * (group.length - 1) / 2;
  if (pairKeys.size !== requiredPairs) {
    throw new InsufficientTieBreakerDataError(
      group.map((row) => row.team.name),
      "complete head-to-head results are not available in fixtures"
    );
  }

  for (const stats of headToHead.values()) {
    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  }

  const sorted = [...group].sort((left, right) => {
    const headComparison = compareHeadToHead(
      headToHead.get(left.team.name),
      headToHead.get(right.team.name)
    );
    return headComparison ||
      right.goalDifference - left.goalDifference ||
      right.goalsFor - left.goalsFor;
  });

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (compareHeadToHead(
      headToHead.get(previous.team.name),
      headToHead.get(current.team.name)
    ) === 0 && previous.goalDifference === current.goalDifference &&
      previous.goalsFor === current.goalsFor) {
      throw new InsufficientTieBreakerDataError(
        group.map((row) => row.team.name),
        "fair-play points and draw order are not available"
      );
    }
  }

  return sorted;
}

function rankRows(rows, countedFixtures, affectedTeamIds, baselineRanks, referenceRanks) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.points)) groups.set(row.points, []);
    groups.get(row.points).push(row);
  }

  const ranked = [];
  for (const points of [...groups.keys()].sort((left, right) => right - left)) {
    const group = groups.get(points);
    const groupWasAffected = group.some((row) => affectedTeamIds.has(row.team.id));
    let sortedGroup;
    if (group.length === 1) sortedGroup = group;
    else if (!groupWasAffected) {
      sortedGroup = [...group].sort((left, right) => baselineRanks.get(left.team.id) - baselineRanks.get(right.team.id));
    } else {
      try {
        sortedGroup = rankAffectedTieGroup(group, countedFixtures);
      } catch (error) {
        if (!(error instanceof InsufficientTieBreakerDataError) || !referenceRanks ||
          group.some((row) => !referenceRanks.has(row.team.name))) throw error;
        sortedGroup = [...group].sort((left, right) =>
          referenceRanks.get(left.team.name) - referenceRanks.get(right.team.name));
      }
    }
    ranked.push(...sortedGroup);
  }

  return ranked.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function calculateStandings({
  baseline,
  fixtures,
  scoring = DEFAULT_SCORING,
  updatedAt,
  rankingReference = null
}) {
  const countedFixtures = fixtures.filter(isCountedResult);
  if (countedFixtures.length === 0) return structuredClone(baseline);

  const rows = structuredClone(baseline.standings);
  const rowsByName = new Map(rows.map((row) => [row.team.name, row]));
  const baselineRanks = new Map(rows.map((row) => [row.team.id, row.rank]));
  const affectedTeamIds = new Set();

  for (const fixture of countedFixtures) {
    const home = rowsByName.get(fixture.homeTeam);
    const away = rowsByName.get(fixture.awayTeam);
    if (!home || !away) {
      throw new Error(`Unknown team in finished fixture ${fixture.id}: ${fixture.homeTeam} / ${fixture.awayTeam}`);
    }

    applyResult(home, fixture.homeScore, fixture.awayScore, scoring);
    applyResult(away, fixture.awayScore, fixture.homeScore, scoring);
    affectedTeamIds.add(home.team.id);
    affectedTeamIds.add(away.team.id);
  }

  const referenceRanks = rankingReference
    ? new Map(rankingReference.rows.map((row) => [row.team, row.rank]))
    : null;
  const standings = rankRows(rows, countedFixtures, affectedTeamIds, baselineRanks, referenceRanks)
    .map((row) => {
      const previousRank = baselineRanks.get(row.team.id);
      return {
        ...row,
        previousRank,
        trend: previousRank - row.rank
      };
    });

  if (rankingReference) {
    const referenceByTeam = new Map(rankingReference.rows.map((row) => [row.team, row]));
    for (const row of standings) {
      const expected = referenceByTeam.get(row.team.name);
      if (!expected) throw new Error(`Ranking reference is missing ${row.team.name}`);
      for (const field of ["rank", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points"]) {
        if (row[field] !== expected[field]) {
          throw new Error(`Standings do not match official reference for ${row.team.name}.${field}`);
        }
      }
    }
  }

  return {
    ...structuredClone(baseline),
    updatedAt,
    source: {
      name: "Canvases Sports standings calculator",
      type: "derived",
      method: "official-baseline-plus-finished-fixtures",
      baseline: baseline.source,
      countedFixtureIds: countedFixtures.map((fixture) => fixture.id),
      rankingReference: rankingReference?.source ?? null
    },
    standings
  };
}
