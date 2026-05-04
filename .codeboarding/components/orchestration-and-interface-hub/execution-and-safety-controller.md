---
component_id: 1.4
component_name: Execution & Safety Controller
---

# Execution & Safety Controller

## Component Description

Responsible for the final validation and transmission of trades to the broker. It monitors system health to prevent execution during unstable conditions and manages risk parameters.

---

## Key References:

### c:\Users\conor\luke\trading\risk.js (lines 104-149)
```
function validateStagedTrade(signal, marketCtx, config = {}) {
  const cfg = { ...MARKET_GATE_DEFAULTS, ...config };
  const reasons = [];

  if (!marketCtx || marketCtx.stale) {
    const detail = marketCtx && marketCtx.error ? ` (${marketCtx.error})` : "";
    reasons.push(`market_context_stale: cannot verify current price${detail}`);
    return { ok: false, reasons };
  }

  const { direction, entry, stop, target, ticker } = signal;
  const pv = getPointValue(ticker || "MNQ");

  if (marketCtx.price !== null) {
    const driftTicks = Math.abs(marketCtx.price - entry) / FUTURES_TICK_SIZE;
    if (driftTicks > cfg.drift_reject_ticks) {
      reasons.push(`price_drift: ${driftTicks.toFixed(1)} ticks from staged entry ${entry}, current ${marketCtx.price}`);
    }
  }

  if (marketCtx.spread_ticks !== null && marketCtx.spread_ticks > cfg.max_spread_ticks) {
    reasons.push(`spread_too_wide: ${marketCtx.spread_ticks} ticks (max ${cfg.max_spread_ticks})`);
  }

  if (cfg.max_risk_per_trade !== undefined && cfg.max_risk_per_trade > 0 && marketCtx.price !== null) {
    const riskPts = direction === "LONG" ? marketCtx.price - stop : stop - marketCtx.price;
    const effectiveRisk = riskPts * pv;
    if (effectiveRisk > cfg.max_risk_per_trade) {
      reasons.push(`effective_risk: $${effectiveRisk.toFixed(0)} exceeds max $${cfg.max_risk_per_trade}`);
    }
  }

  if (marketCtx.price !== null) {
    const driftedEntry = marketCtx.price;
    const rewardPts = direction === "LONG" ? target - driftedEntry : driftedEntry - target;
    const riskPts   = direction === "LONG" ? driftedEntry - stop   : stop - driftedEntry;
    if (riskPts > 0) {
      const rrAfterDrift = rewardPts / riskPts;
      if (rrAfterDrift < cfg.min_rr) {
        reasons.push(`rr_after_drift: ${rrAfterDrift.toFixed(2)} < min ${cfg.min_rr}`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
```

