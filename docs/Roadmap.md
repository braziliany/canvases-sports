# Roadmap

## v0.1 — 江苏省城市足球联赛积分榜

- ✅ GitHub Data + Unified Schema + Validation
- ✅ Shortcut 与 Canvases Grid Template 真机闭环
- ✅ 13 行 Template 动态生成与链式 View Update
- ✅ Repeat Results → `standings-grid.Children` → Widget
- ✅ Web Reference Renderer（调试 / 校验 / 桌面预览）

状态：**Canvases Sports v0.1 Dynamic Standings PoC COMPLETE**。

## v0.2 — Dynamic Fixtures

### Phase 1 · Data Layer

- ✅ 官方赛程来源调查与人工复核流程
- ✅ Fixtures Schema 与统一状态映射
- ✅ `data/fixtures.json`（第 19 周首批 3 场）
- ✅ ID、日期、时间、球队、比分状态与排序校验
- ✅ 完全离线的 fixtures 测试
- ✅ Shortcut / `match-row` / View IDs
- ✅ 六状态设备测试夹具
- ✅ 状态映射与比分容错真机验证
- ✅ 状态/比分解耦与 Less is More 原则归档
- ✅ Effective Match Status 与 2026-08-29 20:53 实战回归
- ✅ Finished fixtures → standings 的确定性结算层
- ✅ ResultCandidate 隔离层与人工确认入口
- ✅ 冲突/幂等规则和失败回滚式原子结算
- ✅ 2026-08-29 三场 mock candidate 结构回归
- ✅ `results:add` 人工 Candidate 录入入口
- ✅ Candidate 唯一 ID、多来源共存和安全单文件写入
- ⏳ 完整历史 fixtures、公平竞赛积分与抽签顺序
- ⏳ 可靠赛果 Adapter、自动候选采集与发布编排

继续复用 `Repeat Each → Create View → Chained Update → Repeat Results → Grid.Children`，不设计第二套动态列表机制。

状态：**Canvases Sports v0.2 Phase 4 implementation complete; awaiting human review**。

## v0.3 — 赛事入口页

## v0.4 — 今日比赛

## v0.5 — 赛程

## v0.6 — 球队详情

## v1.0 — Canvases Sports
