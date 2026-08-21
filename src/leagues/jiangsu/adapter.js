import { JIANGSU_CONFIG } from "./config.js";
import { validateStandings } from "../../core/schema.js";

export function adaptJiangsuSnapshot(source) {
  const standings = source.rows.map((row) => ({
    rank: row.rank,
    previousRank: row.previousRank ?? null,
    trend: row.previousRank == null ? null : row.previousRank - row.rank,
    team: { id: row.id, name: row.team, shortName: row.team, logo: null },
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.points
  }));

  return validateStandings({
    schemaVersion: 1,
    league: {
      id: JIANGSU_CONFIG.leagueId,
      name: "江苏省城市足球联赛",
      shortName: "苏超",
      season: JIANGSU_CONFIG.season
    },
    updatedAt: source.publishedAt,
    stage: "regular-season",
    qualification: { type: "top", count: JIANGSU_CONFIG.qualificationCount, label: "晋级淘汰赛" },
    source: source.source,
    standings
  });
}
