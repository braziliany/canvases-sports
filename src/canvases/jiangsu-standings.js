export function buildJiangsuCanvasModel(data, { stale = false } = {}) {
  return {
    title: data.league.name,
    subtitle: `${data.league.season} · 常规赛`,
    updatedAt: data.updatedAt,
    stale,
    qualificationLabel: `TOP ${data.qualification.count} · ${data.qualification.label}`,
    rows: data.standings.map((row) => ({
      ...row,
      qualified: row.rank <= data.qualification.count,
      trendLabel: row.trend > 0 ? `↑${row.trend}` : row.trend < 0 ? `↓${Math.abs(row.trend)}` : "—",
      goalDifferenceLabel: row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference)
    }))
  };
}
