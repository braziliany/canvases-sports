import { parseControlledResultStatement } from "./controlled-final-report.js";

export const CHANGZHOU_SPORTS_BUREAU_ADAPTER = "changzhou-sports-bureau-final-result-v1";
export const HUAIAN_POLICE_ADAPTER = "huaian-police-final-result-v1";
export const YANGZHOU_RELEASE_ADAPTER = "yangzhou-release-final-result-v1";

export function parseChangzhouSportsBureauResult(snapshot) {
  return parseControlledResultStatement(snapshot, {
    adapter: CHANGZHOU_SPORTS_BUREAU_ADAPTER,
    sourceType: "official",
    homeTeam: "常州",
    awayTeam: "无锡",
    scorePattern: /(?<homeScore>\d+)\s*[:：]\s*(?<awayScore>\d+)\s*常州队遗憾落败/u
  });
}

export function parseHuaianPoliceResult(snapshot) {
  return parseControlledResultStatement(snapshot, {
    adapter: HUAIAN_POLICE_ADAPTER,
    sourceType: "official",
    homeTeam: "淮安",
    awayTeam: "连云港",
    scorePattern: /淮安队\s*(?<homeScore>\d+)\s*[:：]\s*(?<awayScore>\d+)\s*连云港队/u
  });
}

export function parseYangzhouReleaseResult(snapshot) {
  return parseControlledResultStatement(snapshot, {
    adapter: YANGZHOU_RELEASE_ADAPTER,
    sourceType: "official-republish",
    homeTeam: "扬州",
    awayTeam: "宿迁",
    scorePattern: /比分定格在宿迁队\s*(?<awayScore>\d+)\s*[:：]\s*(?<homeScore>\d+)\s*扬州队/u
  });
}
