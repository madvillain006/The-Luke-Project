'use strict';

const fs = require('fs');
const path = require('path');

const HEATMAP_REQUESTS_CHANNEL_ID = '1482431257441996850';
const HEATMAP_REQUESTS_CHANNEL_NAME = 'heatmap-requests';

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function normalizeTicker(value) {
  const ticker = String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (ticker === 'ESF' || ticker === 'ES' || ticker === 'MES') return 'ES';
  if (ticker === 'SPXW' || ticker === 'SPX') return 'SPX';
  if (ticker === 'NQF' || ticker === 'NQ' || ticker === 'MNQ') return 'NQ';
  if (ticker === 'NDX') return 'NDX';
  if (ticker === 'SPY') return 'SPY';
  if (ticker === 'QQQ') return 'QQQ';
  return ticker || null;
}

function tickerMatches(targetTicker, candidateTicker) {
  const target = normalizeTicker(targetTicker);
  const candidate = normalizeTicker(candidateTicker);
  if (!target || !candidate) return false;
  if (target === candidate) return true;
  const aliasSets = [
    new Set(['SPX', 'SPY', 'ES']),
    new Set(['QQQ', 'NDX', 'NQ']),
  ];
  return aliasSets.some(set => set.has(target) && set.has(candidate));
}

function isImageAttachment(att) {
  if (!att) return false;
  const type = String(att.content_type || att.contentType || '').toLowerCase();
  const filename = String(att.filename || att.name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function latestTimestamp(records) {
  let latest = null;
  for (const record of records) {
    const ts = record && record.ts;
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!latest || ms > latest.ms) latest = { ts, ms };
  }
  return latest;
}

function asEt(ts) {
  if (!ts) return 'n/a';
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return 'n/a';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

function ageText(ts, now) {
  const ms = new Date(ts || 0).getTime();
  if (!Number.isFinite(ms)) return 'unknown age';
  const ageMs = now.getTime() - ms;
  if (ageMs < 0) return 'future timestamp';
  const mins = Math.round(ageMs / 60000);
  if (mins < 60) return mins + 'm old';
  const hours = Math.floor(mins / 60);
  return hours + 'h ' + (mins % 60) + 'm old';
}

function signalTickerMatches(signal, ticker) {
  return tickerMatches(ticker, signal.ticker);
}

function buildLevelsCommandOutput(processed, ticker, now) {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const levelMap = new Map();

  for (const signal of processed) {
    if (!signal || !signal.ts || !signalTickerMatches(signal, ticker)) continue;
    const ms = new Date(signal.ts).getTime();
    if (!Number.isFinite(ms) || ms < cutoff) continue;
    if (!Array.isArray(signal.levels) || signal.levels.length === 0) continue;
    for (const level of signal.levels) {
      const number = Number(level);
      if (!Number.isFinite(number)) continue;
      const bucket = Math.round(number / 5) * 5;
      const key = String(bucket);
      if (!levelMap.has(key)) {
        levelMap.set(key, { level: bucket, mentions: 0, analysts: new Set(), biases: new Set(), examples: [] });
      }
      const row = levelMap.get(key);
      row.mentions++;
      if (signal.analyst) row.analysts.add(signal.analyst);
      if (signal.bias) row.biases.add(signal.bias);
      if (row.examples.length < 3) {
        row.examples.push({
          ts: signal.ts,
          analyst: signal.analyst || 'unknown',
          channel: signal.channel || 'unknown',
          message_id: signal.message_id || null,
        });
      }
    }
  }

  const qualified = [...levelMap.values()]
    .filter(row => row.analysts.size >= 2 || row.mentions >= 3)
    .sort((a, b) => b.mentions - a.mentions || b.analysts.size - a.analysts.size)
    .slice(0, 5);

  if (!qualified.length) {
    return [
      'Kat simulated output: !kat levels ' + ticker,
      'No confirmed confluence levels for ' + ticker + ' in the last 7 days.',
      'Rule: 2+ analysts or 3+ independent mentions required. No guesses.',
    ].join('\n');
  }

  const rows = qualified.map(row => {
    const tag = row.biases.has('BEARISH') && row.biases.has('BULLISH')
      ? 'contested'
      : row.biases.has('BEARISH') ? 'resistance' : 'support';
    return '- ' + row.level + ' - ' + row.mentions + ' mention(s), ' +
      row.analysts.size + ' analyst(s), ' + tag +
      ' | examples: ' + row.examples.map(example => example.analyst + ' ' + asEt(example.ts)).join('; ');
  });

  return [
    'Kat simulated output: !kat levels ' + ticker,
    ticker + ' levels - last 7 days',
    ...rows,
    'Source: captured analyst posts. Qualification rule: 2+ analysts or 3+ mentions.',
  ].join('\n');
}

function buildBiasCommandOutput(processed, now) {
  const cutoff = now.getTime() - 18 * 60 * 60 * 1000;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  const bullAnalysts = new Set();
  const bearAnalysts = new Set();
  const tickerCounts = {};

  for (const signal of processed) {
    if (!signal || !signal.ts) continue;
    const ms = new Date(signal.ts).getTime();
    if (!Number.isFinite(ms) || ms < cutoff || ms > now.getTime()) continue;
    if (!['CHART_ANALYSIS', 'DIRECTIONAL', 'LEVEL_WATCH'].includes(signal.signal_type)) continue;
    if (signal.bias === 'BULLISH') {
      bullish++;
      if (signal.analyst) bullAnalysts.add(signal.analyst);
    } else if (signal.bias === 'BEARISH') {
      bearish++;
      if (signal.analyst) bearAnalysts.add(signal.analyst);
    } else {
      neutral++;
    }
    if (signal.ticker) tickerCounts[signal.ticker] = (tickerCounts[signal.ticker] || 0) + 1;
  }

  const total = bullish + bearish + neutral;
  if (total < 3) {
    return [
      'Kat simulated output: !kat bias',
      'Not enough signal data in the last 18 hours.',
      'Need at least 3 signals. Current: ' + total,
    ].join('\n');
  }

  const dominant = bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'MIXED';
  const directional = bullish + bearish;
  const ratio = directional ? Math.round((Math.max(bullish, bearish) / directional) * 100) : 50;
  const topTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ticker, count]) => ticker + ' (' + count + ')')
    .join(', ');

  return [
    'Kat simulated output: !kat bias',
    'Elevated Charts - last 18h regime as of ' + asEt(now.toISOString()),
    'Collective bias: ' + dominant + ' (' + ratio + '% of directional signals)',
    'Bullish: ' + bullish + ' signals from ' + bullAnalysts.size + ' analyst(s)',
    'Bearish: ' + bearish + ' signals from ' + bearAnalysts.size + ' analyst(s)',
    'Neutral/context: ' + neutral,
    'Most discussed: ' + (topTickers || 'n/a'),
    'Source: captured analyst posts. Not a prediction - synthesis only.',
  ].join('\n');
}

