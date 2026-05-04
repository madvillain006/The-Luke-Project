'use strict';

const fs = require('fs');
const path = require('path');
const { classifyIndexTicker } = require('./kat-index-scope');
const { classifyAssetClass } = require('./kat-equity-options');
const { isWatchlistTicker } = require('./kat-ticker-watchlist');

const DEFAULT_WINDOW_MINUTES = 30;

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

function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
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
  return text.length <= limit ? text : text.slice(0, limit - 3) + '...';
}

function rawById(rawRecords) {
  const map = new Map();
  for (const entry of rawRecords) {
    if (entry.message_id) map.set(entry.message_id, entry);
  }
  return map;
}

function groupForSignal(signal) {
  if (!signal || !signal.ticker) return null;
  const ticker = String(signal.ticker).toUpperCase();
  const scope = classifyIndexTicker(ticker);
  if (scope.ticker) {
    return {
      id: 'index:' + scope.family,
      label: scope.family === 'spx' ? 'SPX/SPY/ES index lane' : 'QQQ/NDX/NQ index lane',
      type: 'index',
      scope,
    };
  }
  if (isWatchlistTicker(ticker)) {
    return {
      id: 'watch:' + ticker,
      label: ticker + ' equity/options shadow lane',
      type: 'equity_options',
      ticker,
    };
  }
  return null;
}

function minutesBetween(a, b) {
  const first = new Date(a || 0).getTime();
  const second = new Date(b || 0).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.round(Math.abs(second - first) / 60000);
}

function signalEvidence(signal, rawMap) {
  const entry = rawMap.get(signal.message_id) || null;
  const text = entry ? entry.content : signal.raw;
  const assetContext = groupForSignal(signal)?.type === 'equity_options'
    ? classifyAssetClass(text || signal.raw || '', signal.ticker)
    : null;

  return {
    ts: signal.ts || (entry && entry.ts) || null,
    analyst: signal.analyst || (entry && entry.username) || null,
    channel: signal.channel || (entry && entry.channel_name) || null,
    message_id: signal.message_id || null,
    raw_input: text || '',
    attachments: entry && Array.isArray(entry.attachments) ? entry.attachments : [],
    parsed: {
      ticker: signal.ticker || null,
      signal_type: signal.signal_type || null,
      bias: signal.bias || 'NEUTRAL',
      levels: Array.isArray(signal.levels) ? signal.levels : [],
      timeframe: signal.timeframe || null,
      pattern: signal.pattern || null,
      has_image: signal.has_image === true || !!(entry && Array.isArray(entry.attachments) && entry.attachments.length),
      asset_context: assetContext,
    },
  };
}

function eligibleSignals(processedRecords) {
  return processedRecords
    .filter(signal => signal && signal.ts && signal.ticker)
    .filter(signal => ['CHART_ANALYSIS', 'DIRECTIONAL', 'LEVEL_WATCH'].includes(signal.signal_type))
    .filter(signal => ['BULLISH', 'BEARISH'].includes(signal.bias))
    .map(signal => ({ ...signal, group: groupForSignal(signal) }))
    .filter(signal => signal.group);
}

function findConfluenceExamples(rawRecords, processedRecords, options = {}) {
  const rawMap = rawById(rawRecords);
  const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
  const windowMs = windowMinutes * 60 * 1000;
  const signals = eligibleSignals(processedRecords)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const examples = [];
  const seen = new Set();

  for (let i = 0; i < signals.length; i++) {
    const anchor = signals[i];
    const anchorMs = new Date(anchor.ts).getTime();
    if (!Number.isFinite(anchorMs)) continue;

    const groupSignals = signals
      .filter(signal => signal.group.id === anchor.group.id && signal.bias === anchor.bias)
      .filter(signal => {
        const ms = new Date(signal.ts).getTime();
        return Number.isFinite(ms) && ms >= anchorMs && ms <= anchorMs + windowMs;
      })
      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

    const analysts = [...new Set(groupSignals.map(signal => signal.analyst).filter(Boolean))];
    if (analysts.length < 2) continue;

    const key = anchor.group.id + ':' + anchor.bias + ':' + groupSignals[0].ts;
    if (seen.has(key)) continue;
    seen.add(key);

    const firstTs = groupSignals[0].ts;
    const lastTs = groupSignals[groupSignals.length - 1].ts;
    examples.push({
      kind: anchor.group.type === 'index' ? 'index_confluence' : 'equity_options_confluence',
      group: anchor.group.label,
      group_id: anchor.group.id,
      bias: anchor.bias,
      analysts,
      signal_count: groupSignals.length,
      window_minutes: minutesBetween(firstTs, lastTs),
      confluence_rule: `${analysts.length} analysts aligned ${anchor.bias.toLowerCase()} inside ${windowMinutes} minutes`,
      first_ts: firstTs,
      last_ts: lastTs,
      messages: groupSignals.slice(0, 4).map(signal => signalEvidence(signal, rawMap)),
    });

  }

  return examples
    .sort((a, b) => {
      const aLevelCount = a.messages.reduce((sum, message) => sum + message.parsed.levels.length, 0);
      const bLevelCount = b.messages.reduce((sum, message) => sum + message.parsed.levels.length, 0);
      if (aLevelCount !== bLevelCount) return bLevelCount - aLevelCount;
      return String(b.last_ts || '').localeCompare(String(a.last_ts || ''));
    })
    .slice(0, options.limit || 6);
}

