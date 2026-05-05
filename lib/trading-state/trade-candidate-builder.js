'use strict';

const { assessPropRisk, starterSizeRecommendation, normalizeAccountConfig, round } = require('./prop-risk-gate');
const { isMarketDataUsable, STATES } = require('./reclaim-state-machine');

const STRATEGY_PRIMARY = 'ladder_reclaim_bobby_mancini_staged_v1';
const STRATEGY_GENERIC = 'multi_source_ladder_first_reclaim_long';
const CANDIDATE_STATUS = {
  WATCH_ONLY: 'WATCH_ONLY',
  PAPER_CANDIDATE_SIM: 'PAPER_CANDIDATE_SIM',
  PAPER_CANDIDATE_LIVE_DATA: 'PAPER_CANDIDATE_LIVE_DATA',
  PASS_RISK: 'PASS_RISK',
  PASS_NO_TARGET: 'PASS_NO_TARGET',
  PASS_DATA_UNKNOWN: 'PASS_DATA_UNKNOWN',
  INVALIDATED: 'INVALIDATED',
  LIVE_BLOCKED: 'LIVE_BLOCKED',
};

function candidateId(cluster, status) {
  return `tc:${cluster.id}:${status}`.replace(/[^a-zA-Z0-9:_+.-]/g, '_');
}

function hasBobbyMancini(cluster) {
  const sources = cluster.sources || [];
  return sources.includes('heatmap_gex') && sources.includes('mancini');
}

function sourceCombo(cluster) {
  return (cluster.sources || []).join('+') || 'unknown';
}

function replayMode(mode) {
  return mode === 'replay' || mode === 'dev';
}

function canArmPaperCandidate(marketData, mode) {
  if (!isMarketDataUsable(marketData, { allowReplay: replayMode(mode) })) return false;
  if (replayMode(mode)) {
    return marketData?.replay === true && marketData?.usable_for_replay === true;
  }
  return marketData?.live === true && marketData?.usable_for_live_arming === true;
}

function nextTrustedTarget(cluster) {
  const tp2 = Number(cluster.nearest_above);
  return Number.isFinite(tp2) && tp2 > cluster.canonical_price_es ? tp2 : null;
}

function buildBracket({ cluster, marketData, accountConfig, priorLossSameLevel = false } = {}) {
  const level = cluster.canonical_price_es;
  const entry = round(level + 0.25);
  const sweepStop = Number.isFinite(cluster.flush?.sweep_low) ? round(cluster.flush.sweep_low - 0.25) : null;
  const structuralStop = Number.isFinite(sweepStop) && sweepStop < entry ? sweepStop : round(level - 2);
  const tp1 = round(entry + 2);
  const tp2 = nextTrustedTarget(cluster);
  const riskGate = assessPropRisk({
    entry,
    stop: structuralStop,
    contracts: 1,
    accountConfig,
    addSecondConfirmed: Boolean(cluster.reclaim?.retest_hold),
    priorLossSameLevel,
  });

  const tp2Final = Number.isFinite(tp2) && tp2 > tp1 ? tp2 : null;
  const bracketVisual = {
    kind: 'bracket_plan_visual',
    can_submit: false,
    submitted: false,
    live_enabled: false,
    lines: [
      { kind: 'entry', label: 'Entry', price: entry },
      { kind: 'stop', label: 'Stop', price: structuralStop },
      { kind: 'tp1', label: 'TP1', price: tp1 },
      ...(tp2Final ? [{ kind: 'tp2', label: 'TP2', price: tp2Final }] : []),
    ],
  };

  return {
    entry_zone: { low: level, high: entry },
    entry_reference: `first reclaimed cluster ${level}`,
    entry_trigger: `confirm hold/reclaim above ${level}; simulated plan only`,
    stop: structuralStop,
    tp1,
    tp2: tp2Final,
    runner_target: tp2Final,
    add_rule: 'Add 1ES only after retest hold / confirmation; human review required',
    bracket: {
      entry,
      stop: structuralStop,
      tp1,
      tp2: tp2Final,
      size: 1,
      order_type: 'simulated_bracket_plan',
      live_enabled: false,
      can_submit: false,
    },
    bracket_visual: bracketVisual,
    riskGate,
    warnings: Number.isFinite(tp2) && tp2 <= tp1 ? ['nearest trusted cluster is too close for TP2 runner'] : [],
  };
}

