# Changelog

## [Unreleased]

### Added

- v0.2 Dynamic Fixtures Phase 1 data contract
- `data/fixtures.json` with three human-reviewed week-19 fixtures
- Fixtures Schema validation, chronological sorting, and Jiangsu status mapping
- Offline fixtures tests and `docs/v0.2-dynamic-fixtures.md`
- Synthetic six-case device status matrix fixture
- On-device status mapping, score rendering, and missing-score verification
- ADR-007 for decoupled status/score rendering and Less is More

### Changed

- `npm run validate` now checks standings and fixtures contracts
- `npm run validate` also checks the synthetic device fixture
- v0.2 is marked complete after the device status matrix passed

## [0.1.0] - 2026-08-24

### Added

- Jiangsu City Football League standings
- Unified standings schema and validation
- TOP 8 qualification line
- Ranking trend field with honest `null` fallback
- Browser cache fallback and manual refresh
- Loading, invalid-data, network-error, and no-cache states
- Fixed real-data fixture and unit tests
- Canvases one-column Grid + Template Children build specification
- Complete `Canvases Sports · 更新苏超` Shortcut construction guide
- Stable semantic View IDs for the core dynamic row fields
- iPhone-verified dynamic 13-row Grid rendering
- Chained `Update View Created from Template` data-flow rule
- Final View collection through `Repeat Results`

### Changed

- Replaced the superseded native-code runtime assumption with the official
  visual-editor + Shortcuts architecture
- Clarified that the Web renderer is a debug and desktop-preview surface only
- Archived the core four-field dynamic standings workflow as a completed PoC;
  richer TOP 8, header, automation, cache, and error-state work remains outside
  the frozen v0.1 scope
