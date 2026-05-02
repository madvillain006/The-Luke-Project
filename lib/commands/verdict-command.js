'use strict';

const { renderVerdict } = require('../renderers/verdict-renderer');

async function handleVerdictCommand(message, res, deps) {
  const {
    getPhase2WorkflowLoadStatus,
    loadSatyLevels,
    getLivePrice,
  } = deps;

  const args = message.slice('/verdict'.length).trim().split(/\s+/).filter(Boolean);
  const hasAll = args.includes('all');
  const instrArgs = args.filter(a => a.toLowerCase() !== 'all').map(a => a.toUpperCase());

  const DEFAULT_INSTRUMENTS = ['ES', 'SPX', 'SPY'];
  const instruments = instrArgs.length > 0 ? instrArgs : DEFAULT_INSTRUMENTS;
  const topN = hasAll ? Infinity : 5;

  const workflowStatus = getPhase2WorkflowLoadStatus();
  const satyStatus = loadSatyLevels();
  const missing = [];
  if (!satyStatus) missing.push('/saty');
  if (!workflowStatus.bobbyLoaded) missing.push('/heatmap');
  if (missing.length > 0) {
    return res.json({
      reply: `No fresh confluence verdict available. Run ${missing.join(', ')} first, then /ready before /verdict.`,
    });
  }

  // Fetch live prices - must be a live network call, no hardcoded fallback.
  let livePrice = null;
  let priceError = false;
  try {
    livePrice = await getLivePrice();
    if (!livePrice) {
      priceError = true;
      console.warn('[verdict] getLivePrice returned null - API key missing or no data');
    }
  } catch (err) {
    priceError = true;
    console.warn('[verdict] getLivePrice failed:', err.message);
  }

  const usablePrice = entry => Number.isFinite(entry?.price) && entry.stale !== true && entry.delayed !== true && (entry.confidence ?? 0) >= 0.6
    ? entry.price
    : null;
  const currentPrices = {
    NQ: usablePrice(livePrice?.instruments?.nq),
    ES: usablePrice(livePrice?.instruments?.es),
    SPX: usablePrice(livePrice?.instruments?.spx),
    QQQ: usablePrice(livePrice?.instruments?.qqq),
    SPY: usablePrice(livePrice?.instruments?.spy),
  };

  const reply = renderVerdict(instruments, { currentPrices, topN, priceError });
  return res.json({ reply });
}

module.exports = { handleVerdictCommand };