function latestExamples(rawRecords, processedRecords, limit) {
  const rawMap = rawById(rawRecords);
  return eligibleSignals(processedRecords)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .slice(0, limit || 8)
    .map(signal => ({
      kind: signal.group.type === 'index' ? 'latest_index_signal' : 'latest_equity_options_signal',
      group: signal.group.label,
      messages: [signalEvidence(signal, rawMap)],
    }));
}

function latestVisionExamples(visionRecords, sourceClass, limit) {
  return (visionRecords || [])
    .filter(record => record && record.source_class === sourceClass)
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
    .slice(0, limit || 4)
    .map(record => ({
      kind: sourceClass === 'heatmap' ? 'vision_heatmap_parse' : 'vision_chart_parse',
      source_class: record.source_class,
      ts: record.ts,
      analyst: record.analyst,
      channel: record.channel,
      message_id: record.message_id,
      attachment_id: record.attachment_id,
      attachment: record.attachment || null,
      raw_input: record.raw_text || '',
      parsed: {
        ticker: record.ticker,
        chart_type: record.chart_type,
        bias: record.bias,
        levels: record.levels || [],
        support_levels: record.support_levels || [],
        resistance_levels: record.resistance_levels || [],
        key_levels: record.key_levels || [],
        heatmap_context: record.heatmap_context || null,
        parse_status: record.parse_status,
      },
    }));
}

function sanitizePayload(payload) {
  if (typeof payload === 'string') return { content: payload };
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    files: Array.isArray(payload.files)
      ? payload.files.map(file => ({
        name: file && file.name ? file.name : null,
        attachment: file && file.attachment ? String(file.attachment) : null,
      }))
      : undefined,
  };
}

function outputBinPaths(rootDir) {
  const binDir = path.join(rootDir, 'reports', 'katbot-owner-proof', 'message-bin');
  return {
    binDir,
    outputJsonl: path.join(binDir, 'katbot-output-bin.jsonl'),
    outputLatest: path.join(binDir, 'latest-output.json'),
  };
}

function recordKatOutputBin(input, options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const paths = outputBinPaths(rootDir);
  const record = {
    recorded_at: new Date().toISOString(),
    kind: input.kind || 'unknown',
    reason: input.reason || 'discord_output_gate',
    target: input.target || null,
    payload: sanitizePayload(input.payload),
  };
  appendJsonl(paths.outputJsonl, record);
  writeJson(paths.outputLatest, record);
  return { ...paths, record };
}

