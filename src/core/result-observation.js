export const RESULT_SOURCE_TYPES = Object.freeze([
  "official",
  "official-republish",
  "trusted-media",
  "unknown"
]);

export class ResultObservationValidationError extends Error {
  constructor(issues) {
    super(`Invalid result observation: ${issues.join("; ")}`);
    this.name = "ResultObservationValidationError";
    this.issues = issues;
  }
}

function isIsoInstant(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateResultObservation(observation) {
  const issues = [];
  if (!observation || typeof observation !== "object") {
    throw new ResultObservationValidationError(["observation must be an object"]);
  }

  for (const field of ["leagueId", "homeTeam", "awayTeam", "source"]) {
    if (typeof observation[field] !== "string" || observation[field].trim() === "") {
      issues.push(`${field} must be a non-empty string`);
    }
  }
  if (observation.homeTeam === observation.awayTeam) {
    issues.push("homeTeam and awayTeam must differ");
  }
  for (const field of ["homeScore", "awayScore"]) {
    if (!Number.isSafeInteger(observation[field]) || observation[field] < 0) {
      issues.push(`${field} must be a safe non-negative integer`);
    }
  }
  if (!isHttpUrl(observation.sourceUrl)) {
    issues.push("sourceUrl must be an HTTP(S) URL");
  }
  if (!isIsoInstant(observation.observedAt)) {
    issues.push("observedAt must be ISO-8601");
  }
  if (!RESULT_SOURCE_TYPES.includes(observation.sourceType)) {
    issues.push("sourceType is invalid");
  }
  if (!Number.isInteger(observation.season)) issues.push("season must be an integer");
  if (!Number.isInteger(observation.round) || observation.round < 1) {
    issues.push("round must be a positive integer");
  }
  if (!isCalendarDate(observation.matchDate)) {
    issues.push("matchDate must be a real YYYY-MM-DD date");
  }

  if (issues.length) throw new ResultObservationValidationError(issues);
  return structuredClone(observation);
}
