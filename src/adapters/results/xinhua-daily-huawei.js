import { parseControlledFinalReport } from "./controlled-final-report.js";

export const XINHUA_DAILY_HUAWEI_ADAPTER = "xinhua-daily-huawei-final-report-v1";

export function parseXinhuaDailyHuaweiResults(snapshot) {
  return parseControlledFinalReport(snapshot, {
    adapter: XINHUA_DAILY_HUAWEI_ADAPTER,
    sourceType: "official-republish"
  });
}