function renderExamplesMarkdown(bin) {
  const lines = [
    '# Katbot Message Bin',
    '',
    'Purpose: timestamped proof examples from actual Kat raw input and parsed signal output.',
    '',
    '## Confluence And Timeliness Examples',
  ];

  for (const example of bin.confluence_examples) {
    lines.push('');
    lines.push(`### ${example.group} - ${example.bias}`);
    lines.push(`- Rule: ${example.confluence_rule}`);
    lines.push(`- First timestamp: ${example.first_ts}`);
    lines.push(`- Last timestamp: ${example.last_ts}`);
    lines.push(`- Window: ${example.window_minutes} minute(s)`);
    lines.push(`- Analysts: ${example.analysts.join(', ')}`);
    for (const message of example.messages) {
      lines.push('');
      lines.push(`Message ${message.message_id || 'missing'} @ ${message.ts}`);
      lines.push(`- Analyst/channel: ${message.analyst || 'unknown'} / #${message.channel || 'unknown'}`);
      lines.push(`- Input: "${truncate(message.raw_input, 360)}"`);
      lines.push(`- Parsed: ${message.parsed.ticker} ${message.parsed.bias} ${message.parsed.signal_type}; levels=${message.parsed.levels.join(', ') || 'none'}`);
    }
  }

  if (!bin.confluence_examples.length) {
    lines.push('- No two-analyst confluence example found in the configured window. Latest examples below.');
  }

  lines.push('');
  lines.push('## Parsed Vision Examples: Charts');
  for (const example of bin.vision_examples.charts) {
    lines.push('');
    lines.push(`- ${example.ts} | ${example.analyst || 'unknown'} / #${example.channel || 'unknown'} | ${example.parsed.chart_type} | ${example.parsed.ticker || 'unknown'} | ${example.message_id}`);
    lines.push(`  - Input: "${truncate(example.raw_input, 220)}"`);
    lines.push(`  - Levels: ${example.parsed.levels.join(', ') || 'none'} | Bias: ${example.parsed.bias}`);
  }
  if (!bin.vision_examples.charts.length) lines.push('- No persisted chart vision parses yet.');

  lines.push('');
  lines.push('## Parsed Vision Examples: Heatmaps');
  for (const example of bin.vision_examples.heatmaps) {
    lines.push('');
    lines.push(`- ${example.ts} | ${example.analyst || 'unknown'} / #${example.channel || 'unknown'} | ${example.parsed.ticker || 'unknown'} | ${example.message_id}`);
    lines.push(`  - Input: "${truncate(example.raw_input, 220)}"`);
    lines.push(`  - Levels: ${example.parsed.levels.join(', ') || 'none'} | Bias: ${example.parsed.bias}`);
    if (example.parsed.heatmap_context) lines.push(`  - Heatmap context: ${JSON.stringify(example.parsed.heatmap_context)}`);
  }
  if (!bin.vision_examples.heatmaps.length) lines.push('- No persisted heatmap vision parses yet.');

  lines.push('');
  lines.push('## Latest Parsed Examples');
  for (const example of bin.latest_examples.slice(0, 8)) {
    const message = example.messages[0];
    lines.push('');
    lines.push(`- ${message.ts} | ${example.group} | ${message.parsed.ticker} | ${message.parsed.bias} | ${message.message_id}`);
    lines.push(`  - "${truncate(message.raw_input, 220)}"`);
  }

  lines.push('');
  lines.push('## Local Output Sink');
  lines.push('- Suppressed Discord replies/posts are appended to `katbot-output-bin.jsonl`.');
  lines.push('- This is where generated Discord-facing text goes until Conor approves public output.');
  lines.push('');
  return lines.join('\n');
}

