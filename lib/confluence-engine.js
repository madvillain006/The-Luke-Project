'use strict';

const { queryLevels } = require('./level-memory');

// Allow test-time override of queryLevels without modifying level-memory.js.
let _queryLevelsFn = queryLevels;

// ── CROSS-INSTRUMENT EQUIVALENCE ────────────────────────────────────────────────
//
// ES↔SPX: ES trades ABOVE SPX cash by ~30pts. Querying ES and finding a SPX level:
//   normalize SPX price → ES scale by adding +30 (basis +30).
// Querying SPX and finding an ES level: subtract 30 (basis −30).
// NQ↔QQQ: NQ ≈ QQQ × 41.3.
// Basis/multiplier values come from live-price.js approximations — they drift over time.
// TECH_DEBT: replace with rolling-basis calculation in a future phase.

const INSTRUMENT_EQUIVALENCE = {
  ES:  { equivalents: [{ instrument: 'SPX', basis: +30 }],        tolerance: 5   },
  SPX: { equivalents: [{ instrument: 'ES',  basis: -30 }],        tolerance: 5   },
  NQ:  { equivalents: [{ instrument: 'QQQ', multiplier: 41.3 }],  tolerance: 50  },
  QQQ: { equivalents: [{ instrument: 'NQ',  divisor:   41.3 }],   tolerance: 1.5 },
  SPY: { equivalents: [],                                          tolerance: 0.5 },
};

// ── RECENCY HELPER ───────────────────────────────────────────────────────────────

