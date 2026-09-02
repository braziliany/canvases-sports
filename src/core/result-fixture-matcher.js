import { validateFixtures } from "./fixtures-schema.js";
import { validateResultObservation } from "./result-observation.js";

export class FixtureMatchError extends Error {
  constructor(message, observation) {
    super(message);
    this.name = "FixtureMatchError";
    this.observation = structuredClone(observation);
  }
}

export class AmbiguousFixtureError extends FixtureMatchError {
  constructor(message, observation, fixtureIds) {
    super(message, observation);
    this.name = "AmbiguousFixtureError";
    this.fixtureIds = [...fixtureIds];
  }
}

export function matchResultObservationToFixture(observationData, fixturesData) {
  const observation = validateResultObservation(observationData);
  const fixtures = validateFixtures(fixturesData);
  if (observation.leagueId !== fixtures.league.id) {
    throw new FixtureMatchError(
      `No fixture match: observation league ${observation.leagueId} does not equal ${fixtures.league.id}`,
      observation
    );
  }
  if (observation.season !== fixtures.league.season) {
    throw new FixtureMatchError(
      `No fixture match: observation season ${observation.season} does not equal ${fixtures.league.season}`,
      observation
    );
  }

  const matches = fixtures.fixtures.filter((fixture) =>
    fixture.round === observation.round &&
    fixture.date === observation.matchDate &&
    fixture.homeTeam === observation.homeTeam &&
    fixture.awayTeam === observation.awayTeam
  );
  if (matches.length === 0) {
    throw new FixtureMatchError(
      `No fixture match for ${observation.matchDate} round ${observation.round}: ` +
      `${observation.homeTeam} VS ${observation.awayTeam}`,
      observation
    );
  }
  if (matches.length > 1) {
    throw new AmbiguousFixtureError(
      `Ambiguous fixture match for ${observation.homeTeam} VS ${observation.awayTeam}`,
      observation,
      matches.map((fixture) => fixture.id)
    );
  }
  return structuredClone(matches[0]);
}
