'use strict';

const fs = require('fs');
const path = require('path');
const { buildKatReadiness, formatKatReadinessMarkdown } = require('./kat-readiness');
const { buildKatInsights } = require('./kat-insights');
const { buildKatEquityOptionsUniverse, classifyAssetClass } = require('./kat-equity-options');
const { buildKatTickerWatchlist } = require('./kat-ticker-watchlist');
const { classifyIndexTicker } = require('./kat-index-scope');
const { buildKatMessageBin } = require('./kat-message-bin');
const { readKatVisionSignals } = require('./kat-vision-store');

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 3) + '...';
}

function rawMap(rawRecords) {
  const map = new Map();
  for (const entry of rawRecords) {
    if (entry.message_id) map.set(entry.message_id, entry);
  }
  return map;
}

function findIndexSample(rawRecords, processedRecords) {
  const byId = rawMap(rawRecords);
  const candidates = processedRecords
    .filter(signal => signal && signal.message_id && signal.ticker)
    .filter(signal => {
      const scope = classifyIndexTicker(signal.ticker);
      return scope.ticker && ['SPX', 'SPY'].includes(scope.ticker);
    })
    .filter(signal => Array.isArray(signal.levels) && signal.levels.length > 0)
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));

  for (const signal of candidates) {
    const entry = byId.get(signal.message_id);
    if (!entry) continue;
    return { signal, entry };
  }

  const fallback = processedRecords.find(signal => signal && signal.ticker && classifyIndexTicker(signal.ticker).ticker);
  return fallback ? { signal: fallback, entry: byId.get(fallback.message_id) || null } : null;
}

function findImageSample(rawRecords) {
  const entries = rawRecords
    .filter(entry => Array.isArray(entry.attachments) && entry.attachments.some(att => att && att.url))
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
  return entries[0] || null;
}

function findVisionSample(visionRecords, sourceClass) {
  return (visionRecords || [])
    .filter(record => record && record.source_class === sourceClass)
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))[0] || null;
}

function findEquityOptionSample(rawRecords, processedRecords, readyTickers) {
  const ready = new Set(readyTickers || []);
  const byId = rawMap(rawRecords);
  const processed = processedRecords
    .filter(signal => signal && signal.ticker)
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));

  for (const signal of processed) {
    if (ready.size && !ready.has(String(signal.ticker).toUpperCase())) continue;
    const entry = byId.get(signal.message_id) || {
      ts: signal.ts,
      username: signal.analyst,
      channel_name: signal.channel,
      message_id: signal.message_id,
      content: signal.raw || '',
      attachments: [],
    };
    const context = classifyAssetClass(entry.content || signal.raw || '', signal.ticker);
    if (context) return { signal, entry, context };
  }

  return null;
}

function buildLukePayloadPreview(samples) {
  const indexSample = samples.index;
  const equitySample = samples.equityOption;
  const payloads = [];

  if (indexSample && indexSample.signal) {
    payloads.push({
      type: 'kat_signal',
      source: 'katbot-discord',
      ticker: indexSample.signal.ticker,
      bias: indexSample.signal.bias || 'NEUTRAL',
      levels: indexSample.signal.levels || [],
      analyst: indexSample.signal.analyst,
      channel: indexSample.entry ? indexSample.entry.channel_name : indexSample.signal.channel,
      message_id: indexSample.signal.message_id,
      human_gate_required: true,
    });
  }

  if (equitySample && equitySample.signal) {
    payloads.push({
      type: 'kat_watchlist_signal',
      source: 'katbot-discord',
      ticker: equitySample.signal.ticker,
      asset_class: equitySample.context.asset_class,
      option_context: equitySample.context.asset_class === 'option' ? equitySample.context : null,
      equity_context: equitySample.context.asset_class === 'equity' ? equitySample.context : null,
      analyst: equitySample.signal.analyst,
      message_id: equitySample.signal.message_id,
      policy: 'equity/options shadow-watch only; not SPX-equivalent and not execution authority',
      human_gate_required: true,
    });
  }

  for (const vision of [samples.visionChart, samples.visionHeatmap].filter(Boolean)) {
    payloads.push({
      type: 'kat_vision',
      source: 'katbot-discord',
      source_class: vision.source_class,
      parse_status: vision.parse_status,
      ticker: vision.ticker,
      chart_type: vision.chart_type,
      bias: vision.bias,
      levels: vision.levels || [],
      heatmap_context: vision.heatmap_context || null,
      analyst: vision.analyst,
      channel: vision.channel,
      message_id: vision.message_id,
      attachment_id: vision.attachment_id,
      human_gate_required: true,
    });
  }

  return payloads;
}

