import { validateFixtures } from "./fixtures-schema.js";
import { validateResultCandidates } from "./result-candidates-schema.js";
import { settleResultCandidate } from "./result-settlement.js";
import { validateStandings } from "./schema.js";
import { buildJiangsuStandings } from "../leagues/jiangsu/standings-builder.js";

export function prepareResultSettlement({
  source,
  fixturesData,
  candidatesData,
  candidateId,
  confirmedAt
}) {
  const settlement = settleResultCandidate({
    fixturesData,
    candidatesData,
    candidateId,
    confirmedAt
  });
  const standingsData = buildJiangsuStandings({
    source,
    fixturesData: settlement.fixturesData
  });

  validateFixtures(settlement.fixturesData);
  validateResultCandidates(settlement.candidatesData);
  validateStandings(standingsData);
  return { ...settlement, standingsData };
}

export async function executePreparedSettlement({ prepare, verify, commit }) {
  const prepared = await prepare();
  await verify(prepared);
  await commit(prepared);
  return prepared;
}
