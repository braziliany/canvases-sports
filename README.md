# Canvases Sports

Sports dashboards built for Canvases.

Canvases Sports is a small, testable sports information panel. Version 0.1
focuses exclusively on the 2026 Jiangsu City Football League (苏超).

## Current support

- ✅ 江苏省城市足球联赛（2026 常规赛）
- ⏳ LPL（roadmap only; no implementation in v0.1）

## What is included

- All 13 city teams and the complete official standings fields
- A unified league standings schema
- TOP 8 qualification boundary
- Manual refresh and refresh-on-open
- Local browser cache with offline fallback
- Strict validation and non-crashing error states
- Platform-neutral Canvas view model
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
        ↓ reviewed transcription
Jiangsu adapter
        ↓
Unified standings schema
        ↓
Validated JSON
        ↓
Cache → Canvas view model → Web reference UI
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
Scriptable. Apple describes the beta as an app for designing widgets and
updating them through Shortcuts.

Native installation is not claimed yet. The TestFlight landing page does not
publish the runtime, layout, network, storage, lifecycle, project format, or
sample code needed to implement a renderer safely. The platform-neutral view
model is in `src/canvases/jiangsu-standings.js`; it remains the integration seam
once an App-exported sample or its in-app documentation is available.

## Development

`data/sources/` contains source-shaped snapshots, while `data/standings.json`
is the stable client contract. Edit the source snapshot after checking the
official image, then run `npm run validate` and `npm test`.

## Screenshot

Generate or capture one after running the reference UI. A screenshot is not
checked in until the layout is verified in a browser.

## Roadmap

See [docs/Roadmap.md](docs/Roadmap.md). Native Canvases verification and a
maintainable official-data ingestion path come before adding another league.