### c:\Users\conor\luke\lib\kat-readiness.js (lines 79-150)
```
function buildKatReadiness(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const now = options.now || new Date();
  const katDir = path.join(rootDir, 'data', 'kat');
  const derivedDir = path.join(katDir, 'derived');
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const audit = buildKatAudit({ rootDir, now });
  const replaySummary = readJson(path.join(derivedDir, 'kat-replay-summary.json'), null);
  const evaluationSummary = readJson(path.join(derivedDir, 'kat-evaluation-summary.json'), null);
  const watchlist = buildKatTickerWatchlist({ rootDir, now, limit: 10 });
  const equityOptions = buildKatEquityOptionsUniverse({ rootDir, now, limit: 20 });
  const sourceText = options.sourceText || readText(path.join(rootDir, 'agents', 'agent-14-kat.js'));
  const runtime = options.runtime || {};

  const checks = [
    scoreCheck((config.monitored_users || []).length > 0, 'monitored analysts configured', `${(config.monitored_users || []).length} configured`),
    scoreCheck((config.monitored_channels || []).length > 0 || (config.monitored_channel_ids || []).length > 0, 'monitored channels configured', `${(config.monitored_channels || []).length} names / ${(config.monitored_channel_ids || []).length} ids`),
    scoreCheck(audit.raw.total > 1000, 'historical capture depth', `${audit.raw.total} raw messages captured`),
    scoreCheck(audit.files.raw_feed.bad_lines === 0, 'raw feed parses cleanly', `${audit.files.raw_feed.bad_lines} malformed raw JSONL lines`),
    scoreCheck(audit.files.processed_signals.bad_lines === 0, 'processed signal feed parses cleanly', `${audit.files.processed_signals.bad_lines} malformed processed JSONL lines`),
    scoreCheck(!!replaySummary, 'index replay artifacts exist', replaySummary ? `${replaySummary.parsed_records || 0} replay records` : 'missing replay summary'),
    scoreCheck(!!evaluationSummary, 'SPX/SPY evaluation artifacts exist', evaluationSummary ? `${evaluationSummary.evaluated || 0}/${evaluationSummary.total || 0} evaluated` : 'missing evaluation summary'),
    scoreCheck(!evaluationSummary || (evaluationSummary.evaluated || 0) >= 250, 'SPX/SPY sample size', evaluationSummary ? `${evaluationSummary.evaluated || 0} evaluated direct records` : 'missing evaluation', 'warning'),
    scoreCheck(watchlist.candidates.length > 0, 'non-index shadow watchlist exists', `${watchlist.candidates.length} candidates`),
    scoreCheck(equityOptions.tickers.length > 0, 'equity/options shadow profiles exist', `${equityOptions.tickers.length} profiles`),
    scoreCheck(equityOptions.ready_for_backtest.length > 0, 'downstream validation queue exists', `${equityOptions.ready_for_backtest.length} ticker(s) ready for backtest`, 'warning'),
    scoreCheck(hasSourceSafetyGate(sourceText), 'Discord output gate present', 'safeReply/safeSend suppress Discord output unless explicitly approved'),
    scoreCheck(hasNoMentionSafety(sourceText), 'Discord mention safety present', 'allowedMentions disables parsing and reply pings'),
    scoreCheck(config.discord_responses_enabled !== true, 'Discord command replies gated off', 'responses are disabled unless explicitly approved'),
    scoreCheck(config.discord_posts_enabled !== true, 'Discord channel posts gated off', 'magnet/confluence posts are disabled unless explicitly approved'),
  ];

  if (typeof runtime.bot_online === 'boolean') {
    checks.push(scoreCheck(runtime.bot_online, 'runtime bot online', runtime.bot_online ? 'online' : 'offline', 'warning'));
  }
  if (typeof runtime.poll_active === 'boolean') {
    checks.push(scoreCheck(runtime.poll_active, 'runtime poll active', runtime.poll_active ? 'active' : 'inactive', 'warning'));
  }

  const recommendation = recommendationFrom(checks, config);
  const blockers = checks.filter(check => !check.ok && check.severity === 'blocker').map(check => `${check.label}: ${check.detail}`);
  const warnings = checks.filter(check => !check.ok && check.severity === 'warning').map(check => `${check.label}: ${check.detail}`);

  return {
    generated_at: now.toISOString(),
    recommendation,
    discord_output_gate: {
      responses_enabled: config.discord_responses_enabled === true,
      posts_enabled: config.discord_posts_enabled === true,
      env_override_supported: true,
      approval_required: true,
    },
    evidence: {
      raw_messages: audit.raw.total,
      processed_signals: audit.processed.total,
      heatmap_candidates: audit.raw.heatmap_candidates,
      replay_records: replaySummary ? replaySummary.parsed_records || 0 : 0,
      spx_spy_evaluated: evaluationSummary ? evaluationSummary.evaluated || 0 : 0,
      watchlist_candidates: watchlist.candidates.map(candidate => candidate.ticker),
      equity_options_ready_for_backtest: equityOptions.ready_for_backtest,
    },
    checks,
    blockers,
    warnings,
    owner_review_notes: [
      'Recommend silent capture and Luke-only shadow evidence before any public Discord answering.',
      'Do not enable Discord replies or channel posts until Conor explicitly approves generated wording.',
      'No autonomous execution exists here; all outputs remain human-gated evidence.',
      'Backtesting/scoring remains owned by the separate backtesting lane.',
    ],
  };
}
```


## Source Files:

- `lib\kat-readiness.js`
- `trading\broker-tradovate.js`
- `trading\common.js`
- `trading\execution-live.js`
- `trading\execution-paper.js`
- `trading\execution-shadow.js`
- `trading\market-context.js`
- `trading\metrics.js`
- `trading\risk.js`
- `trading\router.js`
- `trading\signals.js`

