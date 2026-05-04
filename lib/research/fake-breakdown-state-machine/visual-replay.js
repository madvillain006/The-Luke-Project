'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR, readJson, writeJson, writeCsv, tsMs } = require('../common');
const { loadUsableSessions, loadHistoricalCsvBars } = require('../corpus-loader');
const { clusterRuleSignals, analyzeRuleBThrottles, signalPnl } = require('./rule-throttle-analysis');

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function loadWatchlistInputs() {
  return {
    stateResults: readJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-results.json')),
    stateRules: readJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-rules.json'), []),
    accountSim: readJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-state-account-sim.json'), {}),
    v3Results: readJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-v3-results.json')),
  };
}

function buildBarsByDate() {
  const { sessions } = loadUsableSessions();
  const out = new Map();
  for (const session of sessions) out.set(session.date, session.replayBars || []);
  return out;
}

function buildSpxBarsByDate() {
  const bars = loadHistoricalCsvBars('SPX');
  const out = new Map();
  for (const bar of bars || []) {
    const date = String(bar.timestamp || '').slice(0, 10);
    if (!out.has(date)) out.set(date, []);
    out.get(date).push(bar);
  }
  return out;
}

function chartWindow(bars, timestamp, beforeMinutes = 15, afterMinutes = 30) {
  const t = tsMs(timestamp);
  if (!Number.isFinite(t)) return [];
  const start = t - beforeMinutes * 60000;
  const end = t + afterMinutes * 60000;
  return (bars || []).filter(bar => {
    const bt = tsMs(bar.timestamp);
    return Number.isFinite(bt) && bt >= start && bt <= end;
  });
}