function mermaidPipeline() {
  return [
    '```mermaid',
    'flowchart LR',
    '  A["Discord analyst message"] --> B["Kat capture gate"]',
    '  B --> C["raw-feed.jsonl"]',
    '  C --> D["parse-kat signal parser"]',
    '  D --> E["processed-signals.jsonl"]',
    '  C --> V["vision parser for chart + heatmap images"]',
    '  V --> W["vision-signals.jsonl"]',
    '  W --> E',
    '  E --> F["Index confluence lane"]',
    '  E --> G["Equity/options shadow lane"]',
    '  F --> H["Luke trading window websocket payload"]',
    '  G --> H',
    '  F --> I["Owner report / readiness pack"]',
    '  G --> I',
    '  I --> J["Discord owner review"]',
    '  J -. "explicit approval only" .-> K["Discord replies/posts"]',
    '```',
  ].join('\n');
}

function mermaidSafety() {
  return [
    '```mermaid',
    'flowchart TD',
    '  A["Generated Kat output"] --> B{"Discord output approved?"}',
    '  B -- "No" --> C["Suppress reply/post; keep Luke-only"]',
    '  B -- "Yes" --> D["Send with allowedMentions disabled"]',
    '  D --> E["No @everyone / no user reply ping"]',
    '  C --> F["Owner can inspect report first"]',
    '```',
  ].join('\n');
}

