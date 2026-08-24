# Canvases Sports

Sports dashboards built for Canvases.

Canvases Sports is a small, testable sports information panel. Version 0.1
focuses exclusively on the 2026 Jiangsu City Football League (苏超).

## Current support

- ✅ 江苏省城市足球联赛（2026 常规赛）
- ✅ [v0.1 Dynamic Standings PoC](docs/v0.1-dynamic-standings-poc.md)：真机验证完成
- ⏳ LPL（roadmap only; no implementation in v0.1）

## What is included

- All 13 city teams and the complete official standings fields
- A unified league standings schema
- TOP 8 qualification boundary
- Manual refresh and refresh-on-open
- Local browser cache with offline fallback
- Strict validation and non-crashing error states
- A Shortcuts-driven Canvases implementation specification
- Responsive dark web reference UI

## Data source

The primary source is the [Jiangsu Provincial Sports Bureau standings
column](https://jsstyj.jiangsu.gov.cn/col/col93442/index.html). The bureau
publishes each round as an image rather than JSON. The v0.1 snapshot is a
human-reviewed transcription of the official 2026-08-15 table and records its
source URL and publication time. The browser never scrapes that page.

Because the official source does not expose previous rank, `trend` is `null`
instead of being fabricated.

## Architecture

```text
Official standings image
        ↓ human-reviewed transcription
Jiangsu Adapter
        ↓
Unified Schema + Validation
        ↓
data/standings.json
        ├─→ iOS Shortcut → Canvases Grid Template → Home Screen Widget
        └─→ Web Reference Renderer (debug, validation, desktop preview)
```

The adapter boundary is intentionally reusable; another league can later emit
the same schema without coupling its fetch logic to the renderer.

## Run locally

Requires Node.js 20 or newer.

```bash
npm test
npm run validate
npm run dev
```

Then open `http://127.0.0.1:4173`.

## Installation in Canvases

The native target is the [Canvases TestFlight
beta](https://testflight.apple.com/join/65RCk8Xh) by the developer of
Scriptable. Its official workflow uses a visual editor for widget layout and
Shortcuts actions for live updates; there is no in-app code runtime.

The repository provides a device-build specification:

- [Canvas Grid Template](docs/canvas-template.md)
- [Shortcut build guide](docs/shortcut.md)

The Shortcut reads the public, stable JSON contract at:

```text
https://raw.githubusercontent.com/braziliany/canvases-sports/main/data/standings.json
```

The core v0.1 flow has been verified on an iPhone: 13 Template instances are
created dynamically, updated through a chained View pipeline, collected as
Repeat Results, and written to `standings-grid.Children`. See the
[frozen PoC record](docs/v0.1-dynamic-standings-poc.md).

The richer header, TOP 8 styling, refresh automation, failure UI, and sharing
ideas in the device-build specifications are outside the frozen v0.1 PoC.

## Canvases Native vs Web Reference

**Canvases Native** is the production target: a Medium Home Screen Widget built
in the visual editor with a one-column Grid and Template Children, updated by
the `Canvases Sports · 更新苏超` Shortcut.

**Web Reference** (`index.html`) is only for data debugging, View Model
validation, and desktop preview. Browser `fetch` and `localStorage` are not part
of the Canvases architecture.

## Development

`data/sources/` contains source-shaped snapshots, while `data/standings.json`
is the stable client contract. Edit the source snapshot after checking the
official image, then run `npm run validate` and `npm test`.

## Screenshots

The native screenshot directory will be `assets/screenshots/`. No device image
will be committed until it has been reviewed for private status-bar or other
sensitive information.

## Roadmap

See [docs/Roadmap.md](docs/Roadmap.md). The next milestone is v0.2 Dynamic
Fixtures; it is documented as an entry point only and has not started.
