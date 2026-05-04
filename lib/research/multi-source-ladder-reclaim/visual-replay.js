'use strict';

const fs = require('fs');
const path = require('path');
const { RESEARCH_ARTIFACT_DIR, ROOT, readJson, tsMs, writeJson } = require('../common');
const { loadUsableSessions } = require('../corpus-loader');
const { runMultiSourceLadderReclaimResearch } = require('./evaluator');
const { ACCOUNT_25K, ACCOUNT_50K, accountRows } = require('./metrics');
const { rounded } = require('./level-clusters');
const { analyzeFalsePositives, categorizeFalsePositive, isFalsePositive, repeatedLevelKeys } = require('./false-positive-analysis');
const { analyzeStagedAdds } = require('./staged-add-analysis');

function buildBarsByDate(sessions = loadUsableSessions().sessions) {
  const map = new Map();
  for (const session of sessions || []) map.set(session.date, session.replayBars || []);
  return map;
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

function keyForRow(row) {
  return [
    row.setup_id,
    row.entry_timestamp_et,
    row.entry_model,
    row.stop_model,
    row.target_model,
  ].map(value => value == null ? 'unknown' : String(value)).join('|');
}

function unionRows(groups, limit = 240) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const row of group || []) {
      const key = keyForRow(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function canonicalReviewRows(rows) {
  return accountRows(rows).filter(row => row.classification === 'TRADEABLE_RESEARCH');
}

function takenRowsFromSim(rows, sim) {
  const lookup = new Map(rows.map(row => [`${row.setup_id}|${row.entry_timestamp_et}`, row]));
  const taken = [];
  for (const day of sim?.day_results || []) {
    for (const item of day.taken || []) {
      const row = lookup.get(`${item.setup_id}|${item.entry_timestamp_et}`);
      if (row) taken.push(row);
    }
  }
  return taken;
}

function selectReviewRows(rows, summary) {
  const canonical = canonicalReviewRows(rows);
  const repeated = repeatedLevelKeys(canonical);
  const bobbyMancini = canonical.filter(row => row.source_combo === 'bobby+mancini');
  const account25 = takenRowsFromSim(canonical, summary.account_sim?.['25k_1ES_STARTER']);
  const falsePositive = canonical
    .filter(isFalsePositive)
    .sort((a, b) => Number(Boolean(b.stop_first)) - Number(Boolean(a.stop_first)) || (b.max_heat_before_tp1 || 0) - (a.max_heat_before_tp1 || 0));
  const cleanWinners = canonical
    .filter(row => row.tp1_hit && !row.stop_first && !row.same_bar_ambiguity)
    .sort((a, b) => (a.max_heat_before_tp1 || 999) - (b.max_heat_before_tp1 || 999));
  const lateTooLate = canonical
    .filter(row => row.late_reclaim_too_late || row.points_captured_before_late_reclaim >= 4)
    .sort((a, b) => (b.points_captured_before_late_reclaim || 0) - (a.points_captured_before_late_reclaim || 0));
  const missingBobbyLosers = falsePositive.filter(row => categorizeFalsePositive(row, repeated).includes('missing_bobby_heatmap_confirmation'));
  const selected = unionRows([
    bobbyMancini,
    account25,
    falsePositive.slice(0, 60),
    missingBobbyLosers.slice(0, 25),
    cleanWinners.slice(0, 60),
    lateTooLate.slice(0, 60),
  ]);
  return { canonical, selected, bobbyMancini, account25, falsePositive, cleanWinners, lateTooLate };
}

function resultLabel(row) {
  if (row.same_bar_ambiguity) return 'same_bar_ambiguity';
  if (row.stop_first) return 'stop_first';
  if (row.tp1_hit) return row.tp2_hit ? 'tp_plus_2_and_next_cluster' : 'tp_plus_2';
  if (row.tp1_hit === false) return 'tp_missed';
  return 'unmeasured';
}

function accountImpact(row) {
  return {
    one_es: row.pnl_1es_slip_0_5_round_trip,
    two_es: row.pnl_2es_slip_0_5_round_trip,
  };
}

function buildSignal(row, barsByDate, repeatedKeys) {
  const bars = barsByDate.get(row.date) || [];
  const window = chartWindow(bars, row.entry_timestamp_et);
  const categories = categorizeFalsePositive(row, repeatedKeys);
  const tp3 = Number.isFinite(row.entry_price) ? rounded(row.entry_price + 3) : null;
  return {
    id: keyForRow(row),
    setup_id: row.setup_id,
    date: row.date,
    timestamp_et: row.entry_timestamp_et,
    flush_start_timestamp_et: row.flush_start_timestamp_et,
    source_combo: row.source_combo,
    flush_source_combo: row.flush_source_combo,
    flush_type: row.flush_type,
    clusters_lost_count: row.clusters_lost_count,
    clusters_lost: row.clusters_lost || [],
    first_reclaimed_level: row.first_reclaimed_level,
    first_reclaimed_source_type: row.first_reclaimed_source_type,
    entry_model: row.entry_model,
    entry_price: row.entry_price,
    stop_model: row.stop_model,
    stop_price: row.stop_price,
    stop_points: row.stop_points,
    tp1_plus_2: row.tp1,
    tp_plus_3: tp3,
    next_cluster_target: row.next_cluster_target,
    second_cluster_target: row.second_cluster_target,
    late_reclaim_level: row.late_reclaim_level,
    late_reclaim_timestamp_et: row.late_reclaim_timestamp_et,
    points_captured_before_late_reclaim: row.points_captured_before_late_reclaim,
    basis_method: row.basis_method || 'native_es',
    target_basis_method: row.target_basis_method || null,
    result: resultLabel(row),
    why: isFalsePositive(row) ? categories : winnerReasons(row),
    tp1_hit: row.tp1_hit,
    stop_first: row.stop_first,
    same_bar_ambiguity: row.same_bar_ambiguity,
    max_heat_before_tp1: row.max_heat_before_tp1,
    time_to_tp1: row.time_to_tp1,
    time_to_stop: row.time_to_stop,
    mfe_30m: row.mfe_30m,
    mae_30m: row.mae_30m,
    account_impact: accountImpact(row),
    chart: {
      window: { before_minutes: 15, after_minutes: 30 },
      es_bars: window.map(bar => ({
        timestamp: bar.timestamp,
        open: rounded(bar.open),
        high: rounded(bar.high),
        low: rounded(bar.low),
        close: rounded(bar.close),
        volume: Number.isFinite(bar.volume) ? bar.volume : null,
      })),
      overlays: {
        clusters_lost: row.clusters_lost || [],
        first_reclaimed_level: row.first_reclaimed_level,
        entry: row.entry_price,
        stop: row.stop_price,
        tp_plus_2: row.tp1,
        tp_plus_3: tp3,
        next_cluster_target: row.next_cluster_target,
        second_cluster_target: row.second_cluster_target,
        late_reclaim_level: row.late_reclaim_level,
      },
      markers: [
        { label: 'flush_start', timestamp_et: row.flush_start_timestamp_et },
        { label: 'first_reclaim_entry', timestamp_et: row.entry_timestamp_et },
        { label: 'late_reclaim', timestamp_et: row.late_reclaim_timestamp_et },
      ].filter(marker => marker.timestamp_et),
    },
  };
}

function winnerReasons(row) {
  const reasons = [];
  if (row.max_heat_before_tp1 <= 1) reasons.push('clean_low_heat');
  if (row.time_to_tp1 <= 5) reasons.push('fast_tp1');
  if (row.points_captured_before_late_reclaim > 0) reasons.push('captured_before_late_reclaim');
  if (row.source_combo === 'bobby+mancini') reasons.push('bobby_mancini_confluence');
  if (!reasons.length) reasons.push('tp1_hit');
  return reasons;
}

function summarizeSelection(selection, falsePositiveAnalysis, stagedAdd) {
  const selected = selection.selected;
  const rate = (rows, pred) => rows.length ? rows.filter(pred).length / rows.length : null;
  return {
    generated_at: new Date().toISOString(),
    examples: selected.length,
    canonical_setups: selection.canonical.length,
    bobby_mancini_examples: selection.bobbyMancini.length,
    account_25k_1es_taken_examples: selection.account25.length,
    false_positive_examples_available: selection.falsePositive.length,
    clean_winner_examples_available: selection.cleanWinners.length,
    late_vs_first_examples_available: selection.lateTooLate.length,
    selected_tp_plus_2_rate: rate(selected, row => row.tp1_hit),
    selected_stop_first_rate: rate(selected, row => row.stop_first || row.same_bar_ambiguity),
    false_positive_categories: falsePositiveAnalysis.category_counts,
    staged_add_best_variant: stagedAdd.best_variant,
    staged_add_best_variant_25k: stagedAdd.account_25k?.best_variant || stagedAdd.best_variant,
    staged_add_best_variant_50k: stagedAdd.account_50k?.best_variant || null,
    readiness: 'WATCHLIST_ONLY',
  };
}

async function buildLadderReclaimVisualReview(options = {}) {
  const research = options.research || await runMultiSourceLadderReclaimResearch({ writeArtifacts: false });
  const sessions = options.sessions || loadUsableSessions().sessions;
  const barsByDate = options.barsByDate || buildBarsByDate(sessions);
  const selection = selectReviewRows(research.rows, research.summary);
  const repeated = repeatedLevelKeys(selection.canonical);
  const falsePositiveAnalysis = analyzeFalsePositives(selection.canonical);
  const stagedAdd25k = analyzeStagedAdds(research.rows, barsByDate, ACCOUNT_25K);
  const stagedAdd50k = analyzeStagedAdds(research.rows, barsByDate, ACCOUNT_50K);
  const stagedAdd = {
    ...stagedAdd25k,
    account_25k: stagedAdd25k,
    account_50k: stagedAdd50k,
    best_variant_25k: stagedAdd25k.best_variant,
    best_variant_50k: stagedAdd50k.best_variant,
  };
  const signals = selection.selected.map(row => buildSignal(row, barsByDate, repeated));
  const result = {
    summary: summarizeSelection(selection, falsePositiveAnalysis, stagedAdd),
    research_summary: research.summary,
    signals,
    false_positive_analysis: falsePositiveAnalysis,
    staged_add_analysis: stagedAdd,
    bobby_mancini_review: summarizeGroup(selection.bobbyMancini),
    account_25k_1es_review: summarizeGroup(selection.account25),
    late_vs_first_examples: selection.lateTooLate.slice(0, 80).map(row => compactLateExample(row)),
  };
  return result;
}

function summarizeGroup(rows) {
  const tradeable = rows || [];
  const rate = pred => tradeable.length ? tradeable.filter(pred).length / tradeable.length : null;
  return {
    rows: tradeable.length,
    unique_setups: new Set(tradeable.map(row => row.setup_id)).size,
    tp_plus_2_rate: rate(row => row.tp1_hit),
    stop_first_rate: rate(row => row.stop_first || row.same_bar_ambiguity),
    avg_heat_before_tp1: average(tradeable.map(row => row.max_heat_before_tp1)),
    median_heat_before_tp1: median(tradeable.map(row => row.max_heat_before_tp1)),
    avg_stop_points: average(tradeable.map(row => row.stop_points)),
    stop_points_range: range(tradeable.map(row => row.stop_points)),
    avg_account_impact_1es: average(tradeable.map(row => row.pnl_1es_slip_0_5_round_trip)),
  };
}

function compactLateExample(row) {
  return {
    setup_id: row.setup_id,
    date: row.date,
    entry_timestamp_et: row.entry_timestamp_et,
    source_combo: row.source_combo,
    first_reclaimed_level: row.first_reclaimed_level,
    entry_price: row.entry_price,
    late_reclaim_level: row.late_reclaim_level,
    late_reclaim_timestamp_et: row.late_reclaim_timestamp_et,
    late_reclaim_price: row.late_reclaim_price,
    points_captured_before_late_reclaim: row.points_captured_before_late_reclaim,
    late_reclaim_reason: row.late_reclaim_reason,
  };
}

async function writeVisualReviewArtifacts(result, options = {}) {
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-winners.json'), result.signals.filter(signal => signal.tp1_hit && !signal.stop_first));
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-false-positives.json'), {
    summary: result.false_positive_analysis,
    examples: result.signals.filter(signal => signal.stop_first || !signal.tp1_hit),
  });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-bobby-mancini-review.json'), {
    summary: result.bobby_mancini_review,
    examples: result.signals.filter(signal => signal.source_combo === 'bobby+mancini'),
  });
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-25k-1es-review.json'), result.account_25k_1es_review);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-staged-add-analysis.json'), result.staged_add_analysis);
  writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-late-vs-first-examples.json'), result.late_vs_first_examples);
  fs.writeFileSync(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-visual-review.html'), renderVisualReviewHtml(result), 'utf8');
  let caseReports = null;
  if (options.caseImages !== false) {
    caseReports = await writeCaseReportImages(result, options.caseImageOptions || {});
    writeJson(path.join(RESEARCH_ARTIFACT_DIR, 'ladder-reclaim-case-image-manifest.json'), caseReports);
  }
  fs.writeFileSync(path.join(ROOT, 'docs', 'LADDER_RECLAIM_VISUAL_REVIEW.md'), renderReviewDoc(result, caseReports), 'utf8');
  return caseReports;
}

