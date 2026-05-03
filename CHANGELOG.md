# Changelog

This is the main running change log for Luke.

## 2026-04-28

### Autonomous + recommendation hardening

- `a294d63` Tighten autonomous staging against `/entries` truth
  - require same-day ET Bobby/Dubz freshness
  - block staging when signal side disagrees with `/entries`
  - block staging inside Mancini chop zones
  - block staging when entry is too far from best confluence anchor
  - log Phase 2 freshness and recommendation evidence

- `fccd266` Harden recommendation lane and trim live residue
  - slim system prompt to reduce token use
  - clean `/mancini` fail path
  - normalize Kat alert output
  - trim obvious personal-life residue from live surfaces

- `cf959fc` Require fresh inputs before `/entries` recommendations
  - stop recommending off stale state

- `5cce443` Harden `/entries` into a recommendation surface
  - make `/entries ES` a real trade-plan output

### Katbot + context repairs

- `adf4465` Repair Kat confluence posting and ticker/image context
  - fix dead import
  - repair image MIME handling
  - improve `#ES_F` / `#NQ_F` ticker parsing

### Router + workflow cleanup

- `6a9a58c` Modernize autonomous confluence inputs and remove dead premarket helper
  - bridge router confluence off modern Phase 2 truth

- `61fcb33` Retire dead premarket UI and normalize legacy level entry path
  - remove dead PRE-MKT path
  - redirect legacy `/levels` behavior toward modern flow

- `3069a80` Harden morning prep flow and archive stale ops docs
  - stronger prep nudges
  - archive stale operational docs

### Phase 5 + data layer

- `c06a40e` Sub-task 6c: Phase 5 modules
  - historical intraday loader
  - level replay
  - futures entry zones

- `0eebbaa` Backend hardening: BOM-stripping JSON reads
  - prevent Windows BOM corruption from breaking boot checks

### Mancini integration

- `3ebc3c1` Sub-task 6a: Mancini parser + Reddit format + batch ingest
  - parser
  - slash command
  - batch fixture output

### Earlier hardening checkpoints

- `91440c5` Bridge `/alert` and legacy confluence paths to Phase 2 state
- `6fca230` Sub-task 5f: Phase 2 hardening checkpoint

## Notes

- Uncommitted local leftovers like `.ws-token`, `repo-map.json`, `LAUNCH-LUKE.cmd`, and `scripts/__pycache__/` are not part of the product story.
- GitHub-facing docs now keep only current Luke surfaces; historical cleanup debris is kept out of the live tree.