function buildV3Index(v3Rows) {
  const map = new Map();
  for (const row of v3Rows || []) {
    const key = signalKey(row);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function signalKey(row) {
  return [
    row.setup_id,
    row.entry_timestamp_et,
    row.entry_model,
    rounded(row.stop_points),
  ].map(value => value == null ? 'unknown' : String(value)).join('|');
}

function tradeEvent(signal) {
  return (signal.state_events || []).find(event => event.state === 'TRADEABLE') || {};
}

function resultLabel(signal) {
  if (signal.final_state === 'INVALIDATED') return 'invalidated';
  if (signal.tp2_hit) return signal.tp3_hit ? 'tp_plus_3' : 'tp_plus_2';
  if (signal.stop_first) return 'stop_first';
  return 'scratch_or_timeout';
}

function timeToStop(signal, bars) {
  const entry = tradeEvent(signal).entry_price;
  const stop = signal.stop_price ?? tradeEvent(signal).stop_price;
  if (!Number.isFinite(entry) || !Number.isFinite(stop)) return null;
  for (const bar of chartWindow(bars, signal.entry_timestamp_et, 0, 60)) {
    if (bar.low <= stop) {
      const minutes = Math.round((tsMs(bar.timestamp) - tsMs(signal.entry_timestamp_et)) / 60000);
      return minutes >= 0 ? minutes : null;
    }
  }
  return null;
}

function mfeMaeFromBars(signal, bars) {
  const entry = tradeEvent(signal).entry_price;
  if (!Number.isFinite(entry)) return { mfe: null, mae: null };
  const future = chartWindow(bars, signal.entry_timestamp_et, 0, 30);
  if (!future.length) return { mfe: null, mae: null };
  return {
    mfe: rounded(Math.max(0, ...future.map(bar => bar.high - entry))),
    mae: rounded(Math.max(0, ...future.map(bar => entry - bar.low))),
  };
}

function enrichSignal({ signal, v3Index, barsByDate, spxBarsByDate }) {
  const v3 = v3Index.get(signalKey(signal)) || {};
  const esBars = barsByDate.get(signal.date) || [];
  const spxBars = spxBarsByDate.get(signal.date) || [];
  const trade = tradeEvent(signal);
  const chartBars = chartWindow(esBars, signal.entry_timestamp_et);
  const spxWindow = chartWindow(spxBars, signal.entry_timestamp_et).map(bar => ({
    timestamp: bar.timestamp,
    close: rounded(bar.close),
  }));
  const mm = mfeMaeFromBars(signal, esBars);
  const nextTarget = v3.next_trusted_target_distance && Number.isFinite(trade.entry_price)
    ? rounded(trade.entry_price + v3.next_trusted_target_distance)
    : (signal.state_events || []).find(event => event.state === 'LEVEL_WATCH')?.next_target_above ?? null;
  return {
    id: [signal.rule_id, signal.setup_id, signal.entry_timestamp_et, signal.entry_model].join('|'),
    setup_id: signal.setup_id,
    rule_id: signal.rule_id,
    rule_name: signal.rule_label || `Rule ${signal.rule_id}`,
    date: signal.date,
    timestamp_et: signal.entry_timestamp_et,
    state_events: signal.state_events,
    final_state: signal.final_state,
    level: v3.executable_level ?? v3.level ?? null,
    level_source_combo: signal.source_combo,
    entry_model: signal.entry_model,
    entry_price: trade.entry_price ?? v3.entry_price ?? null,
    stop: signal.stop_price ?? trade.stop_price ?? null,
    stop_points: signal.stop_points,
    tp1_plus_2: trade.tp1 ?? v3.tp1 ?? null,
    tp_plus_3: trade.tp3 ?? v3.tp3 ?? null,
    next_trusted_target_above: nextTarget,
    bobby_heatmap_target_present: v3.bobby_heatmap_target_present === true,
    bobby_target_distance: v3.bobby_target_distance ?? null,
    basis_method: v3.basis_method || 'native_es',
    result: resultLabel(signal),
    tp2_hit: signal.tp2_hit,
    tp3_hit: signal.tp3_hit,
    stop_first: signal.stop_first,
    mfe_30m: mm.mfe,
    mae_30m: mm.mae,
    heat_before_tp1: signal.heat_before_tp1,
    time_to_tp: signal.time_to_tp1,
    time_to_stop: timeToStop(signal, esBars),
    account_impact_2es: signalPnl(signal, '2ES_FULL'),
    account_impact_1es: signalPnl(signal, '1ES_STARTER'),
    watchlist_reason: watchlistReason(signal),
    chart: {
      window: { before_minutes: 15, after_minutes: 30 },
      es_bars: chartBars.map(bar => ({
        timestamp: bar.timestamp,
        open: rounded(bar.open),
        high: rounded(bar.high),
        low: rounded(bar.low),
        close: rounded(bar.close),
        volume: Number.isFinite(bar.volume) ? bar.volume : null,
      })),
      spx_close: spxWindow,
      overlays: {
        level: v3.executable_level ?? v3.level ?? null,
        entry: trade.entry_price ?? v3.entry_price ?? null,
        stop: signal.stop_price ?? trade.stop_price ?? null,
        tp1: trade.tp1 ?? v3.tp1 ?? null,
        tp3: trade.tp3 ?? v3.tp3 ?? null,
        next_trusted_target_above: nextTarget,
      },
      markers: signal.state_events || [],
    },
  };
}

function watchlistReason(signal) {
  if (signal.rule_id === 'A') return 'low sample but clean power-hour three-candle target-space profile';
  if (signal.rule_id === 'B') return 'medium sample and strong TP/stop stats, but account chronology fails 25k before target';
  if (signal.rule_id === 'C') return 'Bobby/heatmap target confirmation needs visual inspection before paper status';
  return 'not part of watchlist rule set';
}

function buildWatchlistReplay() {
  const inputs = loadWatchlistInputs();
  if (!inputs.stateResults?.rows) throw new Error('missing artifacts/research/fake-breakdown-state-results.json; run npm run research:fake-breakdown-state first');
  if (!inputs.v3Results?.rows) throw new Error('missing artifacts/research/fake-breakdown-v3-results.json; run npm run research:fake-breakdown-v3 first');
  const barsByDate = buildBarsByDate();
  const spxBarsByDate = buildSpxBarsByDate();
  const v3Index = buildV3Index(inputs.v3Results.rows);
  const watchlistRows = inputs.stateResults.rows
    .filter(row => ['A', 'B', 'C'].includes(row.rule_id))
    .map(signal => enrichSignal({ signal, v3Index, barsByDate, spxBarsByDate }))
    .sort((a, b) => String(a.timestamp_et).localeCompare(String(b.timestamp_et)));
  const clustering = {
    rule_a: clusterRuleSignals(watchlistRows, 'A'),
    rule_b: clusterRuleSignals(watchlistRows, 'B'),
    rule_c: clusterRuleSignals(watchlistRows, 'C'),
  };
  const throttles = analyzeRuleBThrottles(watchlistRows);
  const summary = summarizeReplay({ watchlistRows, clustering, throttles, stateRules: inputs.stateRules });
  return {
    summary,
    signals: watchlistRows,
    clustering,
    throttles,
    state_rules: inputs.stateRules,
    generated_at: new Date().toISOString(),
  };
}

function summarizeReplay({ watchlistRows, clustering, throttles }) {
  const byRule = {};
  for (const ruleId of ['A', 'B', 'C']) {
    const rows = watchlistRows.filter(row => row.rule_id === ruleId);
    byRule[ruleId] = {
      signals: rows.length,
      tradeable: rows.filter(row => row.final_state === 'TRADEABLE').length,
      tp2_hit_rate: rate(rows, row => row.tp2_hit === true),
      stop_first_rate: rate(rows, row => row.stop_first === true),
      positive_pnl_2es: rounded(rows.reduce((sum, row) => sum + row.account_impact_2es, 0)),
    };
  }
  return {
    rules_included: ['A', 'B', 'C'],
    signal_count: watchlistRows.length,
    by_rule: byRule,
    rule_a_cluster_days: clustering.rule_a.by_day.length,
    rule_a_positive_days: clustering.rule_a.by_day.filter(day => day.pnl_2es > 0).length,
    rule_b_best_throttle: throttles.best_variant,
  };
}

function rate(rows, predicate) {
  const tradeable = rows.filter(row => row.final_state === 'TRADEABLE');
  return tradeable.length ? tradeable.filter(predicate).length / tradeable.length : null;
}

function writeWatchlistArtifacts(result) {
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-watchlist-replay.json'), result);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-rule-clustering.json'), result.clustering);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-rule-throttles.json'), result.throttles);
  writeCsv(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-watchlist-summary.csv'), summaryRows(result), [
    'rule_id', 'signals', 'tradeable', 'tp2_hit_rate', 'stop_first_rate', 'pnl_2es',
  ]);
  fs.writeFileSync(path.join(RESEARCH_ARTIFACT_DIR, 'fake-breakdown-watchlist.html'), renderWatchlistHtml(result), 'utf8');
}

