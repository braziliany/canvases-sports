import { normalizeFixtureStatuses } from "../../src/core/fixture-state.js";

const DEFAULT_NOW = "2026-08-29T13:33:14.115Z";

export function createUnsettledWeek19Fixtures(publishedFixtures, { now = DEFAULT_NOW } = {}) {
  const data = structuredClone(publishedFixtures);
  data.fixtures = data.fixtures
    .filter((fixture) => fixture.round === 19)
    .map((fixture) => {
      const isolated = structuredClone(fixture);
      delete isolated.kickoff;
      delete isolated.provenance;
      return {
        ...isolated,
        status: "scheduled",
        effectiveStatus: "live",
        homeScore: null,
        awayScore: null
      };
    });

  delete data.scheduleSources;
  delete data.displayRound;
  delete data.displaySelectionReason;
  delete data.displayFixtures;
  data.updatedAt = new Date(now).toISOString();
  data.effectiveStatusAt = new Date(now).toISOString();

  const normalized = normalizeFixtureStatuses(data, { now });
  delete normalized.displayRound;
  delete normalized.displaySelectionReason;
  delete normalized.displayFixtures;
  return normalized;
}
