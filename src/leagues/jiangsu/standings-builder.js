import { fixtureKickoffInstant } from "../../core/fixture-state.js";
import { validateFixtures } from "../../core/fixtures-schema.js";
import { validateStandings } from "../../core/schema.js";
import { calculateStandings, isCountedResult } from "../../core/standings-calculator.js";
import { adaptJiangsuSnapshot } from "./adapter.js";
import { JIANGSU_CONFIG } from "./config.js";

export function buildJiangsuStandings({ source, fixturesData, rankingReference = null }) {
  const fixtures = validateFixtures(fixturesData);
  const baseline = adaptJiangsuSnapshot(source);
  const baselineInstant = new Date(source.publishedAt);
  const postBaselineFixtures = fixtures.fixtures.filter((fixture) =>
    fixtureKickoffInstant(fixture) > baselineInstant
  );
  const countedIds = new Set(postBaselineFixtures.filter(isCountedResult).map((fixture) => fixture.id));
  const references = (Array.isArray(rankingReference) ? rankingReference : [rankingReference])
    .filter(Boolean);
  const applicableReference = references.find((reference) => {
    const requiredFixtureIds = reference?.requiredFixtureIds;
    return Array.isArray(requiredFixtureIds) &&
      new Set(requiredFixtureIds).size === requiredFixtureIds.length &&
      countedIds.size === requiredFixtureIds.length &&
      requiredFixtureIds.every((id) => countedIds.has(id));
  }) ?? null;

  return validateStandings(calculateStandings({
    baseline,
    fixtures: postBaselineFixtures,
    scoring: JIANGSU_CONFIG.scoring,
    updatedAt: fixtures.updatedAt,
    rankingReference: applicableReference
  }));
}