function renderExamplesHtml(bin) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Katbot Message Bin</title>
  <style>
    body { margin:0; font-family: Inter, Segoe UI, Arial, sans-serif; background:#0d1117; color:#e6edf3; }
    main { max-width:1160px; margin:0 auto; padding:28px; }
    h1 { margin:0 0 8px; }
    h2 { color:#7dd3fc; margin-top:28px; }
    .example { border:1px solid #30363d; background:#161b22; border-radius:8px; padding:14px; margin:14px 0; }
    .message { border-left:3px solid #58a6ff; padding-left:12px; margin:12px 0; }
    .meta { color:#9da7b3; font-size:13px; }
    .badge { display:inline-block; margin:2px 4px 2px 0; padding:3px 7px; border-radius:999px; background:#1f2a44; color:#dbeafe; font-size:12px; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; background:#06080c; border:1px solid #30363d; border-radius:8px; padding:10px; }
  </style>
</head>
<body>
<main>
  <h1>Katbot Message Bin</h1>
  <p class="meta">Generated ${escapeHtml(bin.generated_at)}. Actual raw input + parsed output examples.</p>
  <h2>Confluence And Timeliness</h2>
  ${bin.confluence_examples.map(example => `
    <section class="example">
      <h3>${escapeHtml(example.group)} - ${escapeHtml(example.bias)}</h3>
      <div class="meta">${escapeHtml(example.confluence_rule)} | window ${escapeHtml(example.window_minutes)} minute(s)</div>
      <p>${example.analysts.map(a => `<span class="badge">${escapeHtml(a)}</span>`).join('')}</p>
      ${example.messages.map(message => `
        <div class="message">
          <div class="meta">${escapeHtml(message.ts)} | ${escapeHtml(message.analyst)} / #${escapeHtml(message.channel)} | ${escapeHtml(message.message_id)}</div>
          <p>${escapeHtml(truncate(message.raw_input, 360))}</p>
          <pre>${escapeHtml(JSON.stringify(message.parsed, null, 2))}</pre>
        </div>
      `).join('')}
    </section>
  `).join('') || '<p>No two-analyst confluence example found in the configured window.</p>'}
  <h2>Latest Parsed Examples</h2>
  ${bin.latest_examples.slice(0, 8).map(example => {
    const message = example.messages[0];
    return `<section class="example"><div class="meta">${escapeHtml(message.ts)} | ${escapeHtml(example.group)} | ${escapeHtml(message.message_id)}</div><p>${escapeHtml(truncate(message.raw_input, 260))}</p><pre>${escapeHtml(JSON.stringify(message.parsed, null, 2))}</pre></section>`;
  }).join('')}
  <h2>Parsed Vision Examples: Charts</h2>
  ${bin.vision_examples.charts.map(example => `
    <section class="example">
      <div class="meta">${escapeHtml(example.ts)} | ${escapeHtml(example.analyst)} / #${escapeHtml(example.channel)} | ${escapeHtml(example.message_id)}</div>
      <p>${escapeHtml(truncate(example.raw_input, 260))}</p>
      <pre>${escapeHtml(JSON.stringify(example.parsed, null, 2))}</pre>
    </section>
  `).join('') || '<p>No persisted chart vision parses yet.</p>'}
  <h2>Parsed Vision Examples: Heatmaps</h2>
  ${bin.vision_examples.heatmaps.map(example => `
    <section class="example">
      <div class="meta">${escapeHtml(example.ts)} | ${escapeHtml(example.analyst)} / #${escapeHtml(example.channel)} | ${escapeHtml(example.message_id)}</div>
      <p>${escapeHtml(truncate(example.raw_input, 260))}</p>
      <pre>${escapeHtml(JSON.stringify(example.parsed, null, 2))}</pre>
    </section>
  `).join('') || '<p>No persisted heatmap vision parses yet.</p>'}
</main>
</body>
</html>`;
}

function buildKatMessageBin(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const outDir = options.outDir || path.join(rootDir, 'reports', 'katbot-owner-proof', 'message-bin');
  const katDir = path.join(rootDir, 'data', 'kat');
  const rawRecords = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const processedRecords = readJsonl(path.join(katDir, 'processed-signals.jsonl'));
  const visionRecords = readJsonl(path.join(katDir, 'vision-signals.jsonl'));
  const confluenceExamples = findConfluenceExamples(rawRecords, processedRecords, {
    limit: options.limit || 6,
    windowMinutes: options.windowMinutes || DEFAULT_WINDOW_MINUTES,
  });
  const latest = latestExamples(rawRecords, processedRecords, 10);
  const bin = {
    generated_at: (options.now || new Date()).toISOString(),
    source_files: {
      raw_feed: path.join('data', 'kat', 'raw-feed.jsonl'),
      processed_signals: path.join('data', 'kat', 'processed-signals.jsonl'),
      vision_signals: path.join('data', 'kat', 'vision-signals.jsonl'),
    },
    confluence_examples: confluenceExamples,
    latest_examples: latest,
    vision_examples: {
      charts: latestVisionExamples(visionRecords, 'chart', 4),
      heatmaps: latestVisionExamples(visionRecords, 'heatmap', 4),
    },
    output_sink: outputBinPaths(rootDir),
  };
  const files = {
    examplesJson: path.join(outDir, 'katbot-message-examples.json'),
    examplesMarkdown: path.join(outDir, 'katbot-message-examples.md'),
    examplesHtml: path.join(outDir, 'katbot-message-examples.html'),
  };
  fs.mkdirSync(outDir, { recursive: true });
  const outputPaths = outputBinPaths(rootDir);
  if (!fs.existsSync(outputPaths.outputJsonl)) fs.writeFileSync(outputPaths.outputJsonl, '', 'utf8');
  writeJson(files.examplesJson, bin);
  fs.writeFileSync(files.examplesMarkdown, renderExamplesMarkdown(bin), 'utf8');
  fs.writeFileSync(files.examplesHtml, renderExamplesHtml(bin), 'utf8');
  return { outDir, files, bin };
}

module.exports = {
  buildKatMessageBin,
  recordKatOutputBin,
  findConfluenceExamples,
  latestExamples,
  latestVisionExamples,
  renderExamplesMarkdown,
  renderExamplesHtml,
  _internal: {
    groupForSignal,
    signalEvidence,
    sanitizePayload,
    outputBinPaths,
  },
};
