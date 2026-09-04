import { buildJiangsuStandings } from "../leagues/jiangsu/standings-builder.js";
import { validateFixtures } from "./fixtures-schema.js";
import { discoverResultCandidates } from "./result-discovery.js";
import { RECONCILIATION_STATUS, reconcileResultObservations } from "./result-reconciliation.js";
import { validateResultCandidates } from "./result-candidates-schema.js";
import { settleResultCandidate } from "./result-settlement.js";
import { validateStandings } from "./schema.js";

export function prepareProductionResultSync({ source, rankingReference, fixturesData, candidatesData, observations, confirmedAt }) {
  let fixtures = validateFixtures(fixturesData);
  let candidates = validateResultCandidates(candidatesData);
  const reconciliation = reconcileResultObservations({ observations, fixturesData: fixtures });
  if (reconciliation.failures.length) {
    throw new Error(`Production reconciliation failed: ${reconciliation.failures.map((x) => x.message).join("; ")}`);
  }

  const unsettledFixtureIds = new Set(reconciliation.decisions
    .filter((decision) => decision.status !== RECONCILIATION_STATUS.ALREADY_SETTLED)
    .map((decision) => decision.fixtureId));
  const discovery = discoverResultCandidates({
    observations: reconciliation.matched
      .filter(({ fixture }) => unsettledFixtureIds.has(fixture.id))
      .map(({ observation }) => observation),
    fixturesData: fixtures,
    candidatesData: candidates
  });
  if (discovery.failures.length) {
    throw new Error(`Candidate discovery failed: ${discovery.failures.map((x) => x.message).join("; ")}`);
  }
  candidates = discovery.candidatesData;

  const settlements = [];
  for (const decision of reconciliation.decisions) {
    if (decision.status !== RECONCILIATION_STATUS.AUTO_SETTLE) continue;
    const evidenceUrls = new Set(decision.evidence.map(({ observation }) => observation.sourceUrl));
    const matchingCandidates = candidates.candidates.filter((candidate) =>
      candidate.fixtureId === decision.fixtureId &&
      candidate.homeScore === decision.score[0] && candidate.awayScore === decision.score[1] &&
      evidenceUrls.has(candidate.sourceUrl));
    for (const candidate of matchingCandidates) {
      if (candidate.reviewStatus === "confirmed") continue;
      const prepared = settleResultCandidate({
        fixturesData: fixtures,
        candidatesData: candidates,
        candidateId: candidate.id,
        confirmedAt
      });
      fixtures = prepared.fixturesData;
      candidates = prepared.candidatesData;
      settlements.push(prepared.outcome);
    }
  }

  const standings = validateStandings(buildJiangsuStandings({ source, fixturesData: fixtures, rankingReference }));
  return {
    fixturesData: validateFixtures(fixtures),
    candidatesData: validateResultCandidates(candidates),
    standingsData: standings,
    reconciliation,
    discovery,
    settlements
  };
}
