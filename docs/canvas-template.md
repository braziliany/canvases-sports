# Canvases Sports · Canvas Grid Template

> 目标：在 Canvases Visual Editor 中创建 `苏超` Canvas，优先适配 Medium Home Screen Widget。能力名称来自用户提供的官方 User Guide 摘要；属性在不同 Beta 版本中的具体面板位置以真机为准。

> 已冻结的 v0.1 真机 PoC 只验证 `standings-grid → team-row → rank / team-name / goal-difference / points`。本页 Header 与 `qualification-label` 是扩展设计，不属于 v0.1 完成声明。详见 [v0.1 归档](v0.1-dynamic-standings-poc.md)。

## 1. Canvas 与根结构

创建 Canvas：`苏超`。

```text
Root Stack
├── Header Stack
│   ├── league-title
│   ├── season-label
│   └── updated-at
└── standings-grid
    └── team-row [Template]
```

Root Stack 使用垂直布局，宽度填满 Widget，可使用小号内边距。不要添加复杂动画、球队图片或非必要装饰。

## 2. 稳定 View IDs

| 位置 | 类型 | View ID | 初始内容/作用 |
| --- | --- | --- | --- |
| Header | Text | `league-title` | 江苏省城市足球联赛 |
| Header | Text | `season-label` | 2026 · 常规赛 |
| Header | Text | `updated-at` | 数据更新：— |
| Body | Grid | `standings-grid` | 一列动态球队列表 |
| Grid Template | Stack | `team-row` | 单支球队根 View |
| Template | Text | `rank` | — |
| Template | Text | `team-name` | 球队 |
| Template | Text | `goal-difference` | 0 |
| Template | Text | `points` | 0 |
| Template | Text | `qualification-label` | TOP 8 · 晋级区；默认隐藏 |

View ID 必须逐字一致，区分连字符。不要使用 `text1`、`label3` 等自动名称。

## 3. Header Stack

- `league-title`：单行，最高文字层级；空间不足时优先缩短为“江苏城市足球联赛”，但保留 View ID。
- `season-label`：较弱层级，固定为 `2026 · 常规赛`。
- `updated-at`：较小层级，由 Shortcut 写入 JSON 的赛事数据时间。

Medium Widget 高度紧张时，优先让 `season-label` 与 `updated-at` 同行或减少 Header 间距，不删除 13 支球队。

## 4. standings-grid

- Columns：`1`。
- Template Children：`ON`。
- Template：`team-row`。
- 使用紧凑垂直间距；必要时用细 Divider 区分行。
- Grid 的 Children 由 Shortcut 一次性替换，不在 Shortcut 中逐行直接追加到已显示 Grid。

## 5. team-row Template

推荐结构：

```text
team-row (Stack)
├── Row Content (Horizontal Stack)
│   ├── rank
│   ├── team-name
│   ├── Spacer
│   ├── goal-difference
│   └── points
└── qualification-label
```

视觉优先级：`points` > `team-name` > `rank` > `goal-difference`。建议使用等宽数字或稳定数字宽度；负净胜球保留负号，正数显示 `+`。

`qualification-label` 默认 `Visible = false`。显示时放在第 8 行下方，使用克制的强调色和小字号，形成晋级分隔线。

## 6. 占位与首次启动

编辑器中保留一行清晰的占位信息或空列表状态，避免首次安装但 Shortcut 尚未运行时出现误导数据。首次 Shortcut 成功后，`standings-grid` Children 会被 13 个模板实例替换。

## 7. 刷新按钮（可选）

只有 Header 仍有空间时添加 Button。iOS 27+ 可配置 `Run Shortcut`，运行 `Canvases Sports · 更新苏超`；iOS 26 使用 Shortcuts URL Scheme。按钮不是 v0.1 数据正确性的必要条件。

## 8. 真机验收

- Medium Widget 中出现 13 支球队且顺序为 1–13。
- 排名、球队、净胜球、积分与 `data/standings.json` 一致。
- `qualification-label` 只出现在排名第 8 行之后。
- `updated-at` 是赛事数据时间，不是 Shortcut 执行时间。
- 字体可读；如果空间不足，先减少 Header 和行间距，不隐藏球队。
- 截图前裁掉私人通知、账户或敏感状态信息。
