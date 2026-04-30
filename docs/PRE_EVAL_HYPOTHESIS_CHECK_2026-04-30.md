# Pre-Eval Hypothesis Check — 2026-04-30

Diagnostic only. No code changes. Evidence gathered from direct file reads and greps.

---

## H1: Luke's system prompt is out of sync with actual wired capabilities.

**H1 verdict: YES**

**H1 evidence:**

`MASSIVE_API_KEY` / Polygon live price path exists in code at these files:

```
scheduler.js:302        if (!process.env.MASSIVE_API_KEY) return;
lib/live-price.js:41    const key = process.env.MASSIVE_API_KEY;
lib/live-price.js:43    console.warn('[live-price] MASSIVE_API_KEY not set — live price unavailable');
lib/saty-auto-pull.js:169  const key = process.env.MASSIVE_API_KEY;
lib/saty-auto-pull.js:170  if (!key) return { ok: false, error: 'MASSIVE_API_KEY not set' };
```

`lib/live-price.js` exports `getLivePrice()` — fetches SPY and QQQ from Polygon, derives SPX (SPY × 10), ES (SPX + 30), NQ (QQQ × 41.3). Called directly in the `/verdict` handler.

Grep for "massive", "polygon", "live price", "SPX", "data source", "API" in `lib/system-prompt.js`: **ZERO matches.**

The system prompt (`buildSystemPrompt`) mentions `/verdict` as part of the live workflow:
```
"- Prefer /status, /verdict, /entries, /alert, /dubz, /heatmap, /mancini, and /saty as the live workflow.\n"
```
But it says nothing about how live prices are sourced, that MASSIVE_API_KEY must be set, or that Polygon is the data provider. If the key is absent, `/verdict` silently downgrades to no-price mode with no explanation in-prompt.

**H1 gap:** The system prompt names `/verdict` as a live workflow command but does not tell Luke that live prices require `MASSIVE_API_KEY` (Polygon), so Luke cannot self-diagnose why price data is missing.

---

## H2: /verdict dumps all levels instead of gating to a single decision.

**H2 verdict: NO** (the hypothesis is wrong in its exact framing, but the underlying concern is confirmed)

**H2 evidence:**

`/verdict` handler in `lib/slash-commands.js:1319–1362`:

```js
const topN = hasAll ? Infinity : 5;
// ...
const reply = buildVerdictMarkdown(instruments, { currentPrices, topN, priceError });
```

`buildVerdictMarkdown` in `lib/confluence-engine.js:273–322`:

```js
// Score and sort
const scored = records.map(record => ({
  record,
  result: scoreLevel(record, { currentPrice }),
}));
scored.sort((a, b) => b.result.score - a.result.score);

const limited = topN === Infinity ? scored : scored.slice(0, topN);

for (const { record, result } of limited) {
  const { score, grade, flags } = result;
  // ...
  lines.push(
    `- **${instrument} ${priceStr}**  →  **${grade}** (${scoreStr})  ${summary}${flagStr}`
  );
}
```

Grade thresholds defined in `confluence-engine.js:84–97`:
```
A: score >= 0.75
B: score >= 0.55
C: score >= 0.35
D: score >= 0.20
F: score <  0.20
```

**There is no grade filter.** The top 5 are returned strictly by score order regardless of grade. A D-grade or F-grade level will appear in the output if it ranks in the top 5. The output is always a ranked list — there is no single GO/NO-GO decision or minimum-grade gate that drops low-conviction levels from the headline response.

**H2 gap:** No minimum grade threshold filters D/F levels out of `/verdict` output — a low-conviction level can appear in the headline list if it outscores others, with no single-verdict decision framing.

---

## H3: No /capabilities introspection command exists.

**H3 verdict: YES** (no introspection command exists)

**H3 evidence:**

Grep for `capabilities`, `help`, `what can you do`, `introspect`, `commands.*list`, `list.*commands` (case-insensitive) in `lib/slash-commands.js`: **no matching command found.**

There is no handler that prints a fixed inventory of what Luke can do. There is a `/status` and `/ready` command, but neither enumerates Luke's available commands or data sources.

---

## Summary

| Hypothesis | Verdict | One-line gap |
|---|---|---|
| H1: System prompt out of sync with live price capability | **YES** | Prompt names `/verdict` but never mentions MASSIVE_API_KEY or Polygon; Luke cannot self-diagnose a missing key |
| H2: `/verdict` dumps all levels with no grade gate | **NO (partially confirmed)** | Output IS capped at top 5, but there is NO grade filter — D/F levels can appear with no GO/NO-GO framing |
| H3: No `/capabilities` introspection command | **YES** | No such command exists anywhere in slash-commands.js |
