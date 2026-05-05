'use strict';

const fs = require('fs');
const path = require('path');

const HEATMAP_REQUESTS_CHANNEL_ID = '1482431257441996850';
const HEATMAP_REQUESTS_CHANNEL_NAME = 'heatmap-requests';
const SECONDARY_RESEARCH_CHANNEL_ID = '1491514754387411085';
const PUBLIC_INDEX_TICKERS = new Set(['SPX', 'SPY', 'ES', 'MES']);
const NON_EQUITY_TICKERS = new Set([
  'SPX', 'SPY', 'SPXW', 'ES', 'MES', 'QQQ', 'NQ', 'MNQ', 'NDX', 'VIX', 'DXY',
  'BTC', 'ETH', 'USD'
]);

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
  if (ticker === 'ESF' || ticker === 'ES' || ticker === 'MES') return ticker === 'MES' ? 'MES' : 'ES';
  if (ticker === 'SPXW' || ticker === 'SPX') return 'SPX';
  if (ticker === 'NQF' || ticker === 'NQ' || ticker === 'MNQ') return ticker === 'MNQ' ? 'MNQ' : 'NQ';
  if (ticker === 'NDX') return 'NDX';
  if (ticker === 'SPY') return 'SPY';
  if (ticker === 'QQQ') return 'QQQ';
  return ticker || null;
}

function publicTicker(value) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  if (PUBLIC_INDEX_TICKERS.has(ticker)) return 'SPX';
  if (/^[A-Z]{1,5}$/.test(ticker) && !NON_EQUITY_TICKERS.has(ticker)) return ticker;
  return null;
}

