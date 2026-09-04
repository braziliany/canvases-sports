import { AdapterParseError, parseControlledFinalReport } from "./controlled-final-report.js";

export const YANGTZE_EVENING_NEWS_ADAPTER = "yangtze-evening-news-final-report-v1";

export function parseYangtzeEveningNewsResults(snapshot) {
  return parseControlledFinalReport(snapshot, {
    adapter: YANGTZE_EVENING_NEWS_ADAPTER,
    sourceType: "official-republish"
  });
}

export { AdapterParseError };
