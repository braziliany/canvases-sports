export const JIANGSU_CONFIG = Object.freeze({
  leagueId: "jiangsu-city-football-league",
  season: 2026,
  teamCount: 13,
  qualificationCount: 8,
  sourceColumnUrl: "https://jsstyj.jiangsu.gov.cn/col/col93442/index.html",
  scoring: { win: 3, draw: 1, loss: 0 },
  tieBreakers: [
    "points", "headToHeadPoints", "headToHeadGoalDifference",
    "headToHeadGoalsFor", "goalDifference", "goalsFor", "fairPlay", "draw"
  ]
});
