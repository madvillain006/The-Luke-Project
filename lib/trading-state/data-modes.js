'use strict';

const VALID_MODES = ['live', 'delayed', 'replay', 'dev', 'unknown'];

function normalizeMode(value) {
  const mode = String(value || 'live').toLowerCase();
  return VALID_MODES.includes(mode) ? mode : 'unknown';
}

function buildDataModeStatus({ mode = 'live', marketData = {}, candleFeed = {}, allowDelayedArming = false } = {}) {
  const normalized = normalizeMode(mode);
  const requestedReplay = normalized === 'replay' || normalized === 'dev';
  const sourceReplay = candleFeed.replay === true || marketData.replay === true;
  const replay = requestedReplay || sourceReplay;
  const live = normalized === 'live' && candleFeed.live === true && marketData.live === true;
  const delayed = normalized === 'delayed' || candleFeed.delayed === true || marketData.delayed === true;
  const stale = candleFeed.stale === true || marketData.stale === true || !Number.isFinite(Number(marketData.price));
  const unknown = normalized === 'unknown' || candleFeed.source === 'UNKNOWN' || marketData.source === 'UNKNOWN';
  const usableForReplay = candleFeed.usable_for_replay === true || marketData.usable_for_replay === true;
  const usableForLiveArming = live && candleFeed.usable_for_live_arming === true && marketData.usable_for_live_arming === true && !stale && !unknown && (!delayed || allowDelayedArming);
  const canGenerateWatch = Boolean(usableForReplay || Number.isFinite(Number(marketData.price)) || candleFeed.usable_for_live_arming);
  const canGeneratePaperCandidate = requestedReplay ? usableForReplay : usableForLiveArming;
  const canGenerateLiveCandidate = usableForLiveArming;
  let reason = 'mode unavailable';
  if (requestedReplay) reason = 'replay/dev data can generate WATCH and PAPER_CANDIDATE_SIM only';
  else if (sourceReplay) reason = 'local/replay source is not live; live arming disabled';
  else if (usableForLiveArming) reason = delayed ? 'delayed live arming explicitly allowed' : 'fresh live ES candles can support live arming';
  else if (stale || unknown) reason = 'stale or UNKNOWN data cannot arm candidates';
  else if (delayed) reason = 'delayed data is labeled and live arming is disabled by default';

  return {
    mode: replay ? (normalized === 'dev' ? 'dev' : 'replay') : normalized,
    live,
    delayed,
    replay,
    stale,
    usable_for_replay: usableForReplay,
    usable_for_live_arming: usableForLiveArming,
    can_generate_watch: canGenerateWatch,
    can_generate_paper_candidate: canGeneratePaperCandidate,
    can_generate_live_candidate: canGenerateLiveCandidate,
    reason,
  };
}

module.exports = {
  VALID_MODES,
  normalizeMode,
  buildDataModeStatus,
};
