const REQUIRED_ROW_FIELDS = [
  "rank", "previousRank", "trend", "team", "played", "won", "drawn",
  "lost", "goalsFor", "goalsAgainst", "goalDifference", "points"
];

export class ValidationError extends Error {
  constructor(issues) {
    super(`Invalid standings data: ${issues.join("; ")}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export function validateStandings(data) {
  const issues = [];
  if (!data || typeof data !== "object") throw new ValidationError(["root must be an object"]);
  if (!data.league || typeof data.league !== "object") issues.push("league is required");
  if (!Number.isInteger(data?.league?.season)) issues.push("league.season must be an integer");
  if (!Number.isNaN(Date.parse(data.updatedAt)) === false) issues.push("updatedAt must be ISO-8601");
  if (data?.qualification?.type !== "top" || !Number.isInteger(data?.qualification?.count)) {
    issues.push("qualification must define an integer top count");
  }
  if (!Array.isArray(data.standings)) issues.push("standings must be an array");

  const ids = new Set();
  const ranks = new Set();
  for (const [index, row] of (data.standings ?? []).entries()) {
    const path = `standings[${index}]`;
    for (const field of REQUIRED_ROW_FIELDS) {
      if (!(field in row)) issues.push(`${path}.${field} is required`);
    }
    if (!row.team || typeof row.team.id !== "string" || typeof row.team.name !== "string") {
      issues.push(`${path}.team must contain id and name`);
      continue;
    }
    if (ids.has(row.team.id)) issues.push(`${path}.team.id must be unique`);
    ids.add(row.team.id);
    if (!Number.isInteger(row.rank) || row.rank < 1) issues.push(`${path}.rank must be positive`);
    if (ranks.has(row.rank)) issues.push(`${path}.rank must be unique`);
    ranks.add(row.rank);

    for (const field of ["played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points"]) {
      if (!Number.isInteger(row[field]) || row[field] < 0) issues.push(`${path}.${field} must be a non-negative integer`);
    }
    if (row.won + row.drawn + row.lost !== row.played) issues.push(`${path}: won + drawn + lost must equal played`);
    if (row.goalsFor - row.goalsAgainst !== row.goalDifference) issues.push(`${path}.goalDifference is inconsistent`);
    if (row.won * 3 + row.drawn !== row.points) issues.push(`${path}.points does not match the documented 3/1/0 rule`);
    if (row.trend !== null && row.trend !== row.previousRank - row.rank) issues.push(`${path}.trend is inconsistent`);
    if (row.previousRank === null && row.trend !== null) issues.push(`${path}.trend must be null without previousRank`);
  }

  if ((data.standings ?? []).length !== 13) issues.push("the Jiangsu league snapshot must contain 13 teams");
  if (issues.length) throw new ValidationError(issues);
  return structuredClone(data);
}