function renderVisualReviewHtml(result, options = {}) {
  const title = options.title || 'Ladder First-Reclaim Visual Review';
  const safeJson = JSON.stringify({ summary: result.summary, signals: result.signals }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 20px; font-family: Arial, sans-serif; background: #f5f7fa; color: #111827; }
    h1, h2 { margin: 0 0 10px; }
    .grid { display: grid; grid-template-columns: 380px 1fr; gap: 14px; align-items: start; }
    .panel { background: white; border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; }
    .list { max-height: 780px; overflow: auto; }
    .item { padding: 8px 4px; border-bottom: 1px solid #edf0f4; cursor: pointer; }
    .item:hover, .item.active { background: #ebf3ff; }
    .meta { font-size: 12px; color: #667085; }
    .pill { display:inline-block; padding:2px 6px; margin:2px; border-radius:999px; background:#eef2f7; font-size:12px; }
    .win { color:#057a47; } .loss { color:#b42318; }
    table { border-collapse: collapse; width:100%; font-size:13px; }
    th, td { text-align:left; border-bottom:1px solid #edf0f4; padding:6px; vertical-align:top; }
    svg { width:100%; height:380px; background:white; border:1px solid #d8dee8; border-radius:8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Read-only research artifact. WATCHLIST_ONLY. No execution, no paper/live promotion.</p>
  <div class="grid">
    <div class="panel list" id="list"></div>
    <div class="panel">
      <div id="details"></div>
      <svg id="chart" viewBox="0 0 900 380" preserveAspectRatio="none"></svg>
      <h2>Summary</h2>
      <div id="summary"></div>
    </div>
  </div>
  <script>
    const DATA = ${safeJson};
    let active = 0;
    const listEl = document.getElementById('list');
    const detailsEl = document.getElementById('details');
    const chartEl = document.getElementById('chart');
    const summaryEl = document.getElementById('summary');
    function fmt(v){ return Number.isFinite(v) ? v.toFixed(2) : (v ?? 'n/a'); }
    function pct(v){ return Number.isFinite(v) ? (v*100).toFixed(1)+'%' : 'n/a'; }
    function row(a,b){ return '<tr><th>'+a+'</th><td>'+b+'</td></tr>'; }
    function renderList(){
      listEl.innerHTML = '<h2>Examples ('+DATA.signals.length+')</h2>' + DATA.signals.map((s,i) =>
        '<div class="item '+(i===active?'active':'')+'" onclick="active='+i+';render()">' +
        '<strong>'+s.date+' '+s.timestamp_et.slice(11,16)+'</strong> <span class="'+(s.tp1_hit?'win':(s.stop_first?'loss':''))+'">'+s.result+'</span>' +
        '<div class="meta">'+s.source_combo+' | '+s.flush_type+' | first '+fmt(s.first_reclaimed_level)+' | heat '+fmt(s.max_heat_before_tp1)+'</div></div>'
      ).join('');
    }
    function renderDetails(s){
      detailsEl.innerHTML = '<h2>'+s.source_combo+' First Reclaim</h2>' +
        '<p>'+s.why.map(x => '<span class="pill">'+x+'</span>').join('')+'</p>' +
        '<table><tbody>' +
        row('Time', s.timestamp_et) + row('Flush start', s.flush_start_timestamp_et) +
        row('Lost clusters', (s.clusters_lost || []).join(', ') || s.clusters_lost_count) +
        row('First reclaimed', fmt(s.first_reclaimed_level)) + row('Entry model', s.entry_model) +
        row('Entry', fmt(s.entry_price)) + row('Stop / points', fmt(s.stop_price)+' / '+fmt(s.stop_points)) +
        row('TP +2 / +3', fmt(s.tp1_plus_2)+' / '+fmt(s.tp_plus_3)) +
        row('Next / second cluster', fmt(s.next_cluster_target)+' / '+fmt(s.second_cluster_target)) +
        row('Late reclaim', fmt(s.late_reclaim_level)+' at '+(s.late_reclaim_timestamp_et || 'n/a')) +
        row('Captured before late reclaim', fmt(s.points_captured_before_late_reclaim)) +
        row('MFE/MAE 30m', fmt(s.mfe_30m)+' / '+fmt(s.mae_30m)) +
        row('Time to TP/stop', fmt(s.time_to_tp1)+' / '+fmt(s.time_to_stop)) +
        row('Account impact 1ES/2ES', fmt(s.account_impact.one_es)+' / '+fmt(s.account_impact.two_es)) +
        row('Basis', s.basis_method) + '</tbody></table>';
    }
    function renderChart(s){
      const bars = s.chart.es_bars || [];
      chartEl.innerHTML = '';
      if(!bars.length) return;
      const prices = bars.flatMap(b => [b.high,b.low]).filter(Number.isFinite);
      for(const v of Object.values(s.chart.overlays)) {
        if(Array.isArray(v)) prices.push(...v.filter(Number.isFinite));
        else if(Number.isFinite(v)) prices.push(v);
      }
      const min = Math.min(...prices), max = Math.max(...prices), pad = Math.max(1, (max-min)*0.08);
      const y = p => 350 - ((p-(min-pad))/((max+pad)-(min-pad))) * 320;
      const x = i => 20 + (i/(Math.max(1,bars.length-1))) * 860;
      add('polyline',{points:bars.map((b,i)=>x(i)+','+y(b.close)).join(' '), fill:'none', stroke:'#2563eb', 'stroke-width':2});
      line.i = 0;
      for(const lost of s.chart.overlays.clusters_lost || []) line(lost, '#9ca3af', 'lost '+fmt(lost));
      line(s.first_reclaimed_level, '#111827', 'first '+fmt(s.first_reclaimed_level));
      line(s.entry_price, '#7c3aed', 'entry '+fmt(s.entry_price));
      line(s.stop_price, '#b42318', 'stop '+fmt(s.stop_price));
      line(s.tp1_plus_2, '#057a47', 'tp2 '+fmt(s.tp1_plus_2));
      line(s.tp_plus_3, '#0e7490', 'tp3 '+fmt(s.tp_plus_3));
      line(s.next_cluster_target, '#f59e0b', 'next '+fmt(s.next_cluster_target));
      const labels = [];
      for(const m of s.chart.markers || []){
        const idx = bars.findIndex(b => b.timestamp >= m.timestamp_et);
        if(idx >= 0){ add('line',{x1:x(idx),x2:x(idx),y1:8,y2:370,stroke:'#6b7280','stroke-width':1,'stroke-dasharray':'3 3'}); labels.push([x(idx)+3, m.label]); }
      }
      labels.forEach((l,i)=>text(l[0],18+(i%8)*14,l[1],'#374151'));
      function line(price,color,label){ if(!Number.isFinite(price)) return; add('line',{x1:20,x2:880,y1:y(price),y2:y(price),stroke:color,'stroke-width':1,'stroke-dasharray':'5 5'}); text(710,18+(line.i++%12)*14,label,color); }
    }
    function add(tag, attrs){ const el=document.createElementNS('http://www.w3.org/2000/svg',tag); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); chartEl.appendChild(el); }
    function text(x,y,t,c){ const el=document.createElementNS('http://www.w3.org/2000/svg','text'); el.setAttribute('x',x); el.setAttribute('y',y); el.setAttribute('fill',c); el.setAttribute('font-size','11'); el.textContent=t; chartEl.appendChild(el); }
    function renderSummary(){
      const s = DATA.summary;
      summaryEl.innerHTML = '<table><tbody>' +
        row('Examples', s.examples) + row('Canonical setups', s.canonical_setups) +
        row('Bobby+Mancini examples', s.bobby_mancini_examples) + row('25k 1ES taken examples', s.account_25k_1es_taken_examples) +
        row('Selected TP +2 / stop-first', pct(s.selected_tp_plus_2_rate)+' / '+pct(s.selected_stop_first_rate)) +
        row('Best staged variant', s.staged_add_best_variant?.variant || 'n/a') +
        row('Readiness', s.readiness) + '</tbody></table>';
    }
    function render(){ renderList(); const s = DATA.signals[active]; if(s){ renderDetails(s); renderChart(s); } renderSummary(); }
    render();
  </script>
</body>
</html>
`;
}

function selectCaseSignals(result, limitPerSide = 12) {
  const positives = result.signals
    .filter(signal => signal.tp1_hit && !signal.stop_first && !signal.same_bar_ambiguity)
    .sort((a, b) => scorePositive(b) - scorePositive(a))
    .slice(0, limitPerSide);
  const negatives = result.signals
    .filter(signal => signal.stop_first || signal.same_bar_ambiguity || !signal.tp1_hit)
    .sort((a, b) => scoreNegative(b) - scoreNegative(a))
    .slice(0, limitPerSide);
  return { positives, negatives };
}

function scorePositive(signal) {
  let score = 0;
  if (signal.source_combo === 'bobby+mancini') score += 50;
  if (signal.why?.includes('clean_low_heat')) score += 20;
  if (signal.why?.includes('captured_before_late_reclaim')) score += 20;
  score += Math.max(0, 10 - (signal.max_heat_before_tp1 || 10));
  return score;
}

function scoreNegative(signal) {
  let score = 0;
  if (signal.stop_first) score += 30;
  if (signal.same_bar_ambiguity) score += 15;
  if (signal.why?.includes('reclaim_failed')) score += 15;
  if (signal.why?.includes('missing_bobby_heatmap_confirmation')) score += 8;
  score += Math.min(20, signal.max_heat_before_tp1 || 0);
  return score;
}

async function writeCaseReportImages(result, options = {}) {
  const { chromium } = require('playwright');
  const date = options.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const outDir = options.outDir || path.join(ROOT, 'artifacts', 'review', `ladder-reclaim-visual-cases-${date}`);
  const limitPerSide = options.limitPerSide || 12;
  const selected = selectCaseSignals(result, limitPerSide);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const manifest = {
    generated_at: new Date().toISOString(),
    out_dir: outDir,
    positive: [],
    negative: [],
  };
  try {
    for (const [kind, signals] of [['positive', selected.positives], ['negative', selected.negatives]]) {
      const dir = path.join(outDir, kind);
      fs.mkdirSync(dir, { recursive: true });
      let index = 1;
      for (const signal of signals) {
        const caseResult = {
          summary: {
            ...result.summary,
            examples: signals.length,
            selected_tp_plus_2_rate: kind === 'positive' ? 1 : 0,
            selected_stop_first_rate: kind === 'negative' ? 1 : 0,
          },
          signals: [signal, ...signals.filter(item => item.id !== signal.id).slice(0, 18)],
        };
        const stem = `${String(index).padStart(3, '0')}-${kind}-${signal.date}-${String(signal.timestamp_et).slice(11, 16).replace(':', '')}-${signal.result}-${signal.entry_model}`;
        const safeStem = safeFileName(stem);
        const htmlPath = path.join(dir, `${safeStem}.html`);
        const pngPath = path.join(dir, `${safeStem}.png`);
        fs.writeFileSync(htmlPath, renderVisualReviewHtml(caseResult, { title: `Ladder Reclaim ${kind === 'positive' ? 'Positive' : 'Negative'} Case Review` }), 'utf8');
        const page = await browser.newPage({ viewport: { width: 1280, height: 1300 }, deviceScaleFactor: 1 });
        await page.goto(fileUrl(htmlPath), { waitUntil: 'load' });
        await page.screenshot({ path: pngPath, fullPage: true });
        await page.close();
        manifest[kind].push({
          id: signal.id,
          date: signal.date,
          timestamp_et: signal.timestamp_et,
          source_combo: signal.source_combo,
          result: signal.result,
          png: pngPath,
          html: htmlPath,
        });
        index += 1;
      }
    }
  } finally {
    await browser.close();
  }
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  manifest.manifest = manifestPath;
  return manifest;
}

function safeFileName(value) {
  return String(value || 'case').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 180);
}

function fileUrl(filePath) {
  return `file:///${path.resolve(filePath).replace(/\\/g, '/')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function renderReviewDoc(result, caseReports = null) {
  const s = result.summary;
  const fp = result.false_positive_analysis;
  const bm = result.bobby_mancini_review;
  const one = result.account_25k_1es_review;
  const best = result.staged_add_analysis.best_variant || {};
  const best50k = result.staged_add_analysis.best_variant_50k || {};
  const lines = [];
  lines.push('# Ladder Reclaim Visual Review');
  lines.push('');
  lines.push('## 1. Winner Pattern');
  lines.push('- The selected winners generally match the observed pattern: flush through a ladder, base/reclaim the lower trusted cluster, then move before upper reclaim.');
  lines.push(`- Visual examples generated: ${s.examples}.`);
  lines.push('');
  lines.push('## 2. False Positives');
  lines.push(`- False-positive rows available: ${s.false_positive_examples_available}.`);
  lines.push(`- Top categories: ${Object.entries(fp.category_counts).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ') || 'n/a'}.`);
  lines.push('- These categories are post-trade review labels only, not live filters.');
  lines.push('');
  lines.push('## 3. Bobby+Mancini');
  lines.push(`- Bobby+Mancini examples: ${bm.unique_setups}.`);
  lines.push(`- TP +2: ${pct(bm.tp_plus_2_rate)}, stop-first: ${pct(bm.stop_first_rate)}, avg/median heat: ${fmt(bm.avg_heat_before_tp1)} / ${fmt(bm.median_heat_before_tp1)}.`);
  lines.push('- Bobby+Mancini still looks strongest, but remains WATCHLIST_ONLY until visually reviewed on fresh sessions.');
  lines.push('');
  lines.push('## 4. 25K 1ES');
  lines.push(`- 25K 1ES taken examples: ${one.rows}.`);
  lines.push(`- Avg 1ES impact per selected taken row: ${fmt(one.avg_account_impact_1es)}.`);
  lines.push(`- Stop range: ${one.stop_points_range?.min ?? 'n/a'} to ${one.stop_points_range?.max ?? 'n/a'} ES points; avg stop ${fmt(one.avg_stop_points)}.`);
  lines.push('- 25K 1ES remains the safer starting mode than immediate 2ES.');
  lines.push('');
  lines.push('## 5. Staged Add');
  lines.push(`- Best staged variant: ${best.variant || 'n/a'}, PnL ${best.cumulative_pnl ?? 'n/a'}, max drawdown ${best.max_drawdown ?? 'n/a'}, failed ${best.failed ?? 'n/a'}.`);
  lines.push(`- 50K best staged variant: ${best50k.variant || 'n/a'}, PnL ${best50k.cumulative_pnl ?? 'n/a'}, max drawdown ${best50k.max_drawdown ?? 'n/a'}, failed ${best50k.failed ?? 'n/a'}.`);
  lines.push('- Staged add remains diagnostic. It should not become paper/live until fill assumptions and add timing are visually checked.');
  lines.push('');
  lines.push('## 6. Average Drawdown By Entry');
  for (const row of fp.by_entry_model_risk.slice(0, 8)) {
    lines.push(`- ${row.entry_model}: avg stop ${fmt(row.avg_stop_points)}, stop range ${fmt(row.min_stop_points)}-${fmt(row.max_stop_points)}, avg/median heat ${fmt(row.avg_heat_before_tp1)} / ${fmt(row.median_heat_before_tp1)}.`);
  }
  lines.push('');
  lines.push('## 7. Readiness');
  lines.push('- Status: WATCHLIST_ONLY.');
  lines.push('- No rule upgrades to PAPER_ONLY from this review layer.');
  lines.push('');
  lines.push('## 8. Image Reports');
  if (caseReports) {
    lines.push(`- Positive PNG cases: ${caseReports.positive.length}, folder ${caseReports.out_dir}\\positive.`);
    lines.push(`- Negative PNG cases: ${caseReports.negative.length}, folder ${caseReports.out_dir}\\negative.`);
    lines.push(`- Manifest: ${caseReports.manifest}.`);
  } else {
    lines.push('- PNG case reports were not generated in this run.');
  }
  lines.push('');
  lines.push('## 9. Needs More Data');
  lines.push('- Fresh live-market watchlist observations.');
  lines.push('- More Bobby+Mancini sessions.');
  lines.push('- Visual validation of stop placement and staged-add fills.');
  lines.push('- Explicit chop and repeated-same-level throttles.');
  lines.push('');
  lines.push('## 10. Commands');
  lines.push('- `npm run research:ladder-reclaim-review`');
  lines.push('- `npm run research:ladder-reclaim`');
  lines.push('- `npm test`');
  lines.push('');
  return lines.join('\n');
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function fmt(value) {
  return Number.isFinite(value) ? rounded(value) : 'n/a';
}

function average(values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? rounded(nums.reduce((sum, value) => sum + value, 0) / nums.length) : null;
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? rounded(nums[mid]) : rounded((nums[mid - 1] + nums[mid]) / 2);
}

function range(values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? { min: rounded(Math.min(...nums)), max: rounded(Math.max(...nums)) } : { min: null, max: null };
}

function loadExistingSummary() {
  return readJson(path.join(RESEARCH_ARTIFACT_DIR, 'multi-source-ladder-reclaim-results.json'), {})?.summary || null;
}

module.exports = {
  buildBarsByDate,
  chartWindow,
  keyForRow,
  unionRows,
  canonicalReviewRows,
  takenRowsFromSim,
  selectReviewRows,
  resultLabel,
  accountImpact,
  buildSignal,
  summarizeSelection,
  buildLadderReclaimVisualReview,
  summarizeGroup,
  writeVisualReviewArtifacts,
  selectCaseSignals,
  writeCaseReportImages,
  renderVisualReviewHtml,
  renderReviewDoc,
  loadExistingSummary,
};
