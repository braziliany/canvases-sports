import { appendResultCandidate } from "./result-candidate-entry.js";
import { validateResultCandidates } from "./result-candidates-schema.js";
import { matchResultObservationToFixture } from "./result-fixture-matcher.js";
import { validateResultObservation } from "./result-observation.js";

function isExactDuplicate(candidate, fixtureId, observation) {
  return candidate.fixtureId === fixtureId &&
    candidate.homeScore === observation.homeScore &&
    candidate.awayScore === observation.awayScore &&
    candidate.sourceUrl === observation.sourceUrl;
}

export function createCandidateFromObservation({
  observation: observationData,
  fixture,
  fixturesData,
  candidatesData
}) {
  const observation = validateResultObservation(observationData);
  if (fixture.homeTeam !== observation.homeTeam || fixture.awayTeam !== observation.awayTeam) {
    throw new TypeError(`Observation teams do not match fixture ${fixture.id}`);
  }
  return appendResultCandidate({
    fixturesData,
    candidatesData,
    fixtureId: fixture.id,
    homeScore: observation.homeScore,
    awayScore: observation.awayScore,
    source: observation.source,
    sourceUrl: observation.sourceUrl,
    observedAt: observation.observedAt
  });
}

export function discoverResultCandidates({ observations, fixturesData, candidatesData }) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  let updatedCandidates = validateResultCandidates(candidatesData);
  const discovered = [];
  const duplicates = [];
  const failures = [];

  for (const observationData of observations) {
    try {
      const observation = validateResultObservation(observationData);
      const fixture = matchResultObservationToFixture(observation, fixturesData);
      const duplicate = updatedCandidates.candidates.find((candidate) =>
        isExactDuplicate(candidate, fixture.id, observation)
      );
      if (duplicate) {
        duplicates.push({ observation, fixtureId: fixture.id, candidateId: duplicate.id });
        continue;
      }
      const prepared = createCandidateFromObservation({
        observation,
        fixture,
        fixturesData,
        candidatesData: updatedCandidates
      });
      updatedCandidates = prepared.candidatesData;
      discovered.push({ observation, fixture, candidate: prepared.candidate });
    } catch (error) {
      failures.push({
        observation: structuredClone(observationData),
        errorName: error.name,
        message: error.message
      });
    }
  }

  return {
    candidatesData: validateResultCandidates(updatedCandidates),
    discovered,
    duplicates,
    failures
  };
}
