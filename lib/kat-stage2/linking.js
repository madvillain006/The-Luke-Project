'use strict';

const { normalizeSymbol } = require('./instruments');
const { toMs } = require('./io');

const SPX_FAMILY = new Set(['SPX', 'SPY', 'ES', 'MES']);
const QQQ_FAMILY = new Set(['QQQ', 'NDX', 'NQ', 'MNQ']);

function sameSymbolFamily(a, b) {
  const aa = normalizeSymbol(a);
  const bb = normalizeSymbol(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  return (SPX_FAMILY.has(aa) && SPX_FAMILY.has(bb)) || (QQQ_FAMILY.has(aa) && QQQ_FAMILY.has(bb));
}

function sameAnalyst(a, b) {
  return String(a.analyst_id || '') === String(b.analyst_id || '') ||
    (a.analyst_name && b.analyst_name && String(a.analyst_name).toLowerCase() === String(b.analyst_name).toLowerCase());
}

function linkConfidence(base, reasons) {
  return Math.min(0.98, Math.round((base + reasons.length * 0.08) * 100) / 100);
}

function findPriorTrade(item, trades, options = {}) {
  const itemMs = toMs(item.timestamp_utc);
  const maxHours = options.maxHours || 24;
  const candidates = trades
    .filter(trade => {
      const tradeMs = toMs(trade.timestamp_utc);
      if (!Number.isFinite(itemMs) || !Number.isFinite(tradeMs) || tradeMs > itemMs) return false;
      if (itemMs - tradeMs > maxHours * 60 * 60 * 1000) return false;
      if (!sameAnalyst(item, trade)) return false;
      if (item.symbol && trade.normalized_symbol && !sameSymbolFamily(item.symbol, trade.normalized_symbol)) return false;
      return trade.parse_status !== 'ambiguous';
    })
    .sort((a, b) => toMs(b.timestamp_utc) - toMs(a.timestamp_utc));
  return candidates[0] || null;
}

function linkTradeUpdates(trades, updates, options = {}) {
  const linked = updates.map(update => {
    const prior = findPriorTrade(update, trades, { maxHours: options.maxUpdateLinkHours || 24 });
    if (!prior) {
      return { ...update, trade_id: null, link_confidence: 0, link_notes: ['no_prior_trade_match'] };
    }
    const reasons = ['same_analyst', 'prior_trade'];
    if (update.symbol && sameSymbolFamily(update.symbol, prior.normalized_symbol)) reasons.push('symbol_match');
    return {
      ...update,
      trade_id: prior.trade_id,
      link_confidence: linkConfidence(0.55, reasons),
      link_notes: reasons,
    };
  });
  return linked;
}

function linkGainsPosts(trades, gainsPosts, options = {}) {
  return gainsPosts.map(gains => {
    const prior = findPriorTrade(gains, trades, { maxHours: options.maxGainsLinkHours || 48 });
    if (!prior) {
      return {
        ...gains,
        linked_trade_id: null,
        verification_status: 'gains_only_unverified',
        link_confidence: 0,
      };
    }
    const reasons = ['same_analyst', 'prior_trade'];
    if (gains.symbol && sameSymbolFamily(gains.symbol, prior.normalized_symbol)) reasons.push('symbol_match');
    const confidence = linkConfidence(0.5, reasons);
    return {
      ...gains,
      linked_trade_id: prior.trade_id,
      verification_status: confidence >= (options.minConfidenceForVerifiedLink || 0.65)
        ? 'linked_to_prior_call'
        : 'ambiguous',
      link_confidence: confidence,
    };
  });
}

function linkHeatmapsToTrades(trades, heatmaps, options = {}) {
  const maxMinutes = options.maxHeatmapLinkMinutes || 180;
  const linkedHeatmaps = heatmaps.map(heatmap => ({ ...heatmap, linked_trade_ids: [], link_confidence: 0 }));
  const tradeHeatmapLinks = [];
  for (const trade of trades) {
    const tradeMs = toMs(trade.timestamp_utc);
    if (!Number.isFinite(tradeMs)) continue;
    const candidates = [];
    for (const heatmap of linkedHeatmaps) {
      const heatmapMs = toMs(heatmap.timestamp_utc);
      if (!Number.isFinite(heatmapMs) || heatmapMs > tradeMs) continue;
      const delta = tradeMs - heatmapMs;
      if (delta > maxMinutes * 60 * 1000) continue;
      const symbolOk = heatmap.symbol && trade.normalized_symbol && sameSymbolFamily(heatmap.symbol, trade.normalized_symbol);
      const analystOk = sameAnalyst(heatmap, trade);
      if (!symbolOk && !analystOk) continue;
      const reasons = ['heatmap_before_trade', 'within_' + maxMinutes + 'm'];
      if (symbolOk) reasons.push('symbol_family_match');
      if (analystOk) reasons.push('same_analyst');
      const confidence = linkConfidence(0.48, reasons);
      candidates.push({ heatmap, delta, confidence, reasons });
    }
    const best = candidates.sort((a, b) => b.confidence - a.confidence || a.delta - b.delta)[0];
    if (!best) continue;
    best.heatmap.linked_trade_ids.push(trade.trade_id);
    best.heatmap.link_confidence = Math.max(best.heatmap.link_confidence || 0, best.confidence);
    tradeHeatmapLinks.push({
      trade_id: trade.trade_id,
      heatmap_id: best.heatmap.heatmap_id,
      source_message_id: best.heatmap.source_message_id,
      link_confidence: best.confidence,
      link_notes: [...best.reasons, 'nearest_qualifying_heatmap_only'],
      minutes_before_trade: Math.round(best.delta / 60000),
    });
  }
  return { heatmaps: linkedHeatmaps, trade_heatmap_links: tradeHeatmapLinks };
}

function linkStage2(parsed, assumptions = {}) {
  const trade_updates = linkTradeUpdates(parsed.trade_calls, parsed.trade_updates, assumptions);
  const gains_posts = linkGainsPosts(parsed.trade_calls, parsed.gains_posts, assumptions);
  const heatmapLinks = linkHeatmapsToTrades(parsed.trade_calls, parsed.heatmaps, assumptions);
  return {
    ...parsed,
    trade_updates,
    gains_posts,
    heatmaps: heatmapLinks.heatmaps,
    trade_heatmap_links: heatmapLinks.trade_heatmap_links,
    summary: {
      ...parsed.summary,
      linked_updates: trade_updates.filter(row => row.trade_id).length,
      linked_gains: gains_posts.filter(row => row.verification_status === 'linked_to_prior_call').length,
      gains_only_unverified: gains_posts.filter(row => row.verification_status === 'gains_only_unverified').length,
      linked_heatmaps: heatmapLinks.trade_heatmap_links.length,
    },
  };
}

module.exports = {
  findPriorTrade,
  linkGainsPosts,
  linkHeatmapsToTrades,
  linkStage2,
  linkTradeUpdates,
  sameSymbolFamily,
};
