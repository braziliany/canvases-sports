# Changelog

## Unreleased — v0.2 production data sync

- Added five controlled online result fetchers across four explicitly identified publishers with stable provenance snapshots.
- Prevented same-publisher mirrors or unregistered source labels from satisfying automatic reconciliation.
- Added conservative multi-source reconciliation and automatic settlement through the existing settlement core.
- Added the 2026-08-22 transitional baseline and official 2026-08-29 standings cross-check.
- Added a minimal-permission GitHub Actions workflow that publishes only validated data changes.

## [Unreleased]

### Added

- v0.2 Dynamic Fixtures Phase 1 data contract
- `data/fixtures.json` with three human-reviewed week-19 fixtures
- Fixtures Schema validation, chronological sorting, and Jiangsu status mapping
- Offline fixtures tests and `docs/v0.2-dynamic-fixtures.md`
- Synthetic six-case device status matrix fixture
- On-device status mapping, score rendering, and missing-score verification
- ADR-007 for decoupled status/score rendering and Less is More
- Effective match status normalizer and deterministic kickoff regression tests
- `effectiveStatus` / `effectiveStatusAt` in the fixtures contract
- ADR-008 documenting explicit-state precedence and the Shortcut renderer boundary
- Deterministic match-result settlement and standings build command
- Official tie-break handling with explicit failure for missing fair-play/draw data
- ADR-009 documenting fixtures as the result source of truth
- ResultCandidate schema and isolated candidate data file
- Explicit `results:confirm` human-review command
- Conflict-safe, idempotent, rollback-backed result settlement
- ADR-010 documenting ingestion and human confirmation boundaries
- Interactive `results:add` command for safe ResultCandidate entry
- Unique candidate IDs and explicit multi-source candidate handling
- Transaction-backed candidate-only writes and entry validation tests
- Controlled week-19 result source snapshot and Yangtze Evening News adapter
- ResultObservation contract and strict league/season/round/date/team fixture matcher
- `results:discover` dry-run/`ADD` candidate discovery flow
- Exact rediscovery suppression with multi-source and conflicting Candidate coexistence
- Fail-closed `--isolated-data-dir` protection shared by result entry, discovery, and confirmation CLIs

### Changed

- Candidate tests now use isolated data and accept legitimate non-empty production candidate states
- Fixture and standings unit tests no longer assume the production files remain at their initial pre-settlement state
- Production candidate integrity checks now validate contracts, fixture links, audit state, and explicit pollution markers instead of requiring zero candidates
- Pre-commit confirmation tests run every test file serially to avoid nested Windows test-worker crashes
- Default multi-file transactions no longer pass the entry index as a `copyFile` flag
- CLI regression tests now create temporary data directories with Node and reject invalid isolation instead of relying on shell directory changes
- `npm run validate` now checks standings and fixtures contracts
- `npm run validate` also checks the synthetic device fixture
- v0.2 is marked complete after the device status matrix passed
- Production fixtures expose `live` as the effective status for the three
  2026-08-29 19:40 matches at the 20:53 regression instant
- Standings validation now compares the published table with calculator output
- Project validation now includes the ResultCandidate contract

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
