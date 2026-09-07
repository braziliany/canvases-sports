import { parseYangtzeEveningNewsResults } from "./yangtze-evening-news.js";
import {
  parseChangzhouSportsBureauResult,
  parseHuaianPoliceResult,
  parseYangzhouReleaseResult
} from "./official-local-government.js";
import {
  parseNanjingMorningPostWeek20Results,
  parseXinhuaDailyWechatWeek20Results
} from "./week20-final-reports.js";

export const RESULT_ADAPTERS = new Map([
  ["yangtze-evening-news-final-report-v1", parseYangtzeEveningNewsResults],
  ["changzhou-sports-bureau-final-result-v1", parseChangzhouSportsBureauResult],
  ["huaian-police-final-result-v1", parseHuaianPoliceResult],
  ["yangzhou-release-final-result-v1", parseYangzhouReleaseResult],
  ["xinhua-daily-wechat-week20-final-report-v1", parseXinhuaDailyWechatWeek20Results],
  ["nanjing-morning-post-week20-final-report-v1", parseNanjingMorningPostWeek20Results]
]);
