# Canvases Sports · 更新苏超 Shortcut

## 目标

创建 iOS Shortcut：`Canvases Sports · 更新苏超`。它从公开 GitHub Raw JSON 获取经校验的积分榜，构建 13 个 `team-row` 模板实例，并一次性写入 `standings-grid`。

数据 URL：

```text
https://raw.githubusercontent.com/braziliany/canvases-sports/main/data/standings.json
```

不使用 Token、Cookie、江苏体育局 HTML 或 OCR。

## 前置条件

先按 [canvas-template.md](canvas-template.md) 创建 Canvas `苏超`，并确保所有 View IDs 完全一致、`standings-grid` 为一列且 Template Children 已开启。

## 工作流总览

```text
Get Contents of URL
        ↓
Get Dictionary from Input
        ↓
Validate league / updatedAt / 13 standings
        ↓
Repeat with Each standing
        ↓
Create View from Template: team-row
        ↓
Update template child Views
        ↓
Collect 13 root Views
        ↓
Update View: standings-grid.Children
        ↓
Update Header Views
```

## 1. 获取与解析

1. `URL`：填入上述 Raw JSON URL。
2. `Get Contents of URL`：Method = GET。
3. `Get Dictionary from Input`。
4. 从根字典读取：`league`、`updatedAt`、`standings`。
5. 从 `league` 读取：`name`、`season`。

为减少 GitHub CDN 或代理缓存影响，可在手动测试时给 URL 加查询参数，例如 `?t=测试日期`；正式 Automation 使用稳定 URL 即可。

## 2. 最小数据校验

在更新任何 Canvas View 之前检查：

- 根输入是 Dictionary；
- `league.name`、`league.season`、`updatedAt` 存在；
- `standings` 是 List；
- List Count = `13`；
- 每一项至少存在 `rank`、`team.name`、`goalDifference`、`points`。

任一检查失败时显示结果 `苏超数据无效，已保留上次成功画面`，随后使用 `Stop This Shortcut`。不要清空 `standings-grid`。

## 3. 准备 Header 值

- League Title：`league.name`。
- Season Label：组合 `league.season` + ` · 常规赛`。
- Updated Label：把 `updatedAt` 作为 ISO 日期格式化为 `数据更新：M月d日 HH:mm`。如果日期转换失败，视为无效数据并停止，不使用当前时间代替。

## 4. 构建球队行

创建空变量 `Rendered Rows`，然后 `Repeat with Each` standings：

1. 读取 Repeat Item 的 `rank`。
2. 读取 `team` Dictionary，再读取 `team.name`。
3. 读取 `goalDifference` 和 `points`。
4. 若 goalDifference > 0，显示文本为 `+数字`；否则直接转换为文本，保留 `0` 或负号。
5. `Create View from Template`：
   - Canvas：`苏超`
   - Grid：`standings-grid`
   - Template：`team-row`
6. 对该 Created View 连续使用 `Update View Created from Template`：
   - View `rank` → Text = rank；
   - View `team-name` → Text = team.name；
   - View `goal-difference` → Text = 格式化后的净胜球；
   - View `points` → Text = points。
7. TOP 8：
   - 如果 rank = 8：View `qualification-label` → Text = `TOP 8 · 晋级区`，Visible = true；
   - 否则：View `qualification-label` → Visible = false。
8. 把本次 `team-row` 根 Created View 使用 `Add to Variable` 加入 `Rendered Rows`。

不要依赖最后一个 Text 更新动作作为 Repeat 输出；显式收集每个 `team-row` 根 View，避免 Children 得到错误对象。

## 5. 原子替换 Grid

Repeat 完成后再次确认 `Rendered Rows` Count = 13，然后：

```text
Update View
Canvas: 苏超
View: standings-grid
Property: Children
Value: Rendered Rows
```

先完整构建、后一次替换可避免网络或中途数据错误导致 Widget 只显示半张表。

## 6. 更新 Header

Grid 替换成功后依次使用 `Update View`：

- `league-title` → Text = League Title；
- `season-label` → Text = Season Label；
- `updated-at` → Text = Updated Label。

最后输出 `苏超积分榜已更新：数据时间 Updated Label`。当前执行时间只能作为运行日志，不能写入 `updated-at`。

## 7. 失败与最后成功画面

- 请求失败：Shortcut 终止，现有 Canvas Views 不变。
- JSON 无效或不足 13 行：Shortcut 终止，现有 Views 不变。
- 中途模板创建失败：因为尚未替换 Grid，现有 Views 不变。
- 首次运行无旧画面：保留 Visual Editor 中的占位状态。

该策略利用 Canvases/CloudKit 保存的最近 Canvas 状态，不声称存在未确认的自定义缓存 API。

## 8. Automation

数据通常按比赛轮次更新，默认建议每天 `08:00` 与 `22:30` 两次；若用户希望更及时，可增加 `12:00`、`18:00`。不要使用高频轮询。

Canvas 更新后，Home Screen / Lock Screen Widget 仍受 iOS 刷新预算影响，通常可能延迟约 15–60 分钟。Canvas 已更新而 Widget 尚未更新不一定是 Bug。

## 9. 手动刷新

- iOS 27+：可在 Canvases Button 中使用 `Run Shortcut`，选择本 Shortcut。
- iOS 26：使用 Shortcuts URL Scheme。
- 也可直接从 Shortcuts App、Home Screen Shortcut 或 Automation 运行。

## 10. 真机测试矩阵

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 正常网络 | 运行 Shortcut | 13 行、TOP 8 和 updatedAt 正确 |
| 再次运行 | 重复运行 | 不重复累加，仍为 13 行 |
| 断网 | 关闭网络后运行 | Shortcut 失败，旧画面保留，不清空 |
| 无效 JSON | 临时用测试 URL/副本 | 停止更新，旧画面保留 |
| 冷启动 | 新 Canvas 未成功运行 | 显示占位状态，不显示伪造积分 |
| Widget | 添加 Medium Widget | 可读显示；允许系统预算导致延迟 |

## 11. 分享与安全

设备验证后可创建 Canvases Share Link 与 Shortcut iCloud Link，并把 Shortcut Link 附加到 Canvas 分享流程。链接创建前检查 Shortcut 中只有公开 Raw URL，不包含 Token、账户信息、私有文件路径或个人数据。

本仓库暂不保存未验证的导出文件或分享链接。
