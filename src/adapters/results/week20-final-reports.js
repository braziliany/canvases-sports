import {
  AdapterParseError,
  parseControlledFinalReport,
  parseControlledResultStatement
} from "./controlled-final-report.js";

export const XINHUA_DAILY_WECHAT_WEEK20_ADAPTER =
  "xinhua-daily-wechat-week20-final-report-v1";
export const NANJING_MORNING_POST_WEEK20_ADAPTER =
  "nanjing-morning-post-week20-final-report-v1";

const WEEK20_MATCHES = Object.freeze([
  Object.freeze(["连云港", "南通"]),
  Object.freeze(["盐城", "徐州"]),
  Object.freeze(["南京", "泰州"])
]);

export function parseXinhuaDailyWechatWeek20Results(snapshot) {
  return parseControlledFinalReport(snapshot, {
    adapter: XINHUA_DAILY_WECHAT_WEEK20_ADAPTER,
    sourceType: "official-republish",
    expectedMatches: WEEK20_MATCHES
  });
}

export function parseNanjingMorningPostWeek20Results(snapshot) {
  const common = {
    adapter: NANJING_MORNING_POST_WEEK20_ADAPTER,
    sourceType: "trusted-media"
  };
  return [
    ...parseControlledResultStatement(snapshot, {
      ...common,
      homeTeam: "连云港",
      awayTeam: "南通",
      scorePattern: /连云港\s*队\s*(?<homeScore>\d+)\s*比\s*(?<awayScore>\d+)\s*不敌南通队/u
    }),
    ...parseControlledResultStatement(snapshot, {
      ...common,
      homeTeam: "盐城",
      awayTeam: "徐州",
      scorePattern: /盐城队\s*(?<homeScore>\d+)\s*比\s*(?<awayScore>\d+)\s*战平徐州队/u
    }),
    ...parseControlledResultStatement(snapshot, {
      ...common,
      homeTeam: "南京",
      awayTeam: "泰州",
      scorePattern: /南京队和泰州队[\s\S]*?最终以\s*(?<homeScore>\d+)\s*比\s*(?<awayScore>\d+)\s*握手言和/u
    })
  ];
}

export { AdapterParseError };
