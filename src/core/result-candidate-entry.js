import { validateFixtures } from "./fixtures-schema.js";
import { validateResultCandidates } from "./result-candidates-schema.js";

export class ResultCandidateEntryError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResultCandidateEntryError";
  }
}

export function listEligibleResultFixtures(fixturesData) {
  const fixtures = validateFixtures(fixturesData);
  return fixtures.fixtures.filter((fixture) =>
    !["cancelled", "postponed", "finished"].includes(fixture.status) &&
    (["scheduled", "live"].includes(fixture.status) || fixture.effectiveStatus === "live")
  );
}

export function selectResultFixture(input, fixtures) {
  const value = String(input ?? "").trim();
  if (value === "") throw new ResultCandidateEntryError("Fixture selection is required");
  if (/^\d+$/.test(value)) {
    const selected = fixtures[Number(value) - 1];
    if (selected) return selected;
  }
  const selected = fixtures.find((fixture) => fixture.id === value);
  if (!selected) throw new ResultCandidateEntryError(`Unknown fixture selection: ${value}`);
  return selected;
}

export function parseResultScore(input, label = "score") {
  const value = String(input ?? "").trim();
  if (!/^\d+$/.test(value)) {
    throw new ResultCandidateEntryError(`${label} must be a non-negative integer`);
  }
  const score = Number(value);
  if (!Number.isSafeInteger(score)) {
    throw new ResultCandidateEntryError(`${label} must be a safe non-negative integer`);
  }
  return score;
}

export function normalizeResultSource(input) {
  const source = String(input ?? "").trim();
  if (source === "") throw new ResultCandidateEntryError("source is required");
  return source;
}

export function normalizeResultSourceUrl(input) {
  const value = String(input ?? "").trim();
  if (value === "") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    return url.href;
  } catch {
    throw new ResultCandidateEntryError("sourceUrl must be an HTTP(S) URL or empty");
  }
}

function parseObservationInstant(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ResultCandidateEntryError("observedAt must be a valid ISO-8601 instant");
  }
  return new Date(value).toISOString();
}

function timestampToken(isoInstant) {
  return isoInstant.replace(/[-:.]/g, "");
}

export function createUniqueCandidateId(fixtureId, observedAt, existingIds = []) {
  const base = `${fixtureId}-result-${timestampToken(parseObservationInstant(observedAt))}`;
  const ids = new Set(existingIds);
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function pendingCandidatesForFixture(candidatesData, fixtureId) {
  const candidates = validateResultCandidates(candidatesData);
  return candidates.candidates.filter((candidate) =>
    candidate.fixtureId === fixtureId && candidate.reviewStatus === "candidate"
  );
}

export function appendResultCandidate({
  fixturesData,
  candidatesData,
  fixtureId,
  homeScore,
  awayScore,
  source,
  sourceUrl,
  observedAt
}) {
  const fixtures = validateFixtures(fixturesData);
  const candidates = validateResultCandidates(candidatesData);
  const eligible = listEligibleResultFixtures(fixtures);
  const fixture = eligible.find((item) => item.id === fixtureId);
  if (!fixture) {
    throw new ResultCandidateEntryError(`Fixture ${fixtureId} is not eligible for result entry`);
  }
  if (fixtures.league.id !== candidates.league.id ||
    fixtures.league.season !== candidates.league.season) {
    throw new ResultCandidateEntryError("Candidate league and season do not match fixtures");
  }

  const observationInstant = parseObservationInstant(observedAt);
  const candidate = {
    id: createUniqueCandidateId(
      fixture.id,
      observationInstant,
      candidates.candidates.map((item) => item.id)
    ),
    fixtureId: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeScore: parseResultScore(homeScore, "homeScore"),
    awayScore: parseResultScore(awayScore, "awayScore"),
    source: normalizeResultSource(source),
    sourceUrl: normalizeResultSourceUrl(sourceUrl),
    observedAt: observationInstant,
    reviewStatus: "candidate",
    confirmedAt: null
  };

  const updated = structuredClone(candidates);
  updated.updatedAt = observationInstant;
  updated.candidates.push(candidate);
  validateResultCandidates(updated);
  return { candidate, candidatesData: updated };
}

export function formatCandidatePreview(candidate, fixture) {
  return [
    "Candidate Preview",
    `ID:\n${candidate.id}`,
    `Fixture:\n${fixture.homeTeam} VS ${fixture.awayTeam}`,
    `Kickoff:\n${fixture.date} ${fixture.time}`,
    `Result:\n${candidate.homeTeam} ${candidate.homeScore} : ${candidate.awayScore} ${candidate.awayTeam}`,
    `Source:\n${candidate.source}`,
    `URL:\n${candidate.sourceUrl ?? "(empty)"}`,
    `Observed:\n${candidate.observedAt}`,
    `Review Status:\n${candidate.reviewStatus}`
  ].join("\n\n");
}

export async function persistCandidateIfApproved({ answer, candidatesData, persist }) {
  if (String(answer ?? "").trim() !== "ADD") return false;
  validateResultCandidates(candidatesData);
  await persist(candidatesData);
  return true;
}