function watchOnlyCandidate({ cluster, status = 'WATCH_ONLY', reason, warnings = [] } = {}) {
  const id = candidateId(cluster, status);
  return {
    id,
    candidate_id: id,
    mode: null,
    status,
    strategy: hasBobbyMancini(cluster) ? STRATEGY_PRIMARY : STRATEGY_GENERIC,
    instrument: 'ES',
    source_combo: sourceCombo(cluster),
    level_cluster: cluster ? {
      id: cluster.id,
      price: cluster.canonical_price_es,
      state: cluster.state,
      sources: cluster.sources || [],
      transports: cluster.transports || [],
    } : null,
    level_cluster_id: cluster.id,
    entry_zone: null,
    entry_reference: null,
    entry_trigger: null,
    stop: null,
    tp1: null,
    tp2: null,
    runner_target: null,
    add_rule: 'Add second ES requires retest hold / confirmation; not active while watch-only',
    bracket: null,
    bracket_visual: null,
    size_plan: { starter_contracts: 0, add_contracts: 0, add_requires_confirmation: true },
    risk_dollars: null,
    can_execute_live: false,
    size_recommendation: { mode: 'prop_25k', contracts: 0, reason },
    risk: {
      dollars_per_point: 50,
      stop_points: null,
      risk_dollars: null,
      max_allowed_risk: 500,
      account_gate: status,
    },
    invalidation: `Lose ${cluster.canonical_price_es} after reclaim or no fresh data`,
    evidence: cluster.evidence || [],
    warnings,
  };
}

function blockedPlanCandidate({ cluster, status, reason, warnings = [], plan, account }) {
  const base = watchOnlyCandidate({ cluster, status, reason, warnings });
  return {
    ...base,
    mode: base.mode,
    entry_zone: plan.entry_zone,
    entry_reference: plan.entry_reference,
    entry_trigger: plan.entry_trigger,
    stop: plan.stop,
    tp1: plan.tp1,
    tp2: plan.tp2,
    runner_target: plan.runner_target,
    add_rule: plan.add_rule,
    bracket: { ...plan.bracket, live_enabled: false, can_submit: false },
    bracket_visual: {
      ...plan.bracket_visual,
      blocked_reason: reason,
      can_submit: false,
    },
    size_plan: {
      mode: account.mode,
      starter_contracts: 0,
      add_contracts: 0,
      max_contracts: account.maxContracts,
      add_requires_confirmation: true,
      reason,
    },
    risk_dollars: plan.riskGate.risk_dollars,
    risk: {
      dollars_per_point: plan.riskGate.dollars_per_point,
      stop_points: plan.riskGate.stop_points,
      risk_dollars: plan.riskGate.risk_dollars,
      max_allowed_risk: plan.riskGate.max_allowed_risk,
      account_gate: status,
    },
    can_execute_live: false,
  };
}

