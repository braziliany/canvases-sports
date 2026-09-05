const EXPLICIT_STATUSES = new Set(["finished", "postponed", "cancelled"]);
export const FIXTURE_STATUSES = Object.freeze([
  "scheduled",
  "live",
  ...EXPLICIT_STATUSES
]);
const SUPPORTED_STATUSES = new Set(FIXTURE_STATUSES);
export const DISPLAY_ROUND_LEAD_HOURS = 24;

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

export function selectCurrentFixtures(
  data,
  {
    now = new Date(),
    timeZone = "Asia/Shanghai",
    leadHours = DISPLAY_ROUND_LEAD_HOURS
  } = {}
) {
  const currentInstant = parseInstant(now, "now");
  if (!Number.isFinite(leadHours) || leadHours < 0) {
    throw new RangeError("leadHours must be a non-negative number");
  }

  const groups = new Map();
  for (const fixture of data.fixtures) {
    const group = groups.get(fixture.round) ?? [];
    group.push(fixture);
    groups.set(fixture.round, group);
  }
  const rounds = [...groups.entries()]
    .map(([round, fixtures]) => ({
      round,
      fixtures,
      kickoff: Math.min(
        ...fixtures.map((fixture) =>
          fixtureKickoffInstant(fixture, { timeZone }).getTime()
        )
      )
    }))
    .sort((left, right) => left.kickoff - right.kickoff || left.round - right.round);

  if (rounds.length === 0) {
    return {
      displayRound: null,
      displaySelectionReason: "NO_FIXTURES",
      displayFixtures: []
    };
  }

  let selectedIndex = 0;
  for (let index = 1; index < rounds.length; index += 1) {
    const transitionAt = rounds[index].kickoff - leadHours * 60 * 60 * 1000;
    if (currentInstant.getTime() >= transitionAt) selectedIndex = index;
    else break;
  }

  const selected = rounds[selectedIndex];
  let displaySelectionReason;
  if (currentInstant.getTime() < selected.kickoff) {
    displaySelectionReason = selectedIndex === 0
      ? "NEXT_UPCOMING_ROUND"
      : "NEXT_ROUND_WINDOW";
  } else if (selectedIndex === rounds.length - 1) {
    displaySelectionReason = "FINAL_ROUND";
  } else if (selected.fixtures.every((fixture) =>
    ["finished", "postponed", "cancelled"].includes(fixture.effectiveStatus)
  )) {
    displaySelectionReason = "RECENT_TERMINAL_ROUND";
  } else {
    displaySelectionReason = "CURRENT_ROUND";
  }

  return {
    displayRound: selected.round,
    displaySelectionReason,
    displayFixtures: structuredClone(selected.fixtures)
  };
}

export function normalizeFixtureStatuses(
  data,
  { now = new Date(), timeZone = "Asia/Shanghai" } = {}
) {
  const effectiveStatusAt = parseInstant(now, "now").toISOString();
  const normalized = {
    ...structuredClone(data),
    effectiveStatusAt,
    fixtures: data.fixtures.map((fixture) => ({
      ...fixture,
      effectiveStatus: deriveEffectiveStatus(fixture, { now: effectiveStatusAt, timeZone })
    }))
  };
  return {
    ...normalized,
    ...selectCurrentFixtures(normalized, { now: effectiveStatusAt, timeZone })
  };
}
