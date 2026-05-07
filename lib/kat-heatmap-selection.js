'use strict';

const HEATMAP_REQUESTS_CHANNEL_ID = '1482431257441996850';
const HEATMAP_REQUESTS_CHANNEL_NAME = 'heatmap-requests';
const HEATMAP_TERMS_RE = /\b(heatmap|heat map|node|king|gatekeeper|gex|gamma)\b/i;

function normalizeHeatmapTickerToken(token) {
  return String(token || '')
    .trim()
    .replace(/^[#$]+/, '')
    .replace(/[^a-z0-9_./-]/gi, '')
    .replace(/[./-]F$/i, '_F')
    .toUpperCase();
}

function taggedTickersFromText(text) {
  const tickers = new Set();
  const re = /[$#]([a-z][a-z0-9_./-]{0,14})/gi;
  let match;
  while ((match = re.exec(String(text || ''))) !== null) {
    const ticker = normalizeHeatmapTickerToken(match[1]);
    if (ticker) tickers.add(ticker);
  }
  return [...tickers];
}

function requestedTickerAliases(ticker) {
  const canonical = normalizeHeatmapTickerToken(ticker);
  if (canonical === 'SPX') return new Set(['SPX', 'SPXW', 'SPY', 'ES', 'ES_F', 'MES', 'MES_F']);
  if (canonical === 'SPY') return new Set(['SPY', 'SPX', 'SPXW', 'ES', 'ES_F', 'MES', 'MES_F']);
  if (canonical === 'ES' || canonical === 'MES') return new Set(['ES', 'ES_F', 'MES', 'MES_F', 'SPX', 'SPXW', 'SPY']);
  if (canonical === 'QQQ') return new Set(['QQQ', 'NDX', 'NQ', 'NQ_F', 'MNQ', 'MNQ_F']);
  return new Set([canonical]);
}

function isHeatmapChannelEntry(entry) {
  return entry && (
    entry.channel_id === HEATMAP_REQUESTS_CHANNEL_ID ||
    entry.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME
  );
}

function isHeatmapishEntry(entry) {
  return HEATMAP_TERMS_RE.test(entry && entry.content || '') || isHeatmapChannelEntry(entry);
}

function heatmapChannelMatchesRequestedTicker(entry, requestedTicker) {
  const tagged = taggedTickersFromText(entry && entry.content);
  if (!tagged.length) return true;

  const allowed = requestedTickerAliases(requestedTicker);
  return tagged.some(ticker => allowed.has(ticker));
}

module.exports = {
  HEATMAP_REQUESTS_CHANNEL_ID,
  HEATMAP_REQUESTS_CHANNEL_NAME,
  heatmapChannelMatchesRequestedTicker,
  isHeatmapChannelEntry,
  isHeatmapishEntry,
  taggedTickersFromText,
};
