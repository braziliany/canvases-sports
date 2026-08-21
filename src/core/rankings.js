export function compareByGeneralRules(a, b) {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name, "zh-CN");
}

export function rankRows(rows) {
  return [...rows].sort(compareByGeneralRules).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function assertSourceRanks(rows) {
  const sortedRanks = [...rows].map((row) => row.rank).sort((a, b) => a - b);
  return sortedRanks.every((rank, index) => rank === index + 1);
}