function summaryRows(result) {
  return Object.entries(result.summary.by_rule).map(([rule_id, row]) => ({
    rule_id,
    signals: row.signals,
    tradeable: row.tradeable,
    tp2_hit_rate: row.tp2_hit_rate,
    stop_first_rate: row.stop_first_rate,
    pnl_2es: row.positive_pnl_2es,
  }));
}

function renderWatchlistHtml(result) {
  const safeJson = JSON.stringify(result).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fake Breakdown Watchlist Replay</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #141414; background: #f7f8fa; }
    h1, h2 { margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start; }
    .panel { background: white; border: 1px solid #d9dde3; border-radius: 8px; padding: 12px; }
    .signals { max-height: 720px; overflow: auto; }
    .signal { border-bottom: 1px solid #edf0f4; padding: 8px 4px; cursor: pointer; }
    .signal:hover { background: #f0f4f8; }
    .signal.active { background: #e6f0ff; }
    .meta { color: #596273; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border-bottom: 1px solid #edf0f4; padding: 6px; text-align: left; }
    svg { width: 100%; height: 340px; background: #fff; border: 1px solid #d9dde3; border-radius: 6px; }
    .pill { display: inline-block; padding: 2px 6px; border-radius: 999px; background: #eef2f7; margin-right: 4px; font-size: 12px; }
    .win { color: #057a47; } .loss { color: #b42318; }
  </style>
</head>
<body>
  <h1>Fake Breakdown Watchlist Replay</h1>
  <p class="meta">Read-only research artifact. No live execution. Generated ${new Date().toISOString()}.</p>
  <div class="grid">
    <div class="panel signals" id="signals"></div>
    <div class="panel">
      <div id="details"></div>
      <svg id="chart" viewBox="0 0 900 340" preserveAspectRatio="none"></svg>
      <h2>Rule Summary</h2>
      <div id="summary"></div>
    </div>
  </div>
  <script>
    const DATA = ${safeJson};
    const signalsEl = document.getElementById('signals');
    const detailsEl = document.getElementById('details');
    const summaryEl = document.getElementById('summary');
    const chartEl = document.getElementById('chart');
    let active = 0;
    function pct(v){ return Number.isFinite(v) ? (v*100).toFixed(1)+'%' : 'n/a'; }
    function fmt(v){ return Number.isFinite(v) ? v.toFixed(2) : 'n/a'; }
    function renderList(){
      signalsEl.innerHTML = '<h2>Signals</h2>' + DATA.signals.map((s,i) =>
        '<div class="signal '+(i===active?'active':'')+'" onclick="active='+i+';render()">' +
        '<strong>'+s.rule_id+'</strong> '+s.date+' '+s.timestamp_et.slice(11,16)+' <span class="'+(s.tp2_hit?'win':(s.stop_first?'loss':''))+'">'+s.result+'</span>' +
        '<div class="meta">'+s.entry_model+' | '+s.level_source_combo+' | heat '+fmt(s.heat_before_tp1)+' | pnl2ES '+fmt(s.account_impact_2es)+'</div></div>'
      ).join('');
    }
    function renderDetails(s){
      detailsEl.innerHTML = '<h2>'+s.rule_name+'</h2>' +
        '<p><span class="pill">'+s.final_state+'</span><span class="pill">'+s.result+'</span><span class="pill">'+s.basis_method+'</span></p>' +
        '<table><tbody>' +
        row('Time', s.timestamp_et) + row('Level', fmt(s.level)) + row('Source combo', s.level_source_combo) +
        row('Entry model', s.entry_model) + row('Entry', fmt(s.entry_price)) + row('Stop', fmt(s.stop)) +
        row('TP +2', fmt(s.tp1_plus_2)) + row('TP +3', fmt(s.tp_plus_3)) + row('Next target', fmt(s.next_trusted_target_above)) +
        row('Bobby target', s.bobby_heatmap_target_present ? 'yes' : 'no') + row('MFE/MAE 30m', fmt(s.mfe_30m)+' / '+fmt(s.mae_30m)) +
        row('Time to TP/stop', (s.time_to_tp ?? 'n/a')+' / '+(s.time_to_stop ?? 'n/a')) + row('Account impact 2ES/1ES', fmt(s.account_impact_2es)+' / '+fmt(s.account_impact_1es)) +
        row('Watchlist reason', s.watchlist_reason) + '</tbody></table>' +
        '<h2>States</h2><table><tbody>' + s.state_events.map(e => row(e.state, e.timestamp_et || 'n/a')).join('') + '</tbody></table>';
    }
    function row(a,b){ return '<tr><th>'+a+'</th><td>'+b+'</td></tr>'; }
    function renderChart(s){
      const bars = s.chart.es_bars || [];
      chartEl.innerHTML = '';
      if(!bars.length) return;
      const prices = bars.flatMap(b => [b.high,b.low]).filter(Number.isFinite);
      for (const v of Object.values(s.chart.overlays)) if (Number.isFinite(v)) prices.push(v);
      const min = Math.min(...prices), max = Math.max(...prices), pad = Math.max(1, (max-min)*0.08);
      const y = p => 320 - ((p-(min-pad))/((max+pad)-(min-pad))) * 300;
      const x = i => 20 + (i/(Math.max(1,bars.length-1))) * 860;
      const points = bars.map((b,i) => x(i)+','+y(b.close)).join(' ');
      add('polyline', { points, fill:'none', stroke:'#1f5eff', 'stroke-width':2 });
      let overlayIndex = 0;
      for(const [name, price] of Object.entries(s.chart.overlays)){
        if(!Number.isFinite(price)) continue;
        const color = name==='stop' ? '#b42318' : (name==='entry' ? '#111827' : '#057a47');
        add('line', { x1:20, x2:880, y1:y(price), y2:y(price), stroke:color, 'stroke-width':1, 'stroke-dasharray':'4 4' });
        addText(690, 22 + (overlayIndex % 8)*14, name+' '+fmt(price), color);
        overlayIndex += 1;
      }
      let markerIndex = 0;
      const shortState = state => String(state || '').replace('BREAKDOWN_DETECTED','BREAKDOWN').replace('RECLAIM_WATCH','RECLAIM').replace('LEVEL_WATCH','LEVEL').replace('ZONE_WATCH','ZONE');
      for(const marker of s.chart.markers || []){
        const idx = bars.findIndex(b => b.timestamp >= marker.timestamp_et);
        if(idx >= 0){
          add('line', { x1:x(idx), x2:x(idx), y1:10, y2:330, stroke:'#6b7280', 'stroke-width':1 });
          addText(x(idx)+3, 18 + (markerIndex % 6) * 13, shortState(marker.state), '#374151');
          markerIndex += 1;
        }
      }
    }
    function add(tag, attrs){ const el=document.createElementNS('http://www.w3.org/2000/svg',tag); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); chartEl.appendChild(el); }
    function addText(x,y,text,color){ const el=document.createElementNS('http://www.w3.org/2000/svg','text'); el.setAttribute('x',x); el.setAttribute('y',y); el.setAttribute('fill',color); el.setAttribute('font-size','11'); el.textContent=text; chartEl.appendChild(el); }
    function renderSummary(){
      summaryEl.innerHTML = '<table><thead><tr><th>Rule</th><th>Signals</th><th>TP +2</th><th>Stop first</th><th>PnL 2ES</th></tr></thead><tbody>' +
        Object.entries(DATA.summary.by_rule).map(([rule,row]) => '<tr><td>'+rule+'</td><td>'+row.signals+'</td><td>'+pct(row.tp2_hit_rate)+'</td><td>'+pct(row.stop_first_rate)+'</td><td>'+fmt(row.positive_pnl_2es)+'</td></tr>').join('') +
        '</tbody></table>';
    }
    function render(){ renderList(); const s=DATA.signals[active] || DATA.signals[0]; if(s){ renderDetails(s); renderChart(s); } renderSummary(); }
    render();
  </script>
</body>
</html>
`;
}

module.exports = {
  loadWatchlistInputs,
  buildBarsByDate,
  buildSpxBarsByDate,
  chartWindow,
  buildV3Index,
  signalKey,
  tradeEvent,
  resultLabel,
  timeToStop,
  mfeMaeFromBars,
  enrichSignal,
  watchlistReason,
  buildWatchlistReplay,
  summarizeReplay,
  writeWatchlistArtifacts,
  renderWatchlistHtml,
};