function tickerMatches(targetTicker, candidateTicker) {
  const target = publicTicker(targetTicker) || normalizeTicker(targetTicker);
  const candidate = normalizeTicker(candidateTicker);
  if (!target || !candidate) return false;
  if (target === candidate) return true;
  const aliasSets = [
    new Set(['SPX', 'SPY', 'ES', 'MES']),
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

function compactText(value, maxLen = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'image-only post';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '...' : text;
}

function messageLink(entry) {
  if (!entry || !entry.guild_id || !entry.channel_id || !entry.message_id) return null;
  return 'https://discord.com/channels/' + entry.guild_id + '/' + entry.channel_id + '/' + entry.message_id;
}

function signalTickerMatches(signal, ticker) {
  return tickerMatches(ticker, signal.ticker);
}

function buildLevelsCommandOutput(processed, raw, ticker, now) {
  const canonical = publicTicker(ticker);
  const evidence = findChartEvidence(raw, canonical || ticker, 3);
  if (!canonical) {
    return [
      'Kat simulated output: !kat levels ' + ticker,
      'Kat levels are currently scoped to SPX and chart-backed equity tickers only.',
    ].join('\n');
  }

  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const levelMap = new Map();

  for (const signal of processed) {
    if (!signal || !signal.ts || !signalTickerMatches(signal, canonical)) continue;
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
      'Kat simulated output: !kat levels ' + canonical,
      'No confirmed confluence levels for ' + canonical + ' in the last 7 days.',
      'Rule: 2+ analysts or 3+ independent mentions required. No guesses.',
      evidence.length ? 'Recent chart-backed source posts:' : null,
      ...formatChartEvidence(evidence),
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
    'Kat simulated output: !kat levels ' + canonical,
    canonical + ' levels - last 7 days',
    ...rows,
    'Source: captured analyst posts. Qualification rule: 2+ analysts or 3+ mentions.',
    evidence.length ? 'Recent chart-backed source posts:' : null,
    ...formatChartEvidence(evidence),
  ].join('\n');
}

function buildBiasCommandOutput(processed, raw, now, ticker = 'SPX') {
  const canonical = publicTicker(ticker) || 'SPX';
  const evidence = findChartEvidence(raw, canonical, 3);
  const cutoff = now.getTime() - 18 * 60 * 60 * 1000;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  const bullAnalysts = new Set();
  const bearAnalysts = new Set();

  for (const signal of processed) {
    if (!signal || !signal.ts) continue;
    const ms = new Date(signal.ts).getTime();
    if (!Number.isFinite(ms) || ms < cutoff || ms > now.getTime()) continue;
    if (!signalTickerMatches(signal, canonical)) continue;
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
  }

  const total = bullish + bearish + neutral;
  if (total < 3) {
    return [
      'Kat simulated output: !kat bias',
      'Not enough ' + canonical + ' signal data in the last 18 hours.',
      'Need at least 3 signals. Current: ' + total,
      evidence.length ? 'Recent chart-backed source posts:' : null,
      ...formatChartEvidence(evidence),
    ].join('\n');
  }

  const dominant = bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'MIXED';
  const directional = bullish + bearish;
  const ratio = directional ? Math.round((Math.max(bullish, bearish) / directional) * 100) : 50;
  return [
    'Kat simulated output: !kat bias',
    'Elevated Charts - ' + canonical + ' last 18h regime as of ' + asEt(now.toISOString()),
    'Collective bias: ' + dominant + ' (' + ratio + '% of directional signals)',
    'Bullish: ' + bullish + ' signals from ' + bullAnalysts.size + ' analyst(s)',
    'Bearish: ' + bearish + ' signals from ' + bearAnalysts.size + ' analyst(s)',
    'Neutral/context: ' + neutral,
    evidence.length ? 'Recent chart-backed source posts:' : null,
    ...formatChartEvidence(evidence),
    'Source: captured analyst posts. Not a prediction - synthesis only.',
  ].join('\n');
}

function entryTextMatchesTicker(entry, ticker) {
  const content = String(entry.content || '').toUpperCase();
  const normalized = publicTicker(ticker);
  if (!normalized) return false;
  if (normalized === 'SPX') {
    return /\b(SPX|SPY|ES_F|#ES_F|ESM|ES1|SPXW)\b|\$SPX|\$SPY/i.test(content);
  }
  if (new RegExp('(^|[^A-Z0-9])\\$?' + normalized + '([^A-Z0-9]|$)', 'i').test(content)) return true;
  if (normalized === 'QQQ' && (content.includes('NDX') || content.includes('NQ_F') || content.includes('#NQ_F'))) return true;
  return false;
}

function findChartEvidence(raw, ticker, limit = 3) {
  const canonical = publicTicker(ticker);
  if (!canonical) return [];
  const evidence = [];
  const seen = new Set();
  for (const entry of raw) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.filter(isImageAttachment) : [];
    if (!attachments.length) continue;
    if (!entryTextMatchesTicker(entry, canonical)) continue;
    if (seen.has(entry.message_id)) continue;
    seen.add(entry.message_id);
    evidence.push({ entry, attachments });
  }
  return evidence
    .sort((a, b) => new Date(b.entry.ts || 0) - new Date(a.entry.ts || 0))
    .slice(0, limit);
}

function formatChartEvidence(evidence) {
  if (!evidence.length) return ['No chart-backed analyst posts found.'];
  return evidence.map((item, index) => {
    const entry = item.entry;
    const link = messageLink(entry);
    const imageNames = item.attachments
      .map(att => att.filename || 'chart image')
      .slice(0, 3)
      .join(', ');
    return (index + 1) + '. ' +
      (entry.username || 'unknown') + ' - ' +
      asEt(entry.ts) + ' - ' +
      (entry.channel_name || 'unknown channel') +
      (link ? ' - ' + link : '') + '\n' +
      '   "' + compactText(entry.content) + '"\n' +
      '   image: attached in Discord payload' + (imageNames ? ' (' + imageNames + ')' : '');
  });
}

function chooseSampleEquityTicker(raw) {
  const regex = /\$([A-Z]{1,5})(?:\b|\s)/g;
  const matches = [];
  for (const entry of raw) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.filter(isImageAttachment) : [];
    if (!attachments.length) continue;
    let match;
    const content = entry.content || '';
    while ((match = regex.exec(content))) {
      const ticker = publicTicker(match[1]);
      if (ticker && ticker !== 'SPX') {
        matches.push({ ticker, ts: entry.ts });
        break;
      }
    }
  }
  matches.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  return matches[0] ? matches[0].ticker : 'UPS';
}

function buildEquityChartCommandOutput(raw, ticker, now) {
  const canonical = publicTicker(ticker);
  if (!canonical || canonical === 'SPX') {
    return [
      'Kat simulated output: !kat equity ' + ticker,
      'Kat equity lookup requires a normal equity ticker with an attached analyst chart.',
      'No guessing from flow-only or text-only posts.',
    ].join('\n');
  }
  const evidence = findChartEvidence(raw, canonical, 4);
  if (!evidence.length) {
    return [
      'Kat simulated output: !kat equity ' + canonical,
      'No chart-backed analyst posts found for ' + canonical + '.',
      'Kat will not infer equity context without attached chart evidence.',
    ].join('\n');
  }
  return [
    'Kat simulated output: !kat equity ' + canonical,
    canonical + ' chart-backed analyst posts as of ' + asEt(now.toISOString()),
    ...formatChartEvidence(evidence),
    'Source: captured analyst posts with image attachments. Not a prediction.',
  ].join('\n');
}

function buildHeatmapCommandOutput(raw, processed, ticker, now) {
  const processedImageMessages = new Set(
    processed
      .filter(signal => signal && signal.has_image && signal.message_id && signalTickerMatches(signal, ticker))
      .map(signal => String(signal.message_id).replace(/:vision:.+$/, ''))
  );

  const candidates = [];
  for (const entry of raw) {
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.filter(isImageAttachment) : [];
    if (!attachments.length) continue;
    const textMatch = entryTextMatchesTicker(entry, ticker);
    const processedMatch = processedImageMessages.has(entry.message_id);
    const heatmapish = /\b(heatmap|heat map|node|king|gatekeeper|gex|gamma)\b/i.test(entry.content || '') ||
      entry.channel_id === HEATMAP_REQUESTS_CHANNEL_ID ||
      entry.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME;
    const heatmapChannel = entry.channel_id === HEATMAP_REQUESTS_CHANNEL_ID ||
      entry.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME;
    if (!textMatch && !processedMatch && !heatmapChannel) continue;
    candidates.push({ entry, attachment: attachments[0], textMatch, processedMatch, heatmapish });
  }
  candidates.sort((a, b) => {
    if (a.heatmapish !== b.heatmapish) return a.heatmapish ? -1 : 1;
    return new Date(b.entry.ts || 0) - new Date(a.entry.ts || 0);
  });
  const best = candidates[0] || null;

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
    messageLink(best.entry) ? 'Source message: ' + messageLink(best.entry) : 'Source message: unavailable in captured row',
    'Image: attached in Discord payload (' + (best.attachment.filename || 'image') + ')',
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
    'I read analyst posts from monitored channels and surface SPX confluence plus chart-backed equity posts from analysts.',
    '',
    'How to use me:',
    '!kat levels SPX - top analyst-marked levels this week. Requires 2+ analysts or 3+ independent mentions.',
    '!kat bias - SPX directional bias across monitored analysts, last 18 hours.',
    '!kat heatmap SPX - most recent heatmap image for that ticker with timestamp and staleness warning.',
    '!kat recent SPX - latest chart-backed analyst posts for SPX/ES/SPY.',
    '!kat equity UPS - latest chart-backed analyst posts for that equity ticker, with image evidence.',
    '!kat - shows this list.',
    '',
    "What I don't do: predict, generate opinions, make anything up, or infer equities from text-only posts.",
    'Level Magnet alerts post during market hours when 2+ analysts independently mark the same SPX level within 48 hours. Equity alerts stay chart-backed.',
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
  const sampleEquityTicker = options.equityTicker || chooseSampleEquityTicker(raw);
  const heatmapRequestsConfigured =
    (config.monitored_channel_ids || []).includes(HEATMAP_REQUESTS_CHANNEL_ID) &&
    (config.monitored_channels || []).includes(HEATMAP_REQUESTS_CHANNEL_NAME);
  const heatmapRequestsRows = raw.filter(row => row.channel_id === HEATMAP_REQUESTS_CHANNEL_ID || row.channel_name === HEATMAP_REQUESTS_CHANNEL_NAME);
  const secondaryResearchConfigured = (config.monitored_channel_ids || []).includes(SECONDARY_RESEARCH_CHANNEL_ID);
  const secondaryResearchRows = raw.filter(row => row.channel_id === SECONDARY_RESEARCH_CHANNEL_ID);

  const outputs = {
    help: buildHelpOutput(),
    levels: buildLevelsCommandOutput(processed, raw, ticker, now),
    bias: buildBiasCommandOutput(processed, raw, now, ticker),
    heatmap: buildHeatmapCommandOutput(raw, processed, ticker, now),
    equity_chart: buildEquityChartCommandOutput(raw, sampleEquityTicker, now),
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
    'secondary channel configured: ' + secondaryResearchConfigured + ' (' + SECONDARY_RESEARCH_CHANNEL_ID + ')',
    'secondary channel historical rows currently present: ' + secondaryResearchRows.length,
    '',
    outputs.help,
    '',
    outputs.levels,
    '',
    outputs.bias,
    '',
    outputs.heatmap,
    '',
    outputs.equity_chart,
    '',
    outputs.magnet,
    '',
    'Proof procedure:',
    '1. Read data/kat/raw-feed.jsonl, processed-signals.jsonl, and vision-signals.jsonl.',
    '2. Simulate the public Kat commands using only captured records and timestamps.',
    '3. Verify heatmap-requests channel id/name are present in monitored-users.json.',
    '4. Verify the added secondary channel id is present in monitored-users.json.',
    '5. Render this plain text to PNG for visual sanity. No HTML report is written.',
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
      secondary_research_rows: secondaryResearchRows.length,
    },
    config: {
      heatmap_requests_channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
      heatmap_requests_channel_name: HEATMAP_REQUESTS_CHANNEL_NAME,
      heatmap_requests_configured: heatmapRequestsConfigured,
      secondary_research_channel_id: SECONDARY_RESEARCH_CHANNEL_ID,
      secondary_research_configured: secondaryResearchConfigured,
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
    '- Public commands simulated: !kat, !kat levels SPX, !kat bias, !kat heatmap SPX, and chart-backed !kat equity <ticker>.',
    '- Level Magnet preview simulated from captured levels in the last 48 hours of the proof window.',
    '- heatmap-requests channel id 1482431257441996850 and name heatmap-requests are checked in config.',
    '- Secondary requested channel id 1491514754387411085 is checked in config.',
    '- Public proof is scoped to SPX and equity tickers with image attachments from analyst posts.',
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
  SECONDARY_RESEARCH_CHANNEL_ID,
  buildKatPlainProof,
  writeKatPlainProof,
  _internal: {
    normalizeTicker,
    publicTicker,
    tickerMatches,
    isImageAttachment,
    latestTimestamp,
    findChartEvidence,
    buildEquityChartCommandOutput,
    buildLevelsCommandOutput,
    buildBiasCommandOutput,
    buildHeatmapCommandOutput,
    buildMagnetPreview,
  },
};