// Returns the ISO cutoff string for N trading days back (weekends excluded; holidays
// are not excluded — slight over-inclusion, matching level-memory.js approach).
function tradingDayCutoff(days) {
  const cutoff = new Date();
  let remaining = days;
  while (remaining > 0) {
    cutoff.setDate(cutoff.getDate() - 1);
    const dow = cutoff.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return cutoff.toISOString();
}

function withinTradingDays(timestamp, days) {
  if (!timestamp) return false;
  return timestamp >= tradingDayCutoff(days);
}

// ── ANALYST SUMMARY STRING ───────────────────────────────────────────────────────

// Builds a human-readable analyst attribution string from a canonical record's mentions[].
// Examples:
//   "dubz key+flip only"
//   "2 analysts: dubz key+flip, saty ATR"
//   "3 analysts: dubz key+flip, saty ATR, bobby vision-confirmed"
function buildAnalystSummaryString(mentions) {
  const byAnalyst = new Map();
  for (const m of mentions) {
    if (!byAnalyst.has(m.analyst)) byAnalyst.set(m.analyst, []);
    byAnalyst.get(m.analyst).push(m);
  }

  const tags = [];
  for (const [analyst, ms] of byAnalyst) {
    const best = ms.find(m => m.significance === 'key') || ms[0];

    if (analyst === 'saty') {
      tags.push('saty ATR');
    } else if (analyst === 'bobby') {
      const hasConfirmed = ms.some(m => m.crossSourceConfirmed === true);
      tags.push(hasConfirmed ? 'bobby vision-confirmed' : 'bobby vision');
    } else if (analyst === 'dubz') {
      const sig = best.significance === 'key' ? 'key' : best.significance;
      const dir = best.direction ? `+${best.direction}` : '';
      tags.push(`dubz ${sig}${dir}`);
    } else {
      tags.push(analyst);
    }
  }

  if (tags.length === 0) return 'no analyst data';
  if (tags.length === 1) return `${tags[0]} only`;
  return `${tags.length} analysts: ${tags.join(', ')}`;
}

// ── SCORING ───────────────────────────────────────────────────────────────────────

// Grade thresholds (initial values — tuned in Phase 5 with backtest data):
//   A: score >= 0.75
//   B: score >= 0.55
//   C: score >= 0.35
//   D: score >= 0.20
//   F: score <  0.20

function gradeFromScore(score) {
  if (score >= 0.75) return 'A';
  if (score >= 0.55) return 'B';
  if (score >= 0.35) return 'C';
  if (score >= 0.20) return 'D';
  return 'F';
}

/**
 * scoreLevel(canonicalRecord, opts) → { score, grade, flags, breakdown }
 *
 * canonicalRecord: a record from queryLevels (the full record with mentions[]).
 * opts:
 *   currentPrice — instrument's current price for staleness check (optional)
 *
 * Scoring formula (initial — tuned in Phase 5):
 *   - Distinct analyst count × 0.20, capped at 4 analysts (max 0.80)
 *   - +0.15 if any mention has significance: 'key'
 *   - +0.10 if any mention is a king node (bobby + key + direction: null)
 *   - +0.15 if any mention has crossSourceConfirmed: true
 *   - +0.10 if most-recent mention is within 5 trading days
 *   - Capped at 1.0
 */
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

// ── CROSS-INSTRUMENT QUERY ────────────────────────────────────────────────────────

// Convert price from an equivalent instrument's scale into the primary instrument's scale.
function _normalizePrice(price, equivConfig) {
  if (equivConfig.basis      != null) return price + equivConfig.basis;
  if (equivConfig.multiplier != null) return price * equivConfig.multiplier;
  if (equivConfig.divisor    != null) return price / equivConfig.divisor;
  return price;
}

/**
 * queryLevelsAcrossEquivalents(instrument, opts)
 *
 * 1. Calls queryLevels({ instrument }) for native records.
 * 2. For each equivalent instrument, calls queryLevels and normalizes prices.
 * 3. Returns merged list. Each record gains a cross_instrument_origin field:
 *      null  — native record
 *      { instrument, original_price }  — from an equivalent
 *
 * Cross-instrument equivalence is handled HERE, not in Level Memory (C1).
 */
function queryLevelsAcrossEquivalents(instrument) {
  const config = INSTRUMENT_EQUIVALENCE[instrument];

  const nativeLevels = _queryLevelsFn({ instrument }).map(record => ({
    ...record,
    cross_instrument_origin: null,
  }));

  if (!config || !config.equivalents || config.equivalents.length === 0) {
    return nativeLevels;
  }

  const equivalentLevels = [];
  for (const equiv of config.equivalents) {
    const equivRecords = _queryLevelsFn({ instrument: equiv.instrument });
    for (const record of equivRecords) {
      const normalizedPrice = _normalizePrice(record.canonical_price, equiv);
      equivalentLevels.push({
        ...record,
        canonical_price: normalizedPrice,
        instrument,
        cross_instrument_origin: {
          instrument:     equiv.instrument,
          original_price: record.canonical_price,
        },
      });
    }
  }

  return [...nativeLevels, ...equivalentLevels];
}

// ── VERDICT OUTPUT BUILDER ─────────────────────────────────────────────────────────

// Format a price for display — strips trailing decimal zeros.
function _fmtPrice(price) {
  return parseFloat(price.toFixed(4)).toString();
}

/**
 * buildVerdictMarkdown(instruments, opts) → markdown string
 *
 * Pure function (no I/O). Used by the /verdict slash command and directly testable.
 *
 * opts:
 *   currentPrices — { [instrument]: number|null } for staleness grounding
 *   topN          — cap per instrument (default 5; Infinity = 'all')
 */
function buildVerdictMarkdown(instruments, opts = {}) {
  const { currentPrices = {}, topN = 5, priceError = false } = opts;
  const timestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const verdictReadme = 'Read: ranked confluence only. Use /entries ES for pass/trade plan, anchor, stop, target, and vetoes.';

  const lines = [`## Confluence verdict — ${timestamp}`];

  for (const instrument of instruments) {
    if (lines.length === 1) lines.push(verdictReadme);

    const currentPrice = currentPrices[instrument] ?? null;
    const priceLabel = priceError
      ? ' (current: API Error)'
      : currentPrice != null
        ? ` (current: ${_fmtPrice(currentPrice)})`
        : '';
    lines.push('', `### ${instrument}${priceLabel}`);

    const records = _queryLevelsFn({ instrument });
    if (records.length === 0) {
      lines.push('No levels recorded yet. Next: load /saty, /dubz, /heatmap, then rerun /verdict.');
      continue;
    }

    // Score and sort
    const scored = records.map(record => ({
      record,
      result: scoreLevel(record, { currentPrice }),
    }));
    scored.sort((a, b) => b.result.score - a.result.score);

    const limited = topN === Infinity ? scored : scored.slice(0, topN);

    for (const { record, result } of limited) {
      const { score, grade, flags } = result;
      const priceStr = _fmtPrice(record.canonical_price);
      const scoreStr = score.toFixed(2);
      const summary  = buildAnalystSummaryString(record.mentions);

      const flagParts = [];
      if (flags.some(f => f.type === 'king_node'))          flagParts.push('king node');
      if (flags.some(f => f.type === 'vision_disagreement')) flagParts.push('⚠ vision disagreement');
      if (flags.some(f => f.type === 'stale'))              flagParts.push('(stale)');
      const flagStr = flagParts.length > 0 ? `  ${flagParts.join('  ')}` : '';

      lines.push(
        `- **${instrument} ${priceStr}**  →  **${grade}** (${scoreStr})  ${summary}${flagStr}`
      );
    }
  }

  return lines.join('\n');
}

module.exports = {
  scoreLevel,
  queryLevelsAcrossEquivalents,
  buildVerdictMarkdown,
  INSTRUMENT_EQUIVALENCE,
  _internal: {
    withinTradingDays,
    tradingDayCutoff,
    gradeFromScore,
    buildAnalystSummaryString,
    _setQueryLevels:   fn  => { _queryLevelsFn = fn; },
    _resetQueryLevels: ()  => { _queryLevelsFn = queryLevels; },
  },
};
