## Stale Tests Fixed — 2026-04-30

Five stale tests were updated to match the post-fccd266 production behavior (where /dubz is no longer a hard prerequisite for /verdict and /entries).

**Tests updated:**

1. **slash-commands.test.js line 197** — `/verdict` guard message: removed `/dubz` from expected missing-inputs string. Now asserts `Run /saty, /heatmap first, then /ready before /verdict.`

2. **slash-commands.test.js line 241** — `/entries` guard message: same pattern, now asserts `Run /saty, /heatmap first, then /ready before /entries ES.`

3. **slash-commands.test.js line 463** — `/ready` readiness check: removed `expect(payload.reply).toContain('OK RichyDubz levels loaded')`. The /ready handler no longer surfaces Dubz as a top-level readiness line; Saty, Bobby, Balance, and Apex assertions remain.

4. **today-levels-shim.test.js line 35** — WebSocket warning payload: updated expected message from the old `/dubz [RichyDubz morning message] then /heatmap` form to `Paste /heatmap [Bobby text] before trading.` to match production.

5. **slash-commands.test.js line 417** (EPERM) — **Option A** used. Added `levelMemoryInternal._setWriteFn(() => {})` before the `/saty` command call and `levelMemoryInternal._resetWriteFn()` in a `finally` block after. This prevents `appendSatyToMemory → recordLevel → writeJsonAtomic` from attempting an atomic rename on `data/level-memory.json` while luke-server (pm2) holds the file handle on Windows. Required adding `const { _internal: levelMemoryInternal } = require('../lib/level-memory')` at the top of the test file.

**Test count before:** 383 passing (per health check doc baseline)
**Test count after:** 387 passing, 1 failing (confluence-engine SPX level lookup — intentionally left), 1 skipped

**Production code unchanged:** `git diff --stat lib/ agents/ scheduler.js index.js` confirmed all shown changes are pre-existing branch modifications; no files were touched in this session.
