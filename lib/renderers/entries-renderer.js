'use strict';

function formatLoadedFlag(loaded, label, count = null) {
  if (loaded) {
    return count === null ? `${label} OK` : `${label} OK (${count})`;
  }
  return `${label} MISSING`;
}

function formatDecisionFreshnessLine(freshness) {
  if (!freshness) return null;
  const parts = [
    'Saty OK (generated)',
    formatLoadedFlag(Boolean(freshness.dubz?.loaded), 'Dubz', freshness.dubz?.count ?? 0),
    formatLoadedFlag(Boolean(freshness.bobby?.loaded), 'Bobby', freshness.bobby?.count ?? 0),
  ];
  if (freshness.today_et) parts.push(`ET ${freshness.today_et}`);
  return `Freshness: ${parts.join(' | ')}`;
}

function formatVetoLine(vetoes) {
  const list = Array.isArray(vetoes) ? vetoes : [];
  if (list.length === 0) return 'Vetoes: none active';
  const labels = list.map(veto => {
    if (veto.type === 'mancini_chop_zone' && veto.zone) {
      return `Mancini chop zone ${veto.zone.low}-${veto.zone.high}`;
    }
    if (veto.type === 'apex_floor') return 'Apex floor';
    if (veto.type === 'stale_or_missing_input') return `stale/missing ${veto.source || veto.command || 'input'}`;
    return veto.type || 'unknown veto';
  });
  return `Vetoes: ${labels.join(' | ')}`;
}

function formatDecisionTiming(decision, currentPrice, marketData = null) {
  if (!Number.isFinite(currentPrice)) {
    return Number.isFinite(marketData?.price) ? 'WAIT - live price not trusted' : 'WAIT - market price UNKNOWN';
  }
  if (!Number.isFinite(decision.entry) || !Number.isFinite(decision.acceptable_entry)) return 'WAIT';
  if (decision.action === 'LONG') {
    if (currentPrice < decision.entry) return `WAIT - reclaim ${decision.entry}`;
    if (currentPrice <= decision.acceptable_entry) return `LIVE NOW - inside ${decision.entry}-${decision.acceptable_entry}`;
    return `SKIP CHASE - above ${decision.acceptable_entry}`;
  }
  if (decision.action === 'SHORT') {
    if (currentPrice > decision.entry) return `WAIT - lose ${decision.entry}`;
    if (currentPrice >= decision.acceptable_entry) return `LIVE NOW - inside ${decision.acceptable_entry}-${decision.entry}`;
    return `SKIP CHASE - below ${decision.acceptable_entry}`;
  }
  return 'PASS';
}

function formatMarketDataLabel(marketData) {
  if (!Number.isFinite(marketData?.price)) return null;
  const labels = [];
  if (marketData.live === true && marketData.stale !== true && marketData.delayed !== true) labels.push('live');
  if (marketData.replay === true) labels.push('replay');
  if (marketData.delayed === true) labels.push('delayed');
  if (marketData.stale === true) labels.push('reference');
  if (labels.length === 0) labels.push('quoted');
  const source = marketData.source || 'market-data';
  return `${marketData.price} (${labels.join(', ')}; ${source})`;
}

function decisionEvidence(decision, type) {
  return (decision.evidence || []).find(item => item.type === type) || null;
}