function entryTextMatchesTicker(entry, ticker) {
  const content = String(entry.content || '').toUpperCase();
  const normalized = normalizeTicker(ticker);
  if (!normalized) return false;
  if (content.includes(normalized) || content.includes('$' + normalized) || content.includes('#' + normalized)) return true;
  if (normalized === 'SPX' && (content.includes('ES_F') || content.includes('#ES_F') || content.includes('$SPY') || content.includes(' SPY'))) return true;
  if (normalized === 'QQQ' && (content.includes('NDX') || content.includes('NQ_F') || content.includes('#NQ_F'))) return true;
  return false;
}

function buildHeatmapCommandOutput(raw, processed, ticker, now) {
  const processedImageMessages = new Set(
    processed
      .filter(signal => signal && signal.has_image && signal.message_id && signalTickerMatches(signal, ticker))
      .map(signal => String(signal.message_id).replace(/:vision:.+$/, ''))
  );

  let best = null;
  for (let i = raw.length - 1; i >= 0; i--) {
    const entry = raw[i];
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.filter(isImageAttachment) : [];
    if (!attachments.length) continue;
    const textMatch = entryTextMatchesTicker(entry, ticker);
    const processedMatch = processedImageMessages.has(entry.message_id);
    const heatmapish = /\b(heatmap|heat map|node|king|gatekeeper|gex|gamma)\b/i.test(entry.content || '') ||
      entry.channel_id === HEATMAP_REQUESTS_CHANNEL_ID ||
      entry.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME;
    if (!textMatch && !processedMatch && !heatmapish) continue;
    best = { entry, attachment: attachments[0], textMatch, processedMatch, heatmapish };
    break;
  }

  if (!best) {
    return [
      'Kat simulated output: !kat heatmap ' + ticker,
      'No recent heatmap image found for ' + ticker + '.',
      'Kat looks for image posts from monitored analysts, including heatmap-requests.',
    ].join('\n');
  }

  const stale = now.getTime() - new Date(best.entry.ts).getTime() > 4 * 60 * 60 * 1000;
  return [
    'Kat simulated output: !kat heatmap ' + ticker,
    'Most recent ' + ticker + ' heatmap/image candidate',
    'Posted by: ' + (best.entry.username || 'unknown'),
    'Channel: ' + (best.entry.channel_name || 'unknown') + ' (' + (best.entry.channel_id || 'no id') + ')',
    'Time: ' + asEt(best.entry.ts) + ' - ' + ageText(best.entry.ts, now),
    'Attachment: ' + (best.attachment.filename || 'image') + ' - ' + (best.attachment.url || 'no url'),
    'Match basis: ' + [
      best.textMatch ? 'ticker text' : null,
      best.processedMatch ? 'processed image signal' : null,
      best.heatmapish ? 'heatmap/channel keyword' : null,
    ].filter(Boolean).join(', '),
    stale ? 'Warning: over 4 hours old - levels may have shifted.' : 'Freshness: under 4 hours old.',
    best.entry.content ? 'Post text: "' + String(best.entry.content).replace(/\s+/g, ' ').trim().slice(0, 180) + '"' : 'Post text: image-only',
    'Source: captured analyst post via Kat.',
  ].join('\n');
}

