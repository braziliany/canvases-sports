import { validateResultObservation } from "../../core/result-observation.js";

export const YANGTZE_EVENING_NEWS_ADAPTER = "yangtze-evening-news-final-report-v1";

export class AdapterParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdapterParseError";
  }
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function assertSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new AdapterParseError("Snapshot must be an object");
  if (snapshot.schemaVersion !== 1) throw new AdapterParseError("Unsupported snapshot schemaVersion");
  if (snapshot.adapter !== YANGTZE_EVENING_NEWS_ADAPTER) {
    throw new AdapterParseError(`Unsupported adapter: ${snapshot.adapter}`);
  }
  if (typeof snapshot?.source?.name !== "string" || snapshot.source.name.trim() === "") {
    throw new AdapterParseError("Snapshot source.name is required");
  }
  if (snapshot.source.type !== "official-republish") {
    throw new AdapterParseError("Snapshot source.type must be official-republish");
  }
  if (!isHttpUrl(snapshot.source.url)) throw new AdapterParseError("Snapshot source.url must be HTTP(S)");
  if (typeof snapshot.source.retrievedAt !== "string" ||
    Number.isNaN(Date.parse(snapshot.source.retrievedAt))) {
    throw new AdapterParseError("Snapshot source.retrievedAt must be ISO-8601");
  }
  if (typeof snapshot?.context?.leagueId !== "string" || snapshot.context.leagueId.trim() === "" ||
    !Number.isInteger(snapshot?.context?.season) ||
    !Number.isInteger(snapshot?.context?.round) ||
    typeof snapshot?.context?.date !== "string") {
    throw new AdapterParseError("Snapshot context must contain leagueId, season, round, and date");
  }
  if (typeof snapshot.rawText !== "string" || snapshot.rawText.trim() === "") {
    throw new AdapterParseError("Snapshot rawText is required");
  }
}

function parseScore(value, label) {
  if (!/^\d+$/.test(value)) throw new AdapterParseError(`${label} is not a non-negative integer`);
  const score = Number(value);
  if (!Number.isSafeInteger(score)) throw new AdapterParseError(`${label} is outside the safe integer range`);
  return score;
}

export function parseYangtzeEveningNewsResults(snapshot) {
  assertSnapshot(snapshot);
  const observations = [];
  const matchKeys = new Set();
  const scoreLine = /^(?<homeTeam>[^\d:：]+?)队\s*(?<homeScore>\d+)\s*[:：]\s*(?<awayScore>\d+)\s*(?<awayTeam>[^（(]+?)队(?:[（(].*)?$/u;

  for (const rawLine of snapshot.rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = line.match(scoreLine);
    if (!match) continue;
    const observation = validateResultObservation({
      leagueId: snapshot.context.leagueId.trim(),
      homeTeam: match.groups.homeTeam.trim(),
      awayTeam: match.groups.awayTeam.trim(),
      homeScore: parseScore(match.groups.homeScore, "homeScore"),
      awayScore: parseScore(match.groups.awayScore, "awayScore"),
      source: snapshot.source.name.trim(),
      sourceType: snapshot.source.type,
      sourceUrl: new URL(snapshot.source.url).href,
      observedAt: new Date(snapshot.source.retrievedAt).toISOString(),
      season: snapshot.context.season,
      round: snapshot.context.round,
      matchDate: snapshot.context.date
    });
    const key = `${observation.homeTeam}\u0000${observation.awayTeam}`;
    if (matchKeys.has(key)) {
      throw new AdapterParseError(`Snapshot contains duplicate result lines for ${observation.homeTeam} / ${observation.awayTeam}`);
    }
    matchKeys.add(key);
    observations.push(observation);
  }

  if (observations.length === 0) {
    throw new AdapterParseError("No supported final-result lines were found in snapshot rawText");
  }
  return observations;
}