function buildTradeCandidateForCluster({
  cluster,
  marketData,
  accountConfig = {},
  priorLossSameLevel = false,
  mode = 'live',
} = {}) {
  const account = normalizeAccountConfig(accountConfig);
  const dataWarnings = marketData?.replay === true
    ? ['REPLAY ONLY - not live arming', 'Local/replay candles cannot arm live candidates']
    : [];
  if (!cluster?.is_executable_es) return null;

  if (!canArmPaperCandidate(marketData, mode)) {
    return watchOnlyCandidate({
      cluster,
      status: CANDIDATE_STATUS.PASS_DATA_UNKNOWN,
      reason: 'fresh ES market data required before any paper candidate',
      warnings: ['stale/delayed/UNKNOWN or unauthorized data cannot arm candidate', ...dataWarnings],
    });
  }

  if (![STATES.ARMED, STATES.TRADE_CANDIDATE].includes(cluster.state)) {
    return watchOnlyCandidate({
      cluster,
      status: CANDIDATE_STATUS.WATCH_ONLY,
      reason: cluster.warnings?.includes('insufficient candle data; can watch/approach but cannot arm')
        ? 'insufficient candle data; watch/approach only'
        : `cluster state ${cluster.state} is not armed`,
      warnings: [...(cluster.warnings || []), ...dataWarnings],
    });
  }

  const plan = buildBracket({ cluster, marketData, accountConfig: account, priorLossSameLevel });
  if (!Number.isFinite(plan.tp1) || plan.tp1 <= plan.bracket.entry) {
    return watchOnlyCandidate({
      cluster,
      status: CANDIDATE_STATUS.PASS_NO_TARGET,
      reason: 'no valid target above entry',
      warnings: ['TP1 unavailable or below entry'],
    });
  }
  const currentPrice = Number(marketData?.price);
  if (Number.isFinite(currentPrice) && currentPrice >= plan.tp1) {
    return blockedPlanCandidate({
      cluster,
      status: CANDIDATE_STATUS.LIVE_BLOCKED,
      reason: 'current/replay price is already beyond TP1; no chase candidate',
      warnings: ['price already beyond TP1; bracket retained for visualization only', ...dataWarnings, ...plan.warnings],
      plan,
      account,
    });
  }
  if (Number.isFinite(currentPrice) && currentPrice <= plan.stop) {
    return blockedPlanCandidate({
      cluster,
      status: CANDIDATE_STATUS.INVALIDATED,
      reason: 'current/replay price is below the planned invalidation stop',
      warnings: ['price below stop; bracket retained for visualization only', ...dataWarnings, ...plan.warnings],
      plan,
      account,
    });
  }
  if (!plan.riskGate.ok) {
    return {
      ...watchOnlyCandidate({
        cluster,
        status: plan.riskGate.status === 'PASS_DATA_UNKNOWN' ? CANDIDATE_STATUS.PASS_DATA_UNKNOWN : CANDIDATE_STATUS.PASS_RISK,
        reason: 'prop risk gate blocked bracket plan',
        warnings: [...plan.warnings, ...plan.riskGate.warnings, ...dataWarnings],
      }),
      entry_zone: plan.entry_zone,
      entry_reference: plan.entry_reference,
      entry_trigger: plan.entry_trigger,
      stop: plan.stop,
      tp1: plan.tp1,
      tp2: plan.tp2,
      runner_target: plan.runner_target,
      add_rule: plan.add_rule,
      bracket: { ...plan.bracket, live_enabled: false },
      bracket_visual: plan.bracket_visual,
      can_execute_live: false,
      risk: {
        dollars_per_point: plan.riskGate.dollars_per_point,
        stop_points: plan.riskGate.stop_points,
        risk_dollars: plan.riskGate.risk_dollars,
        max_allowed_risk: plan.riskGate.max_allowed_risk,
        account_gate: plan.riskGate.account_gate,
      },
    };
  }

  const status = marketData?.replay === true || mode === 'replay' || mode === 'dev'
    ? CANDIDATE_STATUS.PAPER_CANDIDATE_SIM
    : CANDIDATE_STATUS.PAPER_CANDIDATE_LIVE_DATA;
  const id = candidateId(cluster, status);
  return {
    id,
    candidate_id: id,
    mode,
    status,
    strategy: hasBobbyMancini(cluster) ? STRATEGY_PRIMARY : STRATEGY_GENERIC,
    instrument: 'ES',
    source_combo: sourceCombo(cluster),
    level_cluster: {
      id: cluster.id,
      price: cluster.canonical_price_es,
      state: cluster.state,
      sources: cluster.sources || [],
      transports: cluster.transports || [],
    },
    level_cluster_id: cluster.id,
    entry_zone: plan.entry_zone,
    entry_reference: plan.entry_reference,
    entry_trigger: plan.entry_trigger,
    stop: plan.stop,
    tp1: plan.tp1,
    tp2: plan.tp2,
    runner_target: plan.runner_target,
    add_rule: plan.add_rule,
    bracket: plan.bracket,
    bracket_visual: plan.bracket_visual,
    can_execute_live: false,
    size_recommendation: starterSizeRecommendation({ riskGate: plan.riskGate, accountConfig: account }),
    size_plan: {
      mode: account.mode,
      starter_contracts: account.starterContracts,
      add_contracts: 1,
      max_contracts: account.maxContracts,
      add_requires_confirmation: true,
      reason: '1ES starter; add 1ES only after retest hold / confirmation',
    },
    risk: {
      dollars_per_point: plan.riskGate.dollars_per_point,
      stop_points: plan.riskGate.stop_points,
      risk_dollars: plan.riskGate.risk_dollars,
      max_allowed_risk: plan.riskGate.max_allowed_risk,
      account_gate: plan.riskGate.account_gate,
    },
    risk_dollars: plan.riskGate.risk_dollars,
    invalidation: `Close back below ${cluster.canonical_price_es} or break ${plan.stop}`,
    evidence: [
      ...(cluster.evidence || []),
      { source: 'research', role: '1ES_ADD_AFTER_RETEST_HOLD', snippet: '25K 1ES starter; add second ES only after retest hold confirmation' },
    ],
    warnings: [
      'PAPER/RESEARCH ONLY',
      'Not live. Human review required.',
      'Bracket is a plan object only; can_execute_live=false.',
      ...dataWarnings,
      ...plan.warnings,
    ],
  };
}

function buildTradeCandidates({
  clusters = [],
  marketData,
  accountConfig = {},
  priorLossLevels = [],
  mode = 'live',
} = {}) {
  const priorLossSet = new Set((priorLossLevels || []).map(value => String(value)));
  return clusters
    .filter(cluster => cluster.is_executable_es)
    .map(cluster => buildTradeCandidateForCluster({
      cluster,
      marketData,
      accountConfig,
      priorLossSameLevel: priorLossSet.has(String(cluster.canonical_price_es)),
      mode,
    }))
    .filter(Boolean)
    .sort((a, b) => {
      const rank = {
        PAPER_CANDIDATE_SIM: 0,
        PAPER_CANDIDATE_LIVE_DATA: 0,
        PASS_RISK: 1,
        PASS_DATA_UNKNOWN: 2,
        PASS_NO_TARGET: 3,
        LIVE_BLOCKED: 4,
        WATCH_ONLY: 5,
        INVALIDATED: 6,
      };
      const rankDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (rankDiff) return rankDiff;
      const price = Number(marketData?.price);
      if (!Number.isFinite(price)) return 0;
      const ad = Math.abs(Number(a.level_cluster?.price) - price);
      const bd = Math.abs(Number(b.level_cluster?.price) - price);
      return (Number.isFinite(ad) ? ad : 999999) - (Number.isFinite(bd) ? bd : 999999);
    });
}

module.exports = {
  STRATEGY_PRIMARY,
  STRATEGY_GENERIC,
  CANDIDATE_STATUS,
  buildTradeCandidates,
  buildTradeCandidateForCluster,
  buildBracket,
};
