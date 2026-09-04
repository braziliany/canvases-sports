import { YANGTZE_EVENING_NEWS_ADAPTER } from "../adapters/results/yangtze-evening-news.js";
import { XINHUA_DAILY_HUAWEI_ADAPTER } from "../adapters/results/xinhua-daily-huawei.js";

const context = Object.freeze({
  leagueId: "jiangsu-city-football-league",
  season: 2026,
  round: 19,
  date: "2026-08-29"
});

export const RESULT_SOURCES = Object.freeze([
  Object.freeze({
    id: "yangtze-evening-news",
    fileName: "2026-08-29-w19-yangzi-evening-news.json",
    adapter: YANGTZE_EVENING_NEWS_ADAPTER,
    name: "扬子晚报/紫牛新闻",
    type: "official-republish",
    title: "“苏超”第19周比赛最终战报",
    url: "https://wap.yzwb.net/wap/news/5004565.html",
    requiredMarkers: Object.freeze(["第19周比赛最终战报", "淮安队2:0连云港队"]),
    context
  }),
  Object.freeze({
    id: "xinhua-daily-huawei",
    fileName: "2026-08-29-w19-xinhua-daily-huawei.json",
    adapter: XINHUA_DAILY_HUAWEI_ADAPTER,
    name: "新华日报（华为资讯官方账号）",
    type: "official-republish",
    title: "“苏超”积分榜更新！无锡队盐城队宿迁队暂列前三",
    url: "https://feeds-drcn.cloud.huawei.com.cn/landingpage/latest?channel=HW_JINGXUAN_ZH&cpid=666&ctype=news&docid=1051754ID2BEE8J44UHZRN&dy_scenario=relate&emuiVer=27&pageType=26&r=CN&tn=9e440d31fbc2c0f47f7bd803df36c0eb7d63e2a759dc117f448b109d7e01f61e&to_app=hwbrowser",
    requiredMarkers: Object.freeze(["新华日报官方账号", "常州队1：5无锡队"]),
    context
  })
]);