function renderJsonBlock(value) {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

function renderOwnerMarkdown(pack) {
  const index = pack.samples.index;
  const equity = pack.samples.equityOption;
  const image = pack.samples.image;
  const visionChart = pack.samples.visionChart;
  const visionHeatmap = pack.samples.visionHeatmap;
  return [
    '# Katbot Owner Review Pack',
    '',
    'Status: **' + pack.readiness.recommendation.status + '**',
    '',
    pack.readiness.recommendation.label,
    '',
    '> Discord replies/posts are gated off in this build. Nothing here has been sent to Discord.',
    '',
    '## Pipeline',
    mermaidPipeline(),
    '',
    '## Safety Gate',
    mermaidSafety(),
    '',
    '## Current Evidence',
    `- Raw messages captured: ${pack.readiness.evidence.raw_messages}`,
    `- Processed signals: ${pack.readiness.evidence.processed_signals}`,
    `- Image posts: ${pack.readiness.evidence.image_posts}`,
    `- Heatmap/image candidates: ${pack.readiness.evidence.heatmap_candidates}`,
    `- Vision parses: ${pack.readiness.evidence.vision_signals} (${pack.readiness.evidence.vision_chart_signals} chart, ${pack.readiness.evidence.vision_heatmap_signals} heatmap)`,
    `- SPX/SPY evaluated records: ${pack.readiness.evidence.spx_spy_evaluated}`,
    `- Shadow watchlist: ${pack.readiness.evidence.watchlist_candidates.join(', ') || 'none'}`,
    `- Ready for downstream validation: ${pack.readiness.evidence.equity_options_ready_for_backtest.join(', ') || 'none'}`,
    '',
    '## Parsed Message Proof: Index Lane',
    index ? [
      `- Analyst: ${index.entry ? index.entry.username : index.signal.analyst}`,
      `- Channel: ${index.entry ? index.entry.channel_name : index.signal.channel}`,
      `- Message ID: ${index.signal.message_id || 'missing'}`,
      `- Timestamp: ${index.signal.ts || (index.entry && index.entry.ts) || 'missing'}`,
      `- Message: "${truncate((index.entry && index.entry.content) || index.signal.raw, 320)}"`,
      `- Parsed ticker: ${index.signal.ticker}`,
      `- Parsed bias: ${index.signal.bias || 'NEUTRAL'}`,
      `- Parsed levels: ${(index.signal.levels || []).join(', ') || 'none'}`,
      '',
      renderJsonBlock(index.signal),
    ].join('\n') : 'No index sample found.',
    '',
    '## Parsed Message Proof: Equity/Options Shadow Lane',
    equity ? [
      `- Analyst: ${equity.entry ? equity.entry.username : equity.signal.analyst}`,
      `- Channel: ${equity.entry ? equity.entry.channel_name : equity.signal.channel}`,
      `- Message ID: ${equity.signal.message_id || 'missing'}`,
      `- Timestamp: ${equity.signal.ts || (equity.entry && equity.entry.ts) || 'missing'}`,
      `- Message: "${truncate((equity.entry && equity.entry.content) || equity.signal.raw, 320)}"`,
      `- Parsed ticker: ${equity.signal.ticker}`,
      `- Asset class: ${equity.context.asset_class}`,
      '',
      renderJsonBlock(equity.context),
    ].join('\n') : 'No equity/options sample found.',
    '',
    '## Image Proof Candidate',
    image ? [
      `- Analyst: ${image.username || 'unknown'}`,
      `- Channel: ${image.channel_name || 'unknown'}`,
      `- Message ID: ${image.message_id || 'missing'}`,
      `- Timestamp: ${image.ts || 'missing'}`,
      `- Message: "${truncate(image.content, 260)}"`,
      `- Attachment URL: ${image.attachments && image.attachments[0] ? image.attachments[0].url : 'missing'}`,
    ].join('\n') : 'No image sample found.',
    '',
    '## Parsed Vision Proof: Chart Image',
    visionChart ? [
      `- Analyst: ${visionChart.analyst || 'unknown'}`,
      `- Channel: ${visionChart.channel || 'unknown'}`,
      `- Message ID: ${visionChart.message_id || 'missing'}`,
      `- Attachment ID: ${visionChart.attachment_id || 'missing'}`,
      `- Timestamp: ${visionChart.ts || 'missing'}`,
      `- Chart type: ${visionChart.chart_type}`,
      `- Ticker: ${visionChart.ticker || 'unknown'}`,
      `- Bias: ${visionChart.bias || 'NEUTRAL'}`,
      `- Levels: ${(visionChart.levels || []).join(', ') || 'none'}`,
      '',
      renderJsonBlock(visionChart),
    ].join('\n') : 'No persisted chart vision parse found yet.',
    '',
    '## Parsed Vision Proof: Heatmap Image',
    visionHeatmap ? [
      `- Analyst: ${visionHeatmap.analyst || 'unknown'}`,
      `- Channel: ${visionHeatmap.channel || 'unknown'}`,
      `- Message ID: ${visionHeatmap.message_id || 'missing'}`,
      `- Attachment ID: ${visionHeatmap.attachment_id || 'missing'}`,
      `- Timestamp: ${visionHeatmap.ts || 'missing'}`,
      `- Ticker: ${visionHeatmap.ticker || 'unknown'}`,
      `- Bias: ${visionHeatmap.bias || 'NEUTRAL'}`,
      `- Levels: ${(visionHeatmap.levels || []).join(', ') || 'none'}`,
      '',
      renderJsonBlock(visionHeatmap),
    ].join('\n') : 'No persisted heatmap vision parse found yet.',
    '',
    '## Rendered Screenshot Proof',
    '- Owner proof page: `screenshots/owner-proof.png`',
    '- Luke trading-window preview: `screenshots/luke-trading-preview.png`',
    '',
    '## Timestamped Message Bin',
    '- Examples JSON: `message-bin/katbot-message-examples.json`',
    '- Examples Markdown: `message-bin/katbot-message-examples.md`',
    '- Examples HTML: `message-bin/katbot-message-examples.html`',
    '- Suppressed Discord output sink: `message-bin/katbot-output-bin.jsonl`',
    '',
    '## Discord Preview',
    'Preview only. This is how owner-facing Kat output would look if explicitly approved later.',
    '',
    '```text',
    pack.previews.discord,
    '```',
    '',
    '## Trading Bot Window Preview',
    'Separate operator-facing sub-agent view. This is what the Luke brain receives internally.',
    '',
    renderJsonBlock(pack.previews.lukePayloads),
    '',
    '## Readiness Details',
    formatKatReadinessMarkdown(pack.readiness),
  ].flat().join('\n');
}

function renderOwnerHtml(pack) {
  const index = pack.samples.index;
  const equity = pack.samples.equityOption;
  const image = pack.samples.image;
  const visionChart = pack.samples.visionChart;
  const visionHeatmap = pack.samples.visionHeatmap;
  const imageUrl = image && image.attachments && image.attachments[0] ? image.attachments[0].url : null;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Katbot Owner Proof Pack</title>
  <style>
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #101114; color: #eee; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px; }
    h1, h2 { margin: 0 0 12px; }
    h1 { font-size: 34px; }
    h2 { font-size: 20px; margin-top: 28px; color: #9ecbff; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card { border: 1px solid #2e3340; border-radius: 8px; background: #171a21; padding: 16px; }
    .wide { grid-column: 1 / -1; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 6px; background: #263516; color: #c8f6aa; font-weight: 700; }
    .blocked { background: #442018; color: #ffc2ad; }
    .muted { color: #aab0bd; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #0b0d11; border: 1px solid #2a2f3b; border-radius: 8px; padding: 12px; }
    .flow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .node { padding: 10px 12px; border: 1px solid #3a4252; border-radius: 8px; background: #202532; }
    .arrow { color: #7e8798; }
    img { max-width: 100%; border-radius: 8px; border: 1px solid #2a2f3b; background: #050505; }
    .discord { background: #313338; border-color: #3f4147; }
    .luke { background: #111827; border-color: #334155; }
    .badge { display:inline-block; margin:2px 4px 2px 0; padding:3px 7px; border-radius:999px; background:#263143; color:#d9e8ff; font-size:12px; }
  </style>
</head>
<body>
<main>
  <h1>Katbot Owner Proof Pack</h1>
  <p><span class="status">${escapeHtml(pack.readiness.recommendation.status)}</span> <span class="muted">${escapeHtml(pack.readiness.recommendation.label)}</span></p>
  <section class="card wide">
    <h2>Pipeline</h2>
    <div class="flow">
      ${['Discord message','Kat capture gate','raw-feed.jsonl','parse-kat + vision parser','processed + vision JSONL','index lane','equity/options lane','Luke trading window','owner review','Discord output gate'].map((label, i, arr) => `<span class="node">${escapeHtml(label)}</span>${i < arr.length - 1 ? '<span class="arrow">-></span>' : ''}`).join('')}
    </div>
  </section>
  <section class="grid">
    <div class="card">
      <h2>Evidence Counts</h2>
      <p>Raw messages: <b>${pack.readiness.evidence.raw_messages}</b></p>
      <p>Processed signals: <b>${pack.readiness.evidence.processed_signals}</b></p>
      <p>Image posts: <b>${pack.readiness.evidence.image_posts}</b></p>
      <p>Heatmap candidates: <b>${pack.readiness.evidence.heatmap_candidates}</b></p>
      <p>Vision parses: <b>${pack.readiness.evidence.vision_signals}</b> (${pack.readiness.evidence.vision_chart_signals} chart, ${pack.readiness.evidence.vision_heatmap_signals} heatmap)</p>
      <p>SPX/SPY evaluated: <b>${pack.readiness.evidence.spx_spy_evaluated}</b></p>
      <p>${pack.readiness.evidence.watchlist_candidates.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('')}</p>
    </div>
    <div class="card">
      <h2>Safety Gate</h2>
      <p>Discord replies enabled: <b>${pack.readiness.discord_output_gate.responses_enabled}</b></p>
      <p>Discord posts enabled: <b>${pack.readiness.discord_output_gate.posts_enabled}</b></p>
      <p class="muted">Output stays suppressed until explicitly approved. Mentions are disabled.</p>
    </div>
    <div class="card">
      <h2>Index Parsed Message</h2>
      <p><b>${escapeHtml(index && index.signal ? index.signal.ticker : 'none')}</b> ${escapeHtml(index && index.signal ? index.signal.bias || 'NEUTRAL' : '')}</p>
      <p class="muted">${escapeHtml(index && index.entry ? index.entry.username + ' / #' + index.entry.channel_name + ' / ' + index.entry.message_id : '')}</p>
      <p>${escapeHtml(truncate(index && index.entry ? index.entry.content : '', 280))}</p>
      <pre>${escapeHtml(JSON.stringify(index && index.signal ? index.signal : {}, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Equity/Options Parsed Message</h2>
      <p><b>${escapeHtml(equity && equity.signal ? equity.signal.ticker : 'none')}</b> ${escapeHtml(equity && equity.context ? equity.context.asset_class : '')}</p>
      <p class="muted">${escapeHtml(equity && equity.entry ? equity.entry.username + ' / #' + equity.entry.channel_name + ' / ' + equity.entry.message_id : '')}</p>
      <p>${escapeHtml(truncate(equity && equity.entry ? equity.entry.content : '', 280))}</p>
      <pre>${escapeHtml(JSON.stringify(equity && equity.context ? equity.context : {}, null, 2))}</pre>
    </div>
    <div class="card wide">
      <h2>Image Proof Candidate</h2>
      <p class="muted">${escapeHtml(image ? image.username + ' / #' + image.channel_name + ' / ' + image.message_id : 'No image sample found')}</p>
      <p>${escapeHtml(truncate(image ? image.content : '', 280))}</p>
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Kat evidence image from Discord CDN">` : '<p>No image URL available.</p>'}
    </div>
    <div class="card">
      <h2>Parsed Vision: Chart</h2>
      <p><b>${escapeHtml(visionChart ? visionChart.ticker || 'unknown' : 'none')}</b> ${escapeHtml(visionChart ? visionChart.chart_type + ' ' + visionChart.bias : '')}</p>
      <p class="muted">${escapeHtml(visionChart ? visionChart.analyst + ' / #' + visionChart.channel + ' / ' + visionChart.message_id : 'No persisted chart vision parse yet')}</p>
      <pre>${escapeHtml(JSON.stringify(visionChart || {}, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Parsed Vision: Heatmap</h2>
      <p><b>${escapeHtml(visionHeatmap ? visionHeatmap.ticker || 'unknown' : 'none')}</b> ${escapeHtml(visionHeatmap ? visionHeatmap.bias : '')}</p>
      <p class="muted">${escapeHtml(visionHeatmap ? visionHeatmap.analyst + ' / #' + visionHeatmap.channel + ' / ' + visionHeatmap.message_id : 'No persisted heatmap vision parse yet')}</p>
      <pre>${escapeHtml(JSON.stringify(visionHeatmap || {}, null, 2))}</pre>
    </div>
    <div class="card wide">
      <h2>Timestamped Message Bin</h2>
      <p>Operator readouts: <b>${pack.messageBin.operator_readouts.length}</b></p>
      <p>Confluence examples: <b>${pack.messageBin.confluence_examples.length}</b></p>
      <p>Latest parsed examples: <b>${pack.messageBin.latest_examples.length}</b></p>
      <p>Vision chart examples: <b>${pack.messageBin.vision_examples.charts.length}</b></p>
      <p>Vision heatmap examples: <b>${pack.messageBin.vision_examples.heatmaps.length}</b></p>
      <p class="muted">Files: message-bin/katbot-message-examples.html, message-bin/katbot-message-examples.md, message-bin/katbot-output-bin.jsonl</p>
    </div>
    <div class="card discord">
      <h2>Discord Preview</h2>
      <pre>${escapeHtml(pack.previews.discord)}</pre>
    </div>
    <div class="card luke">
      <h2>Trading Bot Window Preview</h2>
      <pre>${escapeHtml(JSON.stringify(pack.previews.lukePayloads, null, 2))}</pre>
    </div>
  </section>
</main>
</body>
</html>`;
}

function renderLukeHtml(pack) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Trading Bot Window Kat Preview</title>
  <style>
    body { margin:0; font-family: Inter, Segoe UI, Arial, sans-serif; background:#07111f; color:#e5edf8; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    .event { border:1px solid #1e3a5f; background:#0d1b2e; border-radius:8px; padding:14px; margin:12px 0; }
    .type { color:#7dd3fc; font-weight:700; }
    .gate { color:#fbbf24; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; background:#030712; border:1px solid #1e293b; border-radius:8px; padding:12px; }
  </style>
</head>
<body>
<main>
  <h1>Trading Bot Window: Kat Incoming Events</h1>
  <p>Internal preview only. These are Trading Bot payloads inside the larger Luke brain, not Discord messages.</p>
  ${pack.previews.lukePayloads.map(payload => `
    <section class="event">
      <div class="type">${escapeHtml(payload.type)} · ${escapeHtml(payload.ticker || 'index chart')}</div>
      <div>Source: ${escapeHtml(payload.source)} · Analyst: ${escapeHtml(payload.analyst || 'unknown')} · Message: ${escapeHtml(payload.message_id || 'missing')}</div>
      <div class="gate">Human gate required: ${payload.human_gate_required === true}</div>
      <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </section>
  `).join('')}
</main>
</body>
</html>`;
}

function buildKatOwnerProofPack(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const outDir = options.outDir || path.join(rootDir, 'reports', 'katbot-owner-proof');
  const now = options.now || new Date();
  const katDir = path.join(rootDir, 'data', 'kat');
  const rawRecords = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const processedRecords = readJsonl(path.join(katDir, 'processed-signals.jsonl'));
  const visionRecords = readKatVisionSignals({ rootDir });
  const readiness = buildKatReadiness({ rootDir, now });
  const insights = buildKatInsights({ rootDir, now, runtime: options.runtime || {} });
  const watchlist = buildKatTickerWatchlist({ rootDir, now, limit: 10 });
  const equityUniverse = buildKatEquityOptionsUniverse({ rootDir, now, limit: 20 });
  const messageBin = buildKatMessageBin({
    rootDir,
    outDir: path.join(outDir, 'message-bin'),
    now,
  });
  const samples = {
    index: findIndexSample(rawRecords, processedRecords),
    equityOption: findEquityOptionSample(rawRecords, processedRecords, equityUniverse.ready_for_backtest),
    image: findImageSample(rawRecords),
    visionChart: findVisionSample(visionRecords, 'chart'),
    visionHeatmap: findVisionSample(visionRecords, 'heatmap'),
  };
  const previews = {
    discord: [
      '**Kat owner-review preview**',
      'Status: ' + readiness.recommendation.status,
      'Evidence: ' + readiness.evidence.raw_messages + ' raw messages, ' + readiness.evidence.processed_signals + ' processed signals',
      'Watchlist: ' + readiness.evidence.watchlist_candidates.slice(0, 6).join(', '),
      'Discord output: gated off until Conor explicitly approves generated wording.',
      '_No autonomous execution. Human-gated evidence only._',
    ].join('\n'),
    lukePayloads: buildLukePayloadPreview(samples),
  };
  const pack = { generated_at: now.toISOString(), readiness, insights, watchlist, equityUniverse, messageBin: messageBin.bin, samples, previews };

  fs.mkdirSync(outDir, { recursive: true });
  const files = {
    evidenceJson: path.join(outDir, 'katbot-owner-evidence.json'),
    ownerMarkdown: path.join(outDir, 'katbot-owner-report.md'),
    ownerHtml: path.join(outDir, 'katbot-owner-proof.html'),
    lukeHtml: path.join(outDir, 'luke-trading-window-preview.html'),
  };

  fs.writeFileSync(files.evidenceJson, JSON.stringify(pack, null, 2), 'utf8');
  fs.writeFileSync(files.ownerMarkdown, renderOwnerMarkdown(pack), 'utf8');
  fs.writeFileSync(files.ownerHtml, renderOwnerHtml(pack), 'utf8');
  fs.writeFileSync(files.lukeHtml, renderLukeHtml(pack), 'utf8');

  return { outDir, files, pack };
}

module.exports = {
  buildKatOwnerProofPack,
  renderOwnerMarkdown,
  renderOwnerHtml,
  renderLukeHtml,
  _internal: {
    findIndexSample,
    findImageSample,
    findVisionSample,
    findEquityOptionSample,
    buildLukePayloadPreview,
    mermaidPipeline,
    mermaidSafety,
  },
};
