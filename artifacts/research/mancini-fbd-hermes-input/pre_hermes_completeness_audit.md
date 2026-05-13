# Pre-Hermes Completeness Audit

Scope: final closed-package audit for research-only Hermes review.

## Decision

The package is complete enough for Hermes to produce deterministic, testable research math and rule candidates from the currently available Mancini source text, ES 1m data, generated labels, local feature matrix, gallery evidence, label-recovery review, SATY side-project comparison, and existing docs.

Hermes should not ask for more local work before producing the required JSON. Any weak evidence must be represented as lower confidence, a hard reject, a negative/control label, a sample-size gate, or a validation-plan item.

## Included Evidence

- Training rows: 1129
- Direct audit rows: 842
- Feature rows: 1129
- Label rows: 1129
- Hard-rejected rows: 1072
- Unique setups: 973
- Strict direct positive training candidates: 0
- Real packet gallery SVG files: 172
- Real packet gallery PNG files: 172
- Missing gallery PNG sidecars: 0
- Chart audit pass: true
- Total chart/audit PNG files: 233

## Label Recovery Coverage

- Source-qualified hard-reject rows reviewed: 427
- Rows with existing session and level scanned: 263
- Recovered flush/reclaim rows: 125
- Recovered non-acceptance rows: 67
- Candidate-eligible rows after recovery: 11
- Candidate-eligible unique setups after recovery: 10

Recovery remains supplemental review evidence. It does not erase the strict direct-audit safety gate and does not promote S/R-list-only rows.

## SATY Side-Project Coverage

- Sessions loaded: 37
- Valid SATY sessions: 22
- SATY protocol rows: 526

SATY-only rows are geometry controls. They can compare protocol behavior against Mancini-source setups, but they are not positive training examples without Mancini source confirmation.

## Per-Example SATY Prior-Close Context

- Packet examples overlaid: 172
- Valid SATY derivations: 108
- Invalid SATY derivations: 64
- Prior-close reference rows: 172
- SVG context charts: 172
- PNG context charts: 172
- Reference-before-target failures: 0
- Reference-field-not-close failures: 0
- Plan-date/session mismatches: 0
- Reference-close mismatch failures: 0
- SATY session anchor missing rows: 16

Rows with missing SATY session anchors are 17:00-17:59 ET maintenance-gap edge cases and remain review-only context. The per-example overlays use generated prior-close SATY levels for context comparison only; SATY proximity does not promote a row to Mancini source authority.

## Known Limits Already Accounted For

- 1m OHLC cannot prove intraminute order.
- `needs_crop` rows are represented as review labels rather than missing work.
- Some gallery rows have price-only raw-source matches; these are caveats and remain review-only.
- Small family sample sizes are validation gates.
- Future MFE/MAE, hit rates, stop-first, and target hits are labels only.
- Ninja Strategy Analyzer, Playback, and Market Replay are intentionally after Hermes and local deterministic verification.
- The Hermes input directory now includes raw features, labels, training summary, direct audit, handoff, gallery manifest, visual sanity audit, SATY comparison, label recovery, chart audit, and future Ninja shadow telemetry context.

## Required Hermes Behavior

Return the required JSON object. Do not return a blocker that asks Codex/user to gather more files, run Ninja, collect broker data, write Pine/Ninja code, open charts, or do more local preprocessing first.
