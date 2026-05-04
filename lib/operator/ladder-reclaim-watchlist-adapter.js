'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, RESEARCH_ARTIFACT_DIR, readJson } = require('../research/common');

const CANDIDATE_NAME = 'ladder_reclaim_bobby_mancini_staged_v1';
const CANDIDATE_STATUS = 'PAPER_CANDIDATE';

function rel(filePath) {
  if (!filePath) return null;
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function relMaybeAbsolute(value) {
  if (!value) return null;
  const resolved = path.isAbsolute(value) ? value : path.join(ROOT, value);
  return rel(resolved);
}

function safeReadJson(readJsonFn, fileName, fallback = null) {
  return readJsonFn(path.join(RESEARCH_ARTIFACT_DIR, fileName), fallback);
}

function compactAccountSim(account) {
  if (!account) return null;
  return {
    account: account.account || null,
    mode: account.mode || null,
    trades: account.total_trades ?? account.trades ?? null,
    cumulative_pnl: account.cumulative_pnl ?? null,
    max_drawdown: account.max_drawdown ?? null,
    target: account.target ?? null,
    target_hit: Boolean(account.target_hit),
    failed: Boolean(account.account_failed ?? account.failed),
    continuous_profitable: Boolean(account.continuous_profitable),
    profit_factor: account.profit_factor ?? null,
    average_trade_pnl: account.average_trade_pnl ?? null,
    positive_day_rate: account.positive_day_rate ?? null,
  };
}

function compactStagedVariant(variant) {
  if (!variant) return null;
  return {
    variant: variant.variant || null,
    account: variant.account || null,
    trades: variant.trades ?? null,
    add_triggers: variant.add_triggers ?? null,
    cumulative_pnl: variant.cumulative_pnl ?? null,
    max_drawdown: variant.max_drawdown ?? null,
    target_hit: Boolean(variant.target_hit),
    failed: Boolean(variant.failed),
    continuous_profitable: Boolean(variant.continuous_profitable),
    profit_factor: variant.profit_factor ?? null,
    average_trade_pnl: variant.average_trade_pnl ?? null,
    positive_day_rate: variant.positive_day_rate ?? null,
  };
}

function latestArtifactSummary({ readJsonFn = readJson } = {}) {
  const visualReviewPath = path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-visual-review.html');
  const multiSourcePath = path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-results.json');
  const manifest = safeReadJson(readJsonFn, 'ladder-reclaim-case-image-manifest.json', {});
  const multiSource = readJsonFn(multiSourcePath, {});
  return {
    visual_review_route: '/research/ladder-reclaim-watchlist',
    visual_review_path: rel(visualReviewPath),
    source_results_path: rel(multiSourcePath),
    generated_at: multiSource?.summary?.generated_at || null,
    visual_review_generated_at: manifest.generated_at || null,
    positive_image_folder: relMaybeAbsolute(manifest.out_dir ? path.join(manifest.out_dir, 'positive') : null),
    negative_image_folder: relMaybeAbsolute(manifest.out_dir ? path.join(manifest.out_dir, 'negative') : null),
    positive_image_count: Array.isArray(manifest.positive) ? manifest.positive.length : null,
    negative_image_count: Array.isArray(manifest.negative) ? manifest.negative.length : null,
    image_manifest: relMaybeAbsolute(manifest.manifest),
    exists: {
      visual_review_html: fs.existsSync(visualReviewPath),
      source_results_json: fs.existsSync(multiSourcePath),
      image_manifest: Boolean(manifest.manifest && fs.existsSync(manifest.manifest)),
    },
  };
}

function caseImageSummaries({ readJsonFn = readJson } = {}) {
  const manifest = safeReadJson(readJsonFn, 'ladder-reclaim-case-image-manifest.json', {});
  const summarize = (kind, item, index) => {
    if (!item) return null;
    return {
      kind,
      index,
      label: kind === 'positive' ? 'Good example: first reclaim worked' : 'Bad example: reclaim failed / stop-first',
      date: item.date || null,
      timestamp_et: item.timestamp_et || null,
      source_combo: item.source_combo || null,
      result: item.result || null,
      image_route: `/api/research/ladder-reclaim-watchlist/image?kind=${kind}&index=${index}`,
      png_path: relMaybeAbsolute(item.png),
      html_path: relMaybeAbsolute(item.html),
    };
  };
  return {
    positive: summarize('positive', Array.isArray(manifest.positive) ? manifest.positive[0] : null, 0),
    negative: summarize('negative', Array.isArray(manifest.negative) ? manifest.negative[0] : null, 0),
  };
}

function getLadderReclaimCaseImagePath({ kind = 'positive', index = 0, readJsonFn = readJson } = {}) {
  const safeKind = kind === 'negative' ? 'negative' : 'positive';
  const safeIndex = Math.max(0, Math.min(50, Number(index) || 0));
  const manifest = safeReadJson(readJsonFn, 'ladder-reclaim-case-image-manifest.json', {});
  const row = Array.isArray(manifest[safeKind]) ? manifest[safeKind][safeIndex] : null;
  if (!row || !row.png) return null;
  const resolved = path.resolve(row.png);
  const allowedRoot = path.resolve(ROOT, 'artifacts', 'review');
  if (!resolved.startsWith(allowedRoot + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

function buildLadderReclaimWatchlistResponse({
  instrument = 'ES',
  readJsonFn = readJson,
} = {}) {
  const blockers = [];
  const normalized = String(instrument || 'ES').toUpperCase();
  const bobbyMancini = safeReadJson(readJsonFn, 'ladder-reclaim-bobby-mancini-review.json', {});
  const account25OneEsReview = safeReadJson(readJsonFn, 'ladder-reclaim-25k-1es-review.json', {});
  const staged = safeReadJson(readJsonFn, 'ladder-reclaim-staged-add-analysis.json', {});
  const falsePositives = safeReadJson(readJsonFn, 'ladder-reclaim-false-positives.json', {});
  const sourceResults = safeReadJson(readJsonFn, 'multi-source-ladder-reclaim-results.json', {});
  const summary = sourceResults?.summary || {};
  const accountSim = summary.account_sim || {};
  const bm = bobbyMancini.summary || {};
  const best25k = staged.best_variant_25k || staged.account_25k?.best_variant || staged.best_variant || null;
  const best50k = staged.best_variant_50k || staged.account_50k?.best_variant || null;

  if (!bm.rows) blockers.push('Bobby+Mancini visual review artifact missing or empty');
  if (!summary.rows && !summary.first_reclaim_candidates) blockers.push('multi-source ladder reclaim source results unavailable');
  if (!best25k) blockers.push('25k staged-add artifact missing or empty');
  if (!best50k) blockers.push('50k staged-add artifact missing or empty; rerun research:ladder-reclaim-review');

  return {
    ok: blockers.length === 0,
    endpoint_type: 'ladder_reclaim_watchlist',
    read_only: true,
    no_execution: true,
    no_trade_recommendation: true,
    instrument: normalized,
    candidate: {
      name: CANDIDATE_NAME,
      status: CANDIDATE_STATUS,
      status_reason: 'Promising Bobby+Mancini first-reclaim visual review plus staged-add diagnostics; manual paper review candidate only, with no automation, paper-only route, or live promotion.',
      promoted_live: false,
      promoted_paper_only: false,
    },
    research_stats: {
      examples: bm.unique_setups ?? bm.rows ?? null,
      bobby_mancini_rows: bm.rows ?? null,
      tp_plus_2_rate: bm.tp_plus_2_rate ?? null,
      stop_first_rate: bm.stop_first_rate ?? null,
      avg_heat_before_tp1: bm.avg_heat_before_tp1 ?? null,
      median_heat_before_tp1: bm.median_heat_before_tp1 ?? null,
      avg_stop_points: bm.avg_stop_points ?? null,
      stop_points_range: bm.stop_points_range || null,
      account_25k_1es_visual_review: account25OneEsReview || null,
      account_25k_1es: compactAccountSim(accountSim['25k_1ES_STARTER']),
      account_25k_2es: compactAccountSim(accountSim['25k_2ES_FULL']),
      account_50k_1es: compactAccountSim(accountSim['50k_1ES_STARTER']),
      account_50k_2es: compactAccountSim(accountSim['50k_2ES_FULL']),
      best_staged_add_25k: compactStagedVariant(best25k),
      best_staged_add_50k: compactStagedVariant(best50k),
      false_positive_categories: falsePositives?.summary?.category_counts || {},
    },
    live_state: {
      available: false,
      state: 'UNKNOWN',
      active_level_cluster: null,
      bobby_mancini_confluence_present: null,
      first_reclaim_state: 'UNKNOWN',
      retest_hold_state: 'UNKNOWN',
      one_es_starter_watch: 'UNKNOWN',
      add_after_retest_hold_watch: 'UNKNOWN',
      tp1_reference: null,
      stop_reference: null,
      invalidation: null,
      data_freshness: 'UNKNOWN',
      market_data_state: 'UNKNOWN',
      message: 'Historical research summary only. Live detection unavailable/UNKNOWN.',
    },
    artifact_summary: latestArtifactSummary({ readJsonFn }),
    example_images: caseImageSummaries({ readJsonFn }),
    warnings: [
      'Research only. Not a trade recommendation.',
      'No execution controls exist on this surface.',
      'Candidate is not PAPER_ONLY and not LIVE.',
      '25k 2ES failed in the broader sim; 25k 1ES and 50k diagnostics remain research-only.',
      'Fresh live-market observation is still required before any paper-only promotion.',
    ],
    blockers,
  };
}

module.exports = {
  CANDIDATE_NAME,
  CANDIDATE_STATUS,
  buildLadderReclaimWatchlistResponse,
  compactAccountSim,
  compactStagedVariant,
  caseImageSummaries,
  getLadderReclaimCaseImagePath,
  latestArtifactSummary,
};