function renderEntriesDecision({ instrument, currentPrice, marketData = null, decision, tradeState, katEntryLine = null }) {
  const staleInputVetoes = (decision.vetoes || []).filter(v => v.type === 'stale_or_missing_input');
  if (staleInputVetoes.length > 0) {
    const missing = staleInputVetoes.map(v => v.command).join(', ');
    return [
      `No fresh entries available for ${instrument}.`,
      formatDecisionFreshnessLine(decision.freshness),
      `Missing/stale: ${missing}`,
      `Next: run ${missing}, then /ready before /entries ${instrument}.`,
    ].filter(Boolean).join('\n');
  }

  if (decision.reason === `No levels recorded yet for ${instrument}.`) {
    return [
      `No levels recorded yet for ${instrument}.`,
      formatDecisionFreshnessLine(decision.freshness),
      'Next: load analyst levels, then run /verdict or /entries again.',
    ].filter(Boolean).join('\n');
  }

  const referencePrice = formatMarketDataLabel(marketData);
  const currentLine = Number.isFinite(currentPrice)
    ? `Current: ${instrument} ${currentPrice}`
    : referencePrice
      ? `Current: ${instrument} ${referencePrice}`
      : `Current: ${instrument} market price UNKNOWN`;
  const timing = formatDecisionTiming(decision, currentPrice, marketData);
  const anchor = decision.confluence?.anchor;
  const grade = decision.confluence?.grade;
  const rr = Number.isFinite(decision.target) && Number.isFinite(decision.entry) && Number.isFinite(decision.stop)
    ? Math.abs(decision.target - decision.entry) / Math.abs(decision.entry - decision.stop)
    : null;
  const recommendationLine = decision.action === 'PASS'
    ? decision.confluence
      ? `Recommendation: PASS - ${decision.reason}`
      : `Recommendation: PASS - ${decision.reason}`
    : `Recommendation: ${timing} | ${decision.action} ${instrument} ${anchor} | ${grade} grade | ${decision.sizing} size`;
  const anchorLine = decision.confluence
    ? `Anchor: ${instrument} ${anchor} | ${grade} grade | ${decision.sizing} size | side ${decision.action}`
    : null;
  const freshnessLine = formatDecisionFreshnessLine(decision.freshness);
  const vetoLine = formatVetoLine(decision.vetoes);
  const planLine = !Number.isFinite(decision.entry)
    ? null
    : decision.action === 'PASS'
      ? `Reference only: entry ${decision.entry} | ok ${decision.acceptable_entry} | stop ${decision.stop}${Number.isFinite(decision.target) ? ` | target ${decision.target}` : ''}`
      : `Plan: entry ${decision.entry} | ok ${decision.acceptable_entry} | stop ${decision.stop}${Number.isFinite(decision.target) ? ` | target ${decision.target}` : ''}${Number.isFinite(rr) ? ` | RR ${rr.toFixed(1)}` : ''}`;
  const floorBlock = (decision.vetoes || []).find(v => v.type === 'apex_floor')?.floorBlock || null;
  const floorLine = !(tradeState.apex && tradeState.apex.enabled)
    ? null
    : floorBlock
      ? `Apex floor: BLOCKED - max loss ${floorBlock.maxLoss.toFixed(0)} would breach floor ${floorBlock.floor.toFixed(0)} + ${floorBlock.buffer}`
      : 'Apex floor: OK for this setup';

  const top = (decision.confluence?.top || []).map(row =>
    `- ${row.side} ${instrument} ${row.anchor} ${row.grade} | ${row.sizing} | stop ${row.stop}${Number.isFinite(row.target) ? ` | tgt ${row.target}` : ''}`
  );

  const avoidZones = decisionEvidence(decision, 'avoid_zones')?.zones || [];
  const avoidLines = avoidZones.map(zone => `AVOID: ${zone.low}-${zone.high} (Mancini chop zone)`);

  return [
    `## Futures Entries ${instrument}`,
    currentLine,
    ...(freshnessLine ? [freshnessLine] : []),
    recommendationLine,
    ...(anchorLine ? [anchorLine] : []),
    vetoLine,
    ...(planLine ? [planLine] : []),
    ...(floorLine ? [floorLine] : []),
    ...(katEntryLine ? [katEntryLine] : []),
    'Other levels:',
    ...(top.length > 0 ? top : ['No actionable levels.']),
    ...(avoidLines.length > 0 ? ['Avoid zones:', ...avoidLines] : []),
  ].join('\n');
}

module.exports = {
  renderEntriesDecision,
  formatDecisionFreshnessLine,
  formatVetoLine,
};
