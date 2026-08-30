import { validateFixtures } from "./fixtures-schema.js";
import { validateResultCandidates } from "./result-candidates-schema.js";

export class ResultSettlementError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResultSettlementError";
  }
}

export class ResultConflictError extends ResultSettlementError {
  constructor(message) {
    super(message);
    this.name = "ResultConflictError";
  }
}

function parseConfirmationInstant(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ResultSettlementError("confirmedAt must be a valid ISO-8601 instant");
  }
  return new Date(value).toISOString();
}

function scoresMatch(fixture, candidate) {
  return fixture.homeScore === candidate.homeScore &&
    fixture.awayScore === candidate.awayScore;
}

function assertCandidateMatchesFixture(candidate, fixture) {
  if (candidate.homeTeam !== fixture.homeTeam || candidate.awayTeam !== fixture.awayTeam) {
    throw new ResultSettlementError(
      `Candidate ${candidate.id} teams do not match fixture ${fixture.id}`
    );
  }
}

export function formatResultCandidateReview(candidate, fixture) {
  return [
    `比赛：\n${fixture.homeTeam} VS ${fixture.awayTeam}`,
    `开球：\n${fixture.date} ${fixture.time}`,
    `当前正式状态：\n${fixture.status}`,
    `候选终场比分：\n${candidate.homeTeam} ${candidate.homeScore} : ${candidate.awayScore} ${candidate.awayTeam}`,
    `来源：\n${candidate.source}${candidate.sourceUrl ? `\n${candidate.sourceUrl}` : ""}`,
    `采集时间：\n${candidate.observedAt}`
  ].join("\n\n");
}

export function settleResultCandidate({
  fixturesData,
  candidatesData,
  candidateId,
  confirmedAt
}) {
  const fixtures = validateFixtures(fixturesData);
  const candidates = validateResultCandidates(candidatesData);
  const confirmationInstant = parseConfirmationInstant(confirmedAt);

  if (fixtures.league.id !== candidates.league.id ||
    fixtures.league.season !== candidates.league.season) {
    throw new ResultSettlementError("Candidate league and season do not match fixtures");
  }

  const candidate = candidates.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new ResultSettlementError(`Unknown result candidate: ${candidateId}`);
  const fixture = fixtures.fixtures.find((item) => item.id === candidate.fixtureId);
  if (!fixture) {
    throw new ResultSettlementError(
      `Candidate ${candidate.id} references unknown fixture ${candidate.fixtureId}`
    );
  }
  assertCandidateMatchesFixture(candidate, fixture);

  if (Date.parse(confirmationInstant) < Date.parse(candidate.observedAt)) {
    throw new ResultSettlementError("Confirmation time cannot precede observation time");
  }
  if (["cancelled", "postponed"].includes(fixture.status)) {
    throw new ResultSettlementError(
      `Cannot settle ${fixture.status} fixture ${fixture.id} without correcting its authoritative status`
    );
  }
  if (candidate.reviewStatus === "confirmed" && fixture.status !== "finished") {
    throw new ResultSettlementError(
      `Candidate ${candidate.id} is confirmed but fixture ${fixture.id} is not authoritative finished`
    );
  }

  if (fixture.status === "finished") {
    if (!scoresMatch(fixture, candidate)) {
      throw new ResultConflictError(
        `Fixture ${fixture.id} is already finished ${fixture.homeScore}:${fixture.awayScore}; ` +
        `candidate proposes ${candidate.homeScore}:${candidate.awayScore}`
      );
    }
    if (candidate.reviewStatus === "confirmed") {
      return {
        fixturesData: fixtures,
        candidatesData: candidates,
        outcome: { fixtureId: fixture.id, candidateId, idempotent: true, changed: false }
      };
    }
  } else if (!["scheduled", "live"].includes(fixture.status)) {
    throw new ResultSettlementError(`Fixture ${fixture.id} cannot be settled from status ${fixture.status}`);
  }

  const updatedFixtures = structuredClone(fixtures);
  const updatedFixture = updatedFixtures.fixtures.find((item) => item.id === fixture.id);
  const fixtureWasAlreadySettled = updatedFixture.status === "finished";
  if (!fixtureWasAlreadySettled) {
    updatedFixture.status = "finished";
    updatedFixture.effectiveStatus = "finished";
    updatedFixture.homeScore = candidate.homeScore;
    updatedFixture.awayScore = candidate.awayScore;
    updatedFixtures.updatedAt = confirmationInstant;
    updatedFixtures.effectiveStatusAt = confirmationInstant;
  }

  const updatedCandidates = structuredClone(candidates);
  const updatedCandidate = updatedCandidates.candidates.find((item) => item.id === candidate.id);
  updatedCandidate.reviewStatus = "confirmed";
  updatedCandidate.confirmedAt = confirmationInstant;
  updatedCandidates.updatedAt = confirmationInstant;

  validateFixtures(updatedFixtures);
  validateResultCandidates(updatedCandidates);
  return {
    fixturesData: updatedFixtures,
    candidatesData: updatedCandidates,
    outcome: {
      fixtureId: fixture.id,
      candidateId,
      idempotent: fixtureWasAlreadySettled,
      changed: true
    }
  };
}
