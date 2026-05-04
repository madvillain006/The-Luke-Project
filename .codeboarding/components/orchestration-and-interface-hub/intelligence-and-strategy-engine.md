---
component_id: 1.3
component_name: Intelligence & Strategy Engine
---

# Intelligence & Strategy Engine

## Component Description

The core analytical component that processes market signals and analyst inputs to derive trade decisions. It maintains "level memory" and applies strategy logic to identify high-probability entry zones.

---

## Key References:

### c:\Users\conor\luke\lib\decision-spine\index.js (lines 168-343)
```
function buildTradeDecision({ instrument, mode = 'manual', currentPrice = null, state = null, now = new Date() } = {}) {
  const normalizedInstrument = String(instrument || '').toUpperCase();
  const freshness = buildFreshness(now);
  const evidence = [{ type: 'freshness', freshness }];

  if (!normalizedInstrument) {
    return buildBaseDecision({
      ok: false,
      action: 'PASS',
      reason: 'instrument is required',
      instrument: normalizedInstrument,
      freshness,
      vetoes: [{ type: 'invalid_request', detail: 'instrument is required' }],
      evidence,
    });
  }

  const inputVetoes = freshnessVetoes(freshness);
  if (inputVetoes.length > 0) {
    const missing = inputVetoes.map(v => v.command).join(', ');
    return buildBaseDecision({
      ok: false,
      action: 'PASS',
      reason: `No fresh decision available for ${normalizedInstrument}. Run ${missing} first.`,
      instrument: normalizedInstrument,
      freshness,
      vetoes: inputVetoes,
      evidence,
    });
  }

  const records = queryLevelsAcrossEquivalents(normalizedInstrument);
  evidence.push({ type: 'level_memory', instrument: normalizedInstrument, records: records.length });
  if (records.length === 0) {
    return buildBaseDecision({
      ok: true,
      action: 'PASS',
      reason: `No levels recorded yet for ${normalizedInstrument}.`,
      instrument: normalizedInstrument,
      freshness,
      evidence,
    });
  }

  const avoidZones = deriveAvoidZones(records);
  evidence.push({ type: 'avoid_zones', zones: avoidZones });

  const ranked = records
    .map(record => ({ record, scored: scoreLevel(record, { currentPrice }) }))
    .sort((a, b) => b.scored.score - a.scored.score);

  const enriched = ranked.map(item => {
    const zone = computeFuturesEntryZone(item.record, {
      instrument: normalizedInstrument,
      currentPrice,
      confluenceGrade: item.scored.grade,
      confluenceScore: item.scored.score,
    });
    const side = zone.entry_window.abort_below != null ? 'LONG' : 'SHORT';
    const stop = zone.entry_window.abort_below ?? zone.entry_window.abort_above;
    const target = findDirectionalTarget(zone.canonical_price, side, records);
    return { item, zone, side, stop, target };
  });

  const best = enriched.find(row => ['full', 'half', 'quarter'].includes(row.zone.sizing_guidance)) || enriched[0];
  if (!best) {
    return buildBaseDecision({
      ok: true,
      action: 'PASS',
      reason: `No actionable levels for ${normalizedInstrument}.`,
      instrument: normalizedInstrument,
      freshness,
      evidence,
    });
  }

  const confluence = {
    anchor: best.zone.canonical_price,
    grade: best.item.scored.grade,
    score: best.item.scored.score,
    flags: best.item.scored.flags,
    breakdown: best.item.scored.breakdown,
    top: enriched.slice(0, 5).map(row => ({
      anchor: row.zone.canonical_price,
      side: row.side,
      grade: row.item.scored.grade,
      score: row.item.scored.score,
      sizing: row.zone.sizing_guidance,
      entry: row.zone.entry_window.optimal_entry,
      acceptable_entry: row.zone.entry_window.acceptable_entry,
      stop: row.stop,
      target: row.target,
    })),
  };
  evidence.push({ type: 'confluence', confluence });

  if (best.zone.sizing_guidance === 'pass') {
    return {
      ok: true,
      action: 'PASS',
      reason: `Best level is ${best.item.scored.grade} grade PASS at ${best.zone.canonical_price}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [],
      evidence,
    };
  }

  const avoidHit = findAvoidZone(best.zone.entry_window.optimal_entry, avoidZones) ||
    findAvoidZone(best.zone.canonical_price, avoidZones);
  if (avoidHit) {
    return {
      ok: false,
      action: 'PASS',
      reason: `Best ${normalizedInstrument} entry sits inside Mancini chop zone ${avoidHit.low}-${avoidHit.high}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [{ type: 'mancini_chop_zone', zone: avoidHit }],
      evidence,
    };
  }

  const floorBlock = state ? getApexPreTradeFloorBlock(state, {
    ticker: normalizedInstrument,
    direction: best.side,
    entry: best.zone.entry_window.optimal_entry,
    stop: best.stop,
    target: best.target ?? best.zone.canonical_price,
  }) : null;
  if (floorBlock) {
    return {
      ok: false,
      action: 'PASS',
      reason: `Apex floor blocked: max loss ${floorBlock.maxLoss.toFixed(0)} would breach floor ${floorBlock.floor.toFixed(0)} + ${floorBlock.buffer}.`,
      instrument: normalizedInstrument,
      entry: best.zone.entry_window.optimal_entry,
      acceptable_entry: best.zone.entry_window.acceptable_entry,
      stop: best.stop,
      target: best.target,
      sizing: 'pass',
      confluence,
      freshness,
      vetoes: [{ type: 'apex_floor', floorBlock }],
      evidence,
    };
  }

  return {
    ok: true,
    action: best.side,
    reason: `${best.side} ${normalizedInstrument} ${best.zone.canonical_price} ${best.item.scored.grade} grade ${best.zone.sizing_guidance} size.`,
    instrument: normalizedInstrument,
    entry: best.zone.entry_window.optimal_entry,
    acceptable_entry: best.zone.entry_window.acceptable_entry,
    stop: best.stop,
    target: best.target,
    sizing: best.zone.sizing_guidance,
    confluence,
    freshness,
    vetoes: [],
    evidence,
    mode,
  };
}
```

### c:\Users\conor\luke\lib\confluence-engine.js (lines 114-202)
```
function scoreLevel(canonicalRecord, opts = {}) {
  const { currentPrice = null } = opts;
  const mentions = canonicalRecord.mentions || [];

  // Distinct analysts (hardcoded names NOT used — dynamically from mentions[].analyst)
  const distinctAnalysts = new Set(mentions.map(m => m.analyst));
  const analystCount = Math.min(distinctAnalysts.size, 4);
  const distinct_analysts_contribution = analystCount * 0.20;

  // Key significance
  const has_key_significance = mentions.some(m => m.significance === 'key');
  const key_significance_contribution = has_key_significance ? 0.15 : 0;

  // King node: bobby analyst + key significance + null direction (gamma anchor)
  const has_king_node = mentions.some(m =>
    m.analyst === 'bobby' &&
    m.significance === 'key' &&
    m.direction == null
  );
  const king_node_contribution = has_king_node ? 0.10 : 0;

  // Cross-source confirmation (crossSourceConfirmed not yet stored in Level Memory
  // mentions — works when the field is present; contributes 0 when absent in production)
  const has_cross_source = mentions.some(m => m.crossSourceConfirmed === true);
  const cross_source_contribution = has_cross_source ? 0.15 : 0;

  // Recency: most-recent mention within last 5 trading days
  const timestamps = mentions.map(m => m.timestamp).filter(Boolean);
  const most_recent = timestamps.length
    ? timestamps.reduce((a, b) => (a > b ? a : b))
    : null;
  const is_recent = withinTradingDays(most_recent, 5);
  const recency_contribution = is_recent ? 0.10 : 0;

  const raw_total =
    distinct_analysts_contribution +
    key_significance_contribution +
    king_node_contribution +
    cross_source_contribution +
    recency_contribution;

  const capped_at_1 = raw_total > 1.0;
  const final_score = Math.min(raw_total, 1.0);
  const final_grade = gradeFromScore(final_score);

  // ── Flags ──────────────────────────────────────────────────────────────────────

  const flags = [];

  // Staleness: >5% from current price (flagged, not filtered — Phase 5 backtest needs full set)
  if (currentPrice != null) {
    const pct = Math.abs(canonicalRecord.canonical_price - currentPrice) / currentPrice;
    if (pct > 0.05) {
      flags.push({ type: 'stale', detail: 'level >5% from current price' });
    }
  }

  // Vision disagreement: dubz text + image mentions both present without cross-source confirmation.
  // In the current Level Memory schema, conflicting text/image go to separate canonicals so this
  // rarely fires in production. Flag is correct when crossSourceConfirmed is stored on mentions.
  const hasDubzText  = mentions.some(m => m.analyst === 'dubz' && m.source_type === 'text');
  const hasDubzImage = mentions.some(m => m.analyst === 'dubz' && m.source_type === 'image');
  if (hasDubzText && hasDubzImage && !has_cross_source) {
    flags.push({ type: 'vision_disagreement', detail: 'text and image sources without cross-source confirmation' });
  }

  if (has_king_node) {
    flags.push({ type: 'king_node', detail: 'gamma anchor at this level' });
  }

  if (distinctAnalysts.size >= 2) {
    const analystList = [...distinctAnalysts].join(', ');
    flags.push({ type: 'multi_analyst', detail: `${distinctAnalysts.size} analysts: ${analystList}` });
  }

  const breakdown = {
    distinct_analysts_contribution,
    key_significance_contribution,
    king_node_contribution,
    cross_source_contribution,
    recency_contribution,
    raw_total,
    capped_at_1,
    final_score,
    final_grade,
  };

  return { score: final_score, grade: final_grade, flags, breakdown };
}
```

### c:\Users\conor\luke\lib\actions.js (lines 155-186)
```
async function handleAction(action) {
  const t0 = Date.now();
  const isScreenOp = SCREEN_OPS.has(action.action);

  const intentEntry = { ts: new Date().toISOString(), action: action.action, params: action, phase: "intent" };
  if (isScreenOp) {
    try { fs.appendFileSync(SCREEN_ACTIONS_FILE, JSON.stringify(intentEntry) + "\n"); } catch {}
  }

  const result = await _handleAction(action);

  if (isScreenOp && (action.verify_hint || action.action === "click" || action.action === "type")) {
    const verify = await verifyScreen(action.verify_hint || "the action completed successfully");
    const verifyEntry = { ts: new Date().toISOString(), action: action.action, phase: "verify", ok: verify.ok, verdict: verify.verdict };
    try { fs.appendFileSync(SCREEN_ACTIONS_FILE, JSON.stringify(verifyEntry) + "\n"); } catch {}
    if (!verify.ok) {
      logToolFailure({ op: "screen-verify", action: action.action, verdict: verify.verdict });
      if (global.broadcast) global.broadcast({ type: "notification", message: "SCREEN VERIFY FAILED: " + action.action + " — " + verify.verdict });
    }
  }

  try {
    fs.appendFileSync(TOOL_CALLS_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      action: action.action,
      key: action.path || action.pattern || action.command || action.file || "",
      duration_ms: Date.now() - t0,
      result_len: typeof result === "string" ? result.length : 0
    }) + "\n");
  } catch {}
  return result;
}
```


## Source Files:

- `lib\actions.js`
- `lib\bobby-heatmap-idempotency.js`
- `lib\bracket-calc.js`
- `lib\confluence-engine.js`
- `lib\confluence.js`
- `lib\daily-accumulator.js`
- `lib\decision-spine\index.js`
- `lib\detect-paste.js`
- `lib\emotional-exits.js`
- `lib\es-bracket-strategy.js`
- `lib\es-long-bracket-runner.js`
- `lib\futures-entry-zones.js`
- `lib\heatmap-context.js`
- `lib\heatseeker-reference.js`
- `lib\historical-data.js`
- `lib\kat-audit.js`
- `lib\kat-confluence.js`
- `lib\kat-equity-options.js`
- `lib\kat-index-scope.js`
- `lib\kat-insights.js`
- `lib\kat-level-context.js`
- `lib\kat-market-evaluation.js`
- `lib\kat-message-bin.js`
- `lib\kat-owner-proof-pack.js`
- `lib\kat-readiness.js`
- `lib\kat-replay.js`
- `lib\kat-ticker-watchlist.js`
- `lib\level-memory.js`
- `lib\level-replay.js`
- `lib\live-price.js`
- `lib\llm-client.js`
- `lib\logger.js`
- `lib\market-data\providers\finnhub.js`
- `lib\market-data\providers\polygon.js`
- `lib\market-data\providers\tradovate.js`
- `lib\market-data\providers\yahoo.js`
- `lib\market-hours.js`
- `lib\memory.js`
- `lib\parse-bobby.js`
- `lib\parse-dubz.js`
- `lib\parse-kat.js`
- `lib\parse-mancini.js`
- `lib\parse-ximes.js`
- `lib\research\common.js`
- `lib\research\corpus-loader.js`
- `lib\research\existing-data-inventory.js`
- `lib\research\no-lookahead-context.js`
- `lib\research\outcome-metrics.js`
- `lib\research\replay-engine.js`
- `lib\research\source-attribution.js`
- `lib\research\source-timeline.js`
- `lib\saty-auto-pull.js`
- `lib\saty-levels.js`
- `lib\session-replay.js`
- `lib\sienna-regime.js`
- `lib\slash-commands-ingest.js`
- `lib\slash-commands.js`
- `lib\system-prompt.js`
- `lib\today-levels-shim.js`
- `lib\validators.js`
- `state\health-store.js`
- `state\lib.js`
- `state\trading-store.js`