function buildMagnetPreview(processed, now, ticker) {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const levelMap = new Map();
  for (const signal of processed) {
    if (!signal || !signal.ts || !Array.isArray(signal.levels) || !signal.levels.length) continue;
    if (!['LEVEL_WATCH', 'CHART_ANALYSIS'].includes(signal.signal_type)) continue;
    if (ticker && !signalTickerMatches(signal, ticker)) continue;
    const ms = new Date(signal.ts).getTime();
    if (!Number.isFinite(ms) || ms < cutoff || ms > now.getTime()) continue;
    for (const level of signal.levels) {
      const bucket = Math.round(Number(level) / 5) * 5;
      if (!Number.isFinite(bucket)) continue;
      const key = normalizeTicker(signal.ticker) + ':' + bucket;
      if (!levelMap.has(key)) {
        levelMap.set(key, { ticker: normalizeTicker(signal.ticker), level: bucket, analysts: new Set(), mentions: 0, biases: new Set(), lastTs: signal.ts });
      }
      const row = levelMap.get(key);
      row.mentions++;
      if (signal.analyst) row.analysts.add(signal.analyst);
      if (signal.bias) row.biases.add(signal.bias);
      if (signal.ts > row.lastTs) row.lastTs = signal.ts;
    }
  }

  const candidates = [...levelMap.values()]
    .filter(row => row.analysts.size >= 2)
    .sort((a, b) => b.analysts.size - a.analysts.size || b.mentions - a.mentions)
    .slice(0, 3);

  if (!candidates.length) {
    return [
      'Kat simulated automatic Level Magnet',
      'No active 48h level magnet qualified in this proof window.',
      'Rule: 2+ analysts independently marking the same 5-point bucket.',
    ].join('\n');
  }

  return [
    'Kat simulated automatic Level Magnet',
    ...candidates.map(row => {
      const bias = row.biases.has('BEARISH') && row.biases.has('BULLISH')
        ? 'CONTESTED'
        : row.biases.has('BEARISH') ? 'resistance' : 'support';
      return 'Level Magnet - ' + row.ticker + ' ' + row.level + ': ' +
        row.analysts.size + ' analysts, ' + row.mentions + ' mention(s), ' +
        'bias ' + bias + ', last marked ' + asEt(row.lastTs);
    }),
    'Source: captured analyst posts via Kat. Human-gated; no execution.',
  ].join('\n');
}

function buildHelpOutput() {
  return [
    'Kat simulated output: !kat',
    "Hey everyone. I'm Kat.",
    '',
    'I read analyst posts from monitored channels and surface when multiple analysts independently mark the same price level.',
    '',
    'How to use me:',
    '!kat levels SPX - top analyst-marked levels this week. Requires 2+ analysts or 3+ independent mentions.',
    '!kat bias - current directional bias across monitored analysts, last 18 hours.',
    '!kat heatmap SPX - most recent heatmap image for that ticker with timestamp and staleness warning.',
    '!kat - shows this list.',
    '',
    "What I don't do: predict, generate opinions, or make anything up.",
    'Level Magnet alerts post during market hours when 2+ analysts independently mark the same level within 48 hours.',
  ].join('\n');
}

