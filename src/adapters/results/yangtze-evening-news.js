import { AdapterParseError, parseControlledFinalReport } from "./controlled-final-report.js";

export const YANGTZE_EVENING_NEWS_ADAPTER = "yangtze-evening-news-final-report-v1";

export function parseYangtzeEveningNewsResults(snapshot) {
  return parseControlledFinalReport(snapshot, {
    adapter: YANGTZE_EVENING_NEWS_ADAPTER,
    sourceType: "official-republish",
    expectedMatches: [["淮安", "连云港"], ["常州", "无锡"], ["扬州", "宿迁"]]
  });
}

export { AdapterParseError };
