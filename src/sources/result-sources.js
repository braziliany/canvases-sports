import { YANGTZE_EVENING_NEWS_ADAPTER } from "../adapters/results/yangtze-evening-news.js";
import {
  CHANGZHOU_SPORTS_BUREAU_ADAPTER,
  HUAIAN_POLICE_ADAPTER,
  YANGZHOU_RELEASE_ADAPTER
} from "../adapters/results/official-local-government.js";

const context = Object.freeze({
  leagueId: "jiangsu-city-football-league",
  season: 2026,
  round: 19,
  date: "2026-08-29"
});

export const RESULT_SOURCES = Object.freeze([
  Object.freeze({
    id: "yangtze-evening-news",
    publisherId: "xinhua-daily-media-group",
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
    id: "changzhou-sports-bureau",
    publisherId: "changzhou-sports-bureau",
    fileName: "2026-08-29-w19-changzhou-sports-bureau.json",
    adapter: CHANGZHOU_SPORTS_BUREAU_ADAPTER,
    name: "常州市体育局",
    type: "official",
    title: "苏超常州队主场比赛活动报道",
    url: "https://tyj.changzhou.gov.cn/html/tyj/2026/FMAJPNIE_0831/25514.html",
    requiredMarkers: Object.freeze(["2026苏超联赛第十九周", "常州队迎战", "无锡队"]),
    context
  }),
  Object.freeze({
    id: "huaian-police",
    publisherId: "huaian-police",
    fileName: "2026-08-29-w19-huaian-police.json",
    adapter: HUAIAN_POLICE_ADAPTER,
    name: "淮安市公安局",
    type: "official",
    title: "淮安公安全力护航苏超联赛主场赛事",
    url: "https://gaj.huaian.gov.cn/col/9105_151615/art/o/17881920/1788231205335x0MzpBwp.html",
    requiredMarkers: Object.freeze(["2026江苏省城市足球联赛", "常规赛第十九周", "淮安队", "连云港队"]),
    context
  }),
  Object.freeze({
    id: "yangzhou-release",
    publisherId: "yangzhou-release",
    fileName: "2026-08-29-w19-yangzhou-release.json",
    adapter: YANGZHOU_RELEASE_ADAPTER,
    name: "扬州发布",
    type: "official-republish",
    title: "苏超扬州队 vs 宿迁队终场发布",
    url: "https://www.sina.cn/news/detail/5337366958184883.html",
    requiredMarkers: Object.freeze(["扬州发布", "扬州队VS宿迁队整场比赛结束", "比分定格"]),
    contentLineMarkers: Object.freeze(["扬州队VS宿迁队整场比赛结束", "比分定格"]),
    context
  })
]);
