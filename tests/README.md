# Tests

Vitest coverage for Luke command behavior, trading safety, Radar/Daily flows, UI contracts, parsers, research engines, and runtime helpers.

When touching command or trading paths, protect `/status`, `/balance`, `/saty`, `/ready`, and `/alert` with focused tests before broad cleanup.
