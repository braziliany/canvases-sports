import {
  deriveEffectiveStatus,
  fixtureKickoffInstant,
  FIXTURE_STATUSES,
  selectCurrentFixtures
} from "./fixture-state.js";

export { FIXTURE_STATUSES };

const REQUIRED_FIXTURE_FIELDS = [
  "id",
  "round",
  "date",
  "time",
  "homeTeam",
  "awayTeam",
  "homeScore",
  "awayScore",
  "status",
  "effectiveStatus",
  "venue"
];

export class FixturesValidationError extends Error {
  constructor(issues) {
    super(`Invalid fixtures data: ${issues.join("; ")}`);
    this.name = "FixturesValidationError";
    this.issues = issues;
  }
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function fixtureSortKey(fixture) {
  return `${fixture.date}T${fixture.time}`;
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateScheduleSources(data, issues) {
  if (data.scheduleSources === undefined) return null;
  if (!Array.isArray(data.scheduleSources) || data.scheduleSources.length === 0) {
    issues.push("scheduleSources must be a non-empty array");
    return new Set();
  }

  const ids = new Set();
  for (const [index, source] of data.scheduleSources.entries()) {
    const path = `scheduleSources[${index}]`;
    for (const field of ["id", "name", "type", "url", "publishedAt", "method"]) {
      if (typeof source?.[field] !== "string" || source[field].trim() === "") {
        issues.push(`${path}.${field} must be a non-empty string`);
      }
    }
    if (ids.has(source?.id)) issues.push(`${path}.id must be unique`);
    ids.add(source?.id);
    if (!isHttpUrl(source?.url)) issues.push(`${path}.url must be HTTP(S)`);
    if (Number.isNaN(Date.parse(source?.publishedAt))) {
      issues.push(`${path}.publishedAt must be ISO-8601`);
    }
  }
  return ids;
}

export function sortFixturesChronologically(fixtures) {
  return structuredClone(fixtures).sort((left, right) =>
    fixtureSortKey(left).localeCompare(fixtureSortKey(right)) || left.id.localeCompare(right.id)
  );
}

export function validateFixtures(data) {
  const issues = [];
  if (!data || typeof data !== "object") {
    throw new FixturesValidationError(["root must be an object"]);
  }
  if (data.schemaVersion !== 1) issues.push("schemaVersion must equal 1");
  if (!data.league || typeof data.league !== "object") issues.push("league is required");
  if (typeof data?.league?.id !== "string" || data.league.id.trim() === "") {
    issues.push("league.id must be a non-empty string");
  }
  if (typeof data?.league?.name !== "string" || data.league.name.trim() === "") {
    issues.push("league.name must be a non-empty string");
  }
  if (!Number.isInteger(data?.league?.season)) issues.push("league.season must be an integer");
  if (typeof data.updatedAt !== "string" || Number.isNaN(Date.parse(data.updatedAt))) {
    issues.push("updatedAt must be ISO-8601");
  }
  const effectiveStatusAtIsValid = typeof data.effectiveStatusAt === "string" &&
    !Number.isNaN(Date.parse(data.effectiveStatusAt));
  if (!effectiveStatusAtIsValid) issues.push("effectiveStatusAt must be ISO-8601");
  if (!Array.isArray(data.fixtures)) issues.push("fixtures must be an array");
  const scheduleSourceIds = validateScheduleSources(data, issues);

  const ids = new Set();
  let previousSortKey = null;
  for (const [index, fixture] of (data.fixtures ?? []).entries()) {
    const path = `fixtures[${index}]`;
    for (const field of REQUIRED_FIXTURE_FIELDS) {
      if (!(field in fixture)) issues.push(`${path}.${field} is required`);
    }

    if (typeof fixture.id !== "string" || fixture.id.trim() === "") {
      issues.push(`${path}.id must be a non-empty string`);
    } else if (ids.has(fixture.id)) {
      issues.push(`${path}.id must be unique`);
    }
    ids.add(fixture.id);

    if (!Number.isInteger(fixture.round) || fixture.round < 1) {
      issues.push(`${path}.round must be a positive integer`);
    }
    if (!isValidDate(fixture.date)) issues.push(`${path}.date must be YYYY-MM-DD`);
    if (!isValidTime(fixture.time)) issues.push(`${path}.time must be HH:mm`);
    if (scheduleSourceIds) {
      if (typeof fixture.kickoff !== "string" || Number.isNaN(Date.parse(fixture.kickoff))) {
        issues.push(`${path}.kickoff must be ISO-8601`);
      } else if (isValidDate(fixture.date) && isValidTime(fixture.time) &&
        Date.parse(fixture.kickoff) !== fixtureKickoffInstant(fixture).getTime()) {
        issues.push(`${path}.kickoff must match date/time in Asia/Shanghai`);
      }
      if (!fixture.provenance || typeof fixture.provenance !== "object") {
        issues.push(`${path}.provenance is required`);
      } else {
        if (!scheduleSourceIds.has(fixture.provenance.sourceId)) {
          issues.push(`${path}.provenance.sourceId must reference scheduleSources`);
        }
        if (!Array.isArray(fixture.provenance.corroboratedBy)) {
          issues.push(`${path}.provenance.corroboratedBy must be an array`);
        } else if (new Set(fixture.provenance.corroboratedBy).size !==
          fixture.provenance.corroboratedBy.length ||
          fixture.provenance.corroboratedBy.some((id) => !scheduleSourceIds.has(id))) {
          issues.push(`${path}.provenance.corroboratedBy must contain unique source references`);
        }
      }
    }
    if (typeof fixture.homeTeam !== "string" || fixture.homeTeam.trim() === "") {
      issues.push(`${path}.homeTeam must be a non-empty string`);
    }
    if (typeof fixture.awayTeam !== "string" || fixture.awayTeam.trim() === "") {
      issues.push(`${path}.awayTeam must be a non-empty string`);
    }
    if (fixture.homeTeam === fixture.awayTeam) issues.push(`${path} must use different teams`);
    if (!FIXTURE_STATUSES.includes(fixture.status)) issues.push(`${path}.status is invalid`);
    if (!FIXTURE_STATUSES.includes(fixture.effectiveStatus)) {
      issues.push(`${path}.effectiveStatus is invalid`);
    } else if (effectiveStatusAtIsValid && isValidDate(fixture.date) && isValidTime(fixture.time) &&
      FIXTURE_STATUSES.includes(fixture.status)) {
      const expectedStatus = deriveEffectiveStatus(fixture, { now: data.effectiveStatusAt });
      if (fixture.effectiveStatus !== expectedStatus) {
        issues.push(`${path}.effectiveStatus must equal ${expectedStatus} at effectiveStatusAt`);
      }
    }
    if (fixture.venue !== null && typeof fixture.venue !== "string") {
      issues.push(`${path}.venue must be a string or null`);
    }

    const scoresAreNull = fixture.homeScore === null && fixture.awayScore === null;
    const scoresAreIntegers = Number.isInteger(fixture.homeScore) && fixture.homeScore >= 0 &&
      Number.isInteger(fixture.awayScore) && fixture.awayScore >= 0;
    if (["scheduled", "postponed", "cancelled"].includes(fixture.status) && !scoresAreNull) {
      issues.push(`${path}: ${fixture.status} fixture scores must be null`);
    } else if (fixture.status === "finished" && !scoresAreIntegers) {
      issues.push(`${path}: finished fixture scores must be non-negative integers`);
    } else if (!["scheduled", "finished"].includes(fixture.status) && !scoresAreNull && !scoresAreIntegers) {
      issues.push(`${path}: scores must both be null or non-negative integers`);
    }

    if (isValidDate(fixture.date) && isValidTime(fixture.time)) {
      const sortKey = fixtureSortKey(fixture);
      if (previousSortKey !== null && sortKey < previousSortKey) {
        issues.push("fixtures must be sorted chronologically");
      }
      previousSortKey = sortKey;
    }
  }

  const displayFields = ["displayRound", "displaySelectionReason", "displayFixtures"];
  const presentDisplayFields = displayFields.filter((field) => field in data);
  if (presentDisplayFields.length > 0 && presentDisplayFields.length !== displayFields.length) {
    issues.push("displayRound, displaySelectionReason, and displayFixtures must appear together");
  } else if (presentDisplayFields.length === displayFields.length && effectiveStatusAtIsValid &&
    Array.isArray(data.fixtures)) {
    const expected = selectCurrentFixtures(data, { now: data.effectiveStatusAt });
    if (data.displayRound !== expected.displayRound) {
      issues.push(`displayRound must equal ${expected.displayRound}`);
    }
    if (data.displaySelectionReason !== expected.displaySelectionReason) {
      issues.push(`displaySelectionReason must equal ${expected.displaySelectionReason}`);
    }
    if (JSON.stringify(data.displayFixtures) !== JSON.stringify(expected.displayFixtures)) {
      issues.push("displayFixtures must match the selected canonical fixtures");
    }
  }

  if (issues.length) throw new FixturesValidationError(issues);
  return structuredClone(data);
}
