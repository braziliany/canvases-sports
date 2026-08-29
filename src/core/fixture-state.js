const EXPLICIT_STATUSES = new Set(["finished", "postponed", "cancelled"]);
export const FIXTURE_STATUSES = Object.freeze([
  "scheduled",
  "live",
  ...EXPLICIT_STATUSES
]);
const SUPPORTED_STATUSES = new Set(FIXTURE_STATUSES);

const TIME_ZONE_OFFSETS = Object.freeze({
  "Asia/Shanghai": "+08:00"
});

function parseInstant(value, label) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new TypeError(`${label} must be a valid instant`);
  return instant;
}

export function fixtureKickoffInstant(fixture, { timeZone = "Asia/Shanghai" } = {}) {
  const offset = TIME_ZONE_OFFSETS[timeZone];
  if (!offset) throw new RangeError(`Unsupported fixture time zone: ${timeZone}`);

  const instant = new Date(`${fixture.date}T${fixture.time}:00${offset}`);
  if (Number.isNaN(instant.getTime())) throw new TypeError("fixture date and time must form a valid kickoff");
  return instant;
}

export function deriveEffectiveStatus(
  fixture,
  { now = new Date(), timeZone = "Asia/Shanghai" } = {}
) {
  if (!SUPPORTED_STATUSES.has(fixture.status)) {
    throw new RangeError(`Unsupported fixture status: ${fixture.status}`);
  }

  if (EXPLICIT_STATUSES.has(fixture.status) || fixture.status === "live") {
    return fixture.status;
  }

  const currentInstant = parseInstant(now, "now");
  const kickoffInstant = fixtureKickoffInstant(fixture, { timeZone });
  return currentInstant >= kickoffInstant ? "live" : "scheduled";
}

export function deriveScoreState(fixture) {
  const homeScoreIsValid = Number.isInteger(fixture.homeScore) && fixture.homeScore >= 0;
  const awayScoreIsValid = Number.isInteger(fixture.awayScore) && fixture.awayScore >= 0;
  const hasScore = homeScoreIsValid && awayScoreIsValid;

  return {
    hasScore,
    score: hasScore ? `${fixture.homeScore} : ${fixture.awayScore}` : null
  };
}

export function normalizeFixtureStatuses(
  data,
  { now = new Date(), timeZone = "Asia/Shanghai" } = {}
) {
  const effectiveStatusAt = parseInstant(now, "now").toISOString();
  return {
    ...structuredClone(data),
    effectiveStatusAt,
    fixtures: data.fixtures.map((fixture) => ({
      ...fixture,
      effectiveStatus: deriveEffectiveStatus(fixture, { now: effectiveStatusAt, timeZone })
    }))
  };
}