function buildKatPlainProof(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const katDir = path.join(rootDir, 'data', 'kat');
  const raw = readJsonl(path.join(katDir, 'raw-feed.jsonl'));
  const processed = readJsonl(path.join(katDir, 'processed-signals.jsonl'));
  const vision = readJsonl(path.join(katDir, 'vision-signals.jsonl'));
  const config = readJson(path.join(katDir, 'monitored-users.json'), {});
  const latest = latestTimestamp([...raw, ...processed, ...vision]);
  const now = options.now || (latest ? new Date(latest.ts) : new Date());
  const ticker = options.ticker || 'SPX';
  const heatmapRequestsConfigured =
    (config.monitored_channel_ids || []).includes(HEATMAP_REQUESTS_CHANNEL_ID) &&
    (config.monitored_channels || []).includes(HEATMAP_REQUESTS_CHANNEL_NAME);
  const heatmapRequestsRows = raw.filter(row => row.channel_id === HEATMAP_REQUESTS_CHANNEL_ID || row.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME);

  const outputs = {
    help: buildHelpOutput(),
    levels: buildLevelsCommandOutput(processed, ticker, now),
    bias: buildBiasCommandOutput(processed, now),
    heatmap: buildHeatmapCommandOutput(raw, processed, ticker, now),
    magnet: buildMagnetPreview(processed, now, ticker),
  };

  const proofText = [
    'KATBOT PLAIN OUTPUT PROOF',
    'Generated: ' + new Date().toISOString(),
    'Simulated as-of latest captured Kat timestamp: ' + (latest ? latest.ts : 'none'),
    'Ticker: ' + ticker,
    'Raw rows: ' + raw.length,
    'Processed rows: ' + processed.length,
    'Vision rows: ' + vision.length,
    'heatmap-requests configured: ' + heatmapRequestsConfigured,
    'heatmap-requests historical rows currently present: ' + heatmapRequestsRows.length,
    '',
    outputs.help,
    '',
    outputs.levels,
    '',
    outputs.bias,
    '',
    outputs.heatmap,
    '',
    outputs.magnet,
    '',
    'Proof procedure:',
    '1. Read data/kat/raw-feed.jsonl, processed-signals.jsonl, and vision-signals.jsonl.',
    '2. Simulate the public Kat commands using only captured records and timestamps.',
    '3. Verify heatmap-requests channel id/name are present in monitored-users.json.',
    '4. Render this plain text to PNG for visual sanity. No HTML report is written.',
  ].join('\n');

  return {
    generated_at: new Date().toISOString(),
    as_of: latest ? latest.ts : null,
    ticker,
    counts: {
      raw: raw.length,
      processed: processed.length,
      vision: vision.length,
      heatmap_requests_rows: heatmapRequestsRows.length,
    },
    config: {
      heatmap_requests_channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
      heatmap_requests_channel_name: HEATMAP_REQUESTS_CHANNEL_NAME,
      heatmap_requests_configured: heatmapRequestsConfigured,
      monitored_channel_ids: config.monitored_channel_ids || [],
      monitored_channels: config.monitored_channels || [],
      monitored_users: (config.monitored_users || []).map(user => user.username),
      discord_responses_enabled: config.discord_responses_enabled === true,
      discord_posts_enabled: config.discord_posts_enabled === true,
    },
    outputs,
    proof_text: proofText,
  };
}

function writeKatPlainProof(proof, outDir) {
  const dir = outDir || path.join(__dirname, '..', 'artifacts', 'proof', 'katbot-plain');
  const files = {
    json: path.join(dir, 'katbot-plain-proof.json'),
    text: path.join(dir, 'katbot-simulated-output.txt'),
    procedure: path.join(dir, 'katbot-proof-procedure.md'),
  };
  writeJson(files.json, {
    generated_at: proof.generated_at,
    as_of: proof.as_of,
    ticker: proof.ticker,
    counts: proof.counts,
    config: proof.config,
    outputs: proof.outputs,
  });
  writeText(files.text, proof.proof_text);
  writeText(files.procedure, [
    '# Katbot Plain Proof Procedure',
    '',
    'This proof intentionally produces plain text, JSON, and PNG only. No HTML report is written.',
    '',
    '## Inputs',
    '- data/kat/raw-feed.jsonl',
    '- data/kat/processed-signals.jsonl',
    '- data/kat/vision-signals.jsonl',
    '- data/kat/monitored-users.json',
    '',
    '## Checks',
    '- Public commands simulated: !kat, !kat levels SPX, !kat bias, !kat heatmap SPX.',
    '- Level Magnet preview simulated from captured levels in the last 48 hours of the proof window.',
    '- heatmap-requests channel id 1482431257441996850 and name heatmap-requests are checked in config.',
    '- Discord output gates remain visible in Kat readiness tests; proof does not post to Discord.',
    '',
    '## Output',
    '- katbot-simulated-output.txt',
    '- katbot-plain-proof.json',
    '- katbot-sanity.png',
    '',
  ].join('\n'));
  return files;
}

module.exports = {
  HEATMAP_REQUESTS_CHANNEL_ID,
  HEATMAP_REQUESTS_CHANNEL_NAME,
  buildKatPlainProof,
  writeKatPlainProof,
  _internal: {
    normalizeTicker,
    tickerMatches,
    isImageAttachment,
    latestTimestamp,
    buildLevelsCommandOutput,
    buildBiasCommandOutput,
    buildHeatmapCommandOutput,
    buildMagnetPreview,
  },
};
