import { YANGTZE_EVENING_NEWS_ADAPTER } from "../adapters/results/yangtze-evening-news.js";
import {
  CHANGZHOU_SPORTS_BUREAU_ADAPTER,
  HUAIAN_POLICE_ADAPTER,
  YANGZHOU_RELEASE_ADAPTER
} from "../adapters/results/official-local-government.js";
import {
  NANJING_MORNING_POST_WEEK20_ADAPTER,
  XINHUA_DAILY_WECHAT_WEEK20_ADAPTER
} from "../adapters/results/week20-final-reports.js";

const context = Object.freeze({
  leagueId: "jiangsu-city-football-league",
  season: 2026,
  round: 19,
  date: "2026-08-29"
});

const week20Context = Object.freeze({
  leagueId: "jiangsu-city-football-league",
  season: 2026,
  round: 20,
  date: "2026-09-05"
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
  }),
  Object.freeze({
    id: "xinhua-daily-wechat-week20",
    publisherId: "xinhua-daily-media-group",
    fileName: "2026-09-05-w20-xinhua-daily-wechat.json",
    adapter: XINHUA_DAILY_WECHAT_WEEK20_ADAPTER,
    name: "新华日报微信公众号（扬子晚报转载）",
    type: "official-republish",
    title: "“苏超”积分榜更新！无锡队盐城队宿迁队暂列前三",
    url: "https://www.yzwb.net/news/qjsc/202609/t20260905_389881.html",
    requiredMarkers: Object.freeze([
      "第20周比赛结束",
      "连云港队0:1南通队",
      "盐城队1:1徐州队",
      "南京队2:2泰州队"
    ]),
    context: week20Context
  }),
  Object.freeze({
    id: "nanjing-morning-post-week20",
    publisherId: "nanjing-daily-media-group",
    fileName: "2026-09-05-w20-nanjing-morning-post.json",
    adapter: NANJING_MORNING_POST_WEEK20_ADAPTER,
    name: "南京晨报（新浪财经转载）",
    type: "trusted-media",
    title: "“苏超”抢“八”白热化，悬念留至最后时刻",
    url: "https://finance.sina.com.cn/jjxw/2026-09-07/doc-iniqxiqs6133523.shtml",
    requiredMarkers: Object.freeze([
      "来源：南京晨报",
      "最终以2比2握手言和",
      "盐城队1比1战平徐州队",
      "0比1不敌南通队"
    ]),
    context: week20Context
  })
]);
