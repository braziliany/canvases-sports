import { matchResultObservationToFixture } from "./result-fixture-matcher.js";
import { validateResultObservation } from "./result-observation.js";

export const RECONCILIATION_STATUS = Object.freeze({
  AUTO_SETTLE: "AUTO_SETTLE",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  ALREADY_SETTLED: "ALREADY_SETTLED"
});

function scoreKey(item) { return `${item.homeScore}:${item.awayScore}`; }
function evidenceKey(item) {
  const url = new URL(item.sourceUrl);
  return `${item.source.trim().toLowerCase()}|${url.hostname.toLowerCase()}`;
}

export function reconcileResultObservations({ observations, fixturesData }) {
  const matched = [];
  const failures = [];
  const exactKeys = new Set();
  for (const raw of observations) {
    try {
      const observation = validateResultObservation(raw);
      const fixture = matchResultObservationToFixture(observation, fixturesData);
      const key = `${fixture.id}|${scoreKey(observation)}|${observation.sourceUrl}`;
      if (exactKeys.has(key)) continue;
      exactKeys.add(key);
      matched.push({ fixture, observation });
    } catch (error) {
      failures.push({ errorName: error.name, message: error.message, observation: structuredClone(raw) });
    }
  }

  const groups = new Map();
  for (const item of matched) {
    if (!groups.has(item.fixture.id)) groups.set(item.fixture.id, []);
    groups.get(item.fixture.id).push(item);
  }
  const decisions = [];
  for (const [fixtureId, evidence] of groups) {
    const fixture = evidence[0].fixture;
    const trusted = evidence.filter(({ observation }) =>
      ["official", "official-republish", "trusted-media"].includes(observation.sourceType));
    const scoreGroups = new Map();
    for (const item of trusted) {
      const key = scoreKey(item.observation);
      if (!scoreGroups.has(key)) scoreGroups.set(key, []);
      scoreGroups.get(key).push(item);
    }

    let status = RECONCILIATION_STATUS.NEEDS_REVIEW;
    let reason = "insufficient independent trusted evidence";
    let agreedScore = null;
    if (scoreGroups.size > 1) {
      reason = "trusted sources report conflicting scores";
    } else if (scoreGroups.size === 1) {
      const [[key, agreeing]] = scoreGroups;
      const independentSources = new Set(agreeing.map(({ observation }) => evidenceKey(observation)));
      const hasOfficial = agreeing.some(({ observation }) => observation.sourceType === "official");
      const eligibleCorroboration = agreeing.filter(({ observation }) =>
        ["official-republish", "trusted-media"].includes(observation.sourceType));
      const eligibleIndependent = new Set(eligibleCorroboration.map(({ observation }) => evidenceKey(observation)));
      if (hasOfficial || eligibleIndependent.size >= 2) {
        agreedScore = key.split(":").map(Number);
        if (fixture.status === "finished") {
          status = fixture.homeScore === agreedScore[0] && fixture.awayScore === agreedScore[1]
            ? RECONCILIATION_STATUS.ALREADY_SETTLED
            : RECONCILIATION_STATUS.NEEDS_REVIEW;
          reason = status === RECONCILIATION_STATUS.ALREADY_SETTLED
            ? "authoritative fixture already has the corroborated score"
            : "corroborated score conflicts with authoritative fixture";
        } else {
          status = RECONCILIATION_STATUS.AUTO_SETTLE;
          reason = hasOfficial
            ? "official source with no trusted conflict"
            : `${eligibleIndependent.size} independent trusted sources agree`;
        }
      }
    }
    decisions.push({ fixtureId, fixture, status, reason, score: agreedScore, evidence });
  }
  return { matched, failures, decisions };
}
