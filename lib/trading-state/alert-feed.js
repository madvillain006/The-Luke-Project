'use strict';

function alertTypeForState(state) {
  if (state === 'APPROACHING_LEVEL') return 'WATCH';
  if (state === 'FLUSH_DETECTED') return 'WATCH';
  if (state === 'FIRST_RECLAIM_WATCH') return 'WATCH';
  if (state === 'ARMED') return 'ARMED';
  if (state === 'TRADE_CANDIDATE') return 'TRADE CANDIDATE';
  if (state === 'PASS_RISK') return 'PASS';
  if (state === 'PASS_DATA_UNKNOWN') return 'PASS';
  if (state === 'INVALIDATED') return 'INVALIDATED';
  return null;
}

function formatClusterAlert(cluster, context = {}) {
  const type = alertTypeForState(cluster.state);
  if (!type) return null;
  const price = Number.isFinite(cluster.canonical_price_es) ? cluster.canonical_price_es.toFixed(2) : 'UNKNOWN';
  const sources = (cluster.sources || []).join(' + ') || 'unknown';
  const dataMode = context.dataMode || {};
  const isReplayOrDev = dataMode.replay || dataMode.mode === 'dev';
  const modeLine = isReplayOrDev
    ? 'Mode: replay/dev. Not live.'
    : dataMode.live
      ? 'Mode: live data read-only. Not executable.'
      : 'Mode: non-live or unknown data. Not executable.';
  let need = 'continue watching';
  if (cluster.state === 'FLUSH_DETECTED') need = `first reclaim above ${price}`;
  if (cluster.state === 'FIRST_RECLAIM_WATCH') need = `retest hold above ${price}`;
  if (cluster.state === 'ARMED') need = 'paper candidate risk check';
  if (cluster.state === 'INVALIDATED') need = 'stand down; level lost after reclaim';
  const messageType = isReplayOrDev && cluster.state === 'ARMED' ? 'ARMED - REPLAY/DEV' : type;
  return {
    id: `alert:${cluster.id}:${cluster.state}`,
    timestamp: cluster.last_transition_at || new Date().toISOString(),
    type,
    instrument: 'ES',
    level_cluster_id: cluster.id,
    state: cluster.state,
    message: `[${messageType}] ES ${price} level cluster`,
    detail: `Sources: ${sources}\nState: ${cluster.state}\nNeed: ${need}\nRisk: unknown until bracket forms\n${modeLine}\nNo trade yet.`,
    evidence: cluster.evidence || [],
    no_live_execution: true,
  };
}

function formatCandidateAlert(candidate) {
  if (!candidate || !['PAPER_CANDIDATE_SIM', 'PAPER_CANDIDATE_LIVE_DATA', 'LIVE_BLOCKED'].includes(candidate.status)) return null;
  if (candidate.status === 'LIVE_BLOCKED') {
    return {
      id: `alert:${candidate.id}`,
      timestamp: new Date().toISOString(),
      type: 'PASS',
      instrument: candidate.instrument,
      level_cluster_id: candidate.level_cluster_id,
      state: 'LIVE_BLOCKED',
      message: '[PASS - LIVE BLOCKED]',
      detail: [
        `Entry zone: ${candidate.entry_zone?.low}-${candidate.entry_zone?.high}`,
        `Stop: ${candidate.stop}`,
        `TP1: ${candidate.tp1}`,
        `TP2: ${candidate.tp2 ?? 'none'}`,
        `Reason: ${candidate.size_plan?.reason || candidate.size_recommendation?.reason || 'candidate blocked'}`,
        'Mode: replay/dev or non-executable paper context. Not live.',
        'Status: bracket retained for visualization only.',
      ].join('\n'),
      evidence: candidate.evidence || [],
      no_live_execution: true,
    };
  }
  const replay = candidate.status === 'PAPER_CANDIDATE_SIM';
  return {
    id: `alert:${candidate.id}`,
    timestamp: new Date().toISOString(),
    type: replay ? 'ARMED' : 'TRADE CANDIDATE',
    instrument: candidate.instrument,
    level_cluster_id: candidate.level_cluster_id,
    state: 'TRADE_CANDIDATE',
    message: replay ? '[ARMED - REPLAY/PAPER CANDIDATE]' : '[TRADE CANDIDATE - PAPER/LIVE DATA]',
    detail: [
      `Entry zone: ${candidate.entry_zone?.low}-${candidate.entry_zone?.high}`,
      `Stop: ${candidate.stop}`,
      `TP1: ${candidate.tp1}`,
      `TP2: ${candidate.tp2 ?? 'none'}`,
      `Size: ${candidate.size_recommendation?.contracts || 0}ES starter`,
      `Reason: first reclaimed cluster + ${candidate.source_combo} confluence`,
      `Mode: ${replay ? 'replay/dev. Not live.' : 'live data read-only paper candidate. Not executable.'}`,
      'Status: bracket plan only. Human review required.',
    ].join('\n'),
    evidence: candidate.evidence || [],
    no_live_execution: true,
  };
}

function buildAlerts({ clusters = [], candidates = [], dataMode = {} } = {}) {
  const clusterAlerts = clusters.map(cluster => formatClusterAlert(cluster, { dataMode })).filter(Boolean);
  const candidateAlerts = candidates.map(formatCandidateAlert).filter(Boolean);
  const seen = new Set();
  return [...candidateAlerts, ...clusterAlerts].filter(alert => {
    if (seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}

module.exports = {
  buildAlerts,
  formatClusterAlert,
  formatCandidateAlert,
};
