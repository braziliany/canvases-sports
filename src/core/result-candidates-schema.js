export const RESULT_REVIEW_STATUSES = Object.freeze(["candidate", "confirmed"]);

const REQUIRED_CANDIDATE_FIELDS = [
  "id",
  "fixtureId",
  "homeTeam",
  "awayTeam",
  "homeScore",
  "awayScore",
  "source",
  "sourceUrl",
  "observedAt",
  "reviewStatus",
  "confirmedAt"
];

export class ResultCandidatesValidationError extends Error {
  constructor(issues) {
    super(`Invalid result candidates data: ${issues.join("; ")}`);
    this.name = "ResultCandidatesValidationError";
    this.issues = issues;
  }
}

function isIsoInstant(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isHttpUrlOrNull(value) {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateResultCandidates(data) {
  const issues = [];
  if (!data || typeof data !== "object") {
    throw new ResultCandidatesValidationError(["root must be an object"]);
  }

  if (data.schemaVersion !== 1) issues.push("schemaVersion must equal 1");
  if (typeof data?.league?.id !== "string" || data.league.id.trim() === "") {
    issues.push("league.id must be a non-empty string");
  }
  if (!Number.isInteger(data?.league?.season)) {
    issues.push("league.season must be an integer");
  }
  if (!isIsoInstant(data.updatedAt)) issues.push("updatedAt must be ISO-8601");
  if (!Array.isArray(data.candidates)) issues.push("candidates must be an array");

  const ids = new Set();
  for (const [index, candidate] of (data.candidates ?? []).entries()) {
    const path = `candidates[${index}]`;
    for (const field of REQUIRED_CANDIDATE_FIELDS) {
      if (!(field in candidate)) issues.push(`${path}.${field} is required`);
    }

    if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
      issues.push(`${path}.id must be a non-empty string`);
    } else if (ids.has(candidate.id)) {
      issues.push(`${path}.id must be unique`);
    }
    ids.add(candidate.id);

    for (const field of ["fixtureId", "homeTeam", "awayTeam", "source"]) {
      if (typeof candidate[field] !== "string" || candidate[field].trim() === "") {
        issues.push(`${path}.${field} must be a non-empty string`);
      }
    }
    if (candidate.homeTeam === candidate.awayTeam) {
      issues.push(`${path} must use different teams`);
    }
    for (const field of ["homeScore", "awayScore"]) {
      if (!Number.isInteger(candidate[field]) || candidate[field] < 0) {
        issues.push(`${path}.${field} must be a non-negative integer`);
      }
    }
    if (!isHttpUrlOrNull(candidate.sourceUrl)) {
      issues.push(`${path}.sourceUrl must be an HTTP(S) URL or null`);
    }
    if (!isIsoInstant(candidate.observedAt)) {
      issues.push(`${path}.observedAt must be ISO-8601`);
    }
    if (!RESULT_REVIEW_STATUSES.includes(candidate.reviewStatus)) {
      issues.push(`${path}.reviewStatus is invalid`);
    }
    if (candidate.reviewStatus === "candidate" && candidate.confirmedAt !== null) {
      issues.push(`${path}.confirmedAt must be null before confirmation`);
    }
    if (candidate.reviewStatus === "confirmed" && !isIsoInstant(candidate.confirmedAt)) {
      issues.push(`${path}.confirmedAt must be ISO-8601 after confirmation`);
    }
    if (isIsoInstant(candidate.confirmedAt) && isIsoInstant(candidate.observedAt) &&
      Date.parse(candidate.confirmedAt) < Date.parse(candidate.observedAt)) {
      issues.push(`${path}.confirmedAt must not precede observedAt`);
    }
  }

  if (issues.length) throw new ResultCandidatesValidationError(issues);
  return structuredClone(data);
}
