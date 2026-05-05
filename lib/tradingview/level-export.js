'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { parseManciniTweet } = require('../parse-mancini');
const { heatmapFreshness } = require('../trading-state/heatmap-gex-lifecycle');
const {
  normalizeSourceFamily,
  normalizeTransport,
  normalizeRole,
} = require('../trading-state/source-normalization');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'tradingview');
const DEFAULT_BASE_PINE = path.join(ROOT, 'tradingview', 'luke-level-reclaim-watch.pine');
const DEFAULT_REALISTIC_PINE = path.join(ROOT, 'tradingview', 'luke-level-reclaim-watch-realistic-accounting.pine');
const DEFAULT_PRODUCTION_TEST_PINE = path.join(ROOT, 'tradingview', 'luke-watch-production-test.pine');
const DEFAULT_SIMULATION_STRATEGY_PINE = path.join(ROOT, 'tradingview', 'luke-watch-production-test-simulation.strategy.pine');
const DEFAULT_HARDMODE_PINE = path.join(ROOT, 'tradingview', 'luke-level-reclaim-watch-hardmode.strategy.pine');

const SATY_FIELDS = [
  ['atr_plus_1', 'ATR+1'],
  ['ext_plus_4', 'ext+4'],
  ['ext_plus_3', 'ext+3'],
  ['ext_plus_2', 'ext+2'],
  ['ext_plus_1', 'ext+1'],
  ['call_trigger', 'CALL_TRIGGER'],
  ['prev_close', 'PREV_CLOSE'],
  ['put_trigger', 'PUT_TRIGGER'],
  ['ext_minus_1', 'ext-1'],
  ['ext_minus_2', 'ext-2'],
  ['ext_minus_3', 'ext-3'],
  ['ext_minus_4', 'ext-4'],
  ['atr_minus_1', 'ATR-1'],
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MANCINI_KEYWORD_RE = /\b(#ES_F|ES_F|mancini|failed breakdown|reclaim|support|resistance|target|bonus|chop|trigger|sweep|trap|fails?|sell|below|above|backtest|pivot|low)\b/i;
const STOP_LINE_RE = /^(Adam Mancini|Quote|Who to follow|Skip to|User Avatar|Feed options|Open chat|Create post|Upvote|Downvote|Reply|reply|Share|Show more)$/i;

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateToEtIso(dateStr, time = '12:00') {
  return `${dateStr}T${time}:00-04:00`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function monthDayPrefix(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function parseUsDate(month, day, year) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseManciniDateRange(text) {
  const match = String(text || '').match(/(\d{1,2})-(\d{1,2})-(20\d{2})\s*-\s*(\d{1,2})-(\d{1,2})-(20\d{2})/);
  if (!match) return null;
  return {
    start: parseUsDate(match[1], match[2], match[3]),
    end: parseUsDate(match[4], match[5], match[6]),
  };
}

function listFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, predicate, results);
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function discoverManciniCurrentLog({ rootDir = ROOT } = {}) {
  const dirs = [
    path.join(rootDir, 'data', 'research', 'mancini'),
    path.join(rootDir, 'fixtures', 'mancini'),
  ];
  const candidates = dirs.flatMap(dir => listFiles(
    dir,
    file => /\.(txt|md)$/i.test(file) && /mancini|mankini|logs?/i.test(path.basename(file))
  ));

  let best = null;
  for (const filePath of candidates) {
    let raw = '';
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const firstLines = raw.split(/\r?\n/).slice(0, 8).join('\n');
    const headerRange = parseManciniDateRange(firstLines);
    const filenameRange = parseManciniDateRange(path.basename(filePath));
    const stat = fs.statSync(filePath);
    const latestDate = headerRange?.end || filenameRange?.end || formatDate(stat.mtime);
    const score = `${latestDate}|${String(stat.mtimeMs).padStart(15, '0')}`;
    const candidate = {
      path: filePath,
      header_range: headerRange,
      filename_range: filenameRange,
      latest_date: latestDate,
      misnamed: Boolean(headerRange?.end && filenameRange?.end && headerRange.end !== filenameRange.end),
      score,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function explicitDateInText(text) {
  return /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/i.test(text)
    || /\b\d{1,2}\/\d{1,2}\/20\d{2}\b/.test(text)
    || /\b20\d{2}-\d{2}-\d{2}\b/.test(text);
}

function inferRelativeDate(token, latestDate) {
  const text = String(token || '').toLowerCase();
  if (!latestDate) return null;
  const hour = text.match(/\b\d+\s*h\b|\b\d+\s*hours?\s+ago\b/);
  if (hour) return latestDate;
  const day = text.match(/\b(\d+)\s*d\b|\b(\d+)\s*days?\s+ago\b/);
  if (day) return addDays(latestDate, -Number(day[1] || day[2]));
  if (/\byesterday\b/.test(text)) return addDays(latestDate, -1);
  const month = text.match(/\b(\d+)\s*mo\b|\b(\d+)\s*months?\s+ago\b/);
  if (month) return addDays(latestDate, -30 * Number(month[1] || month[2]));
  return latestDate;
}

function cleanBodyLines(lines) {
  return lines
    .map(line => line.trim())
    .filter(line => line && !/^(x\.com\/|https?:\/\/)/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractManciniLogPosts(rawText, { latestDate = null } = {}) {
  const lines = String(rawText || '').split(/\r?\n/);
  const posts = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!/^@AdamMancini4\b/i.test(lines[i].trim())) continue;
    let j = i + 1;
    const meta = [];
    while (j < lines.length) {
      const trimmed = lines[j].trim();
      if (!trimmed || trimmed === 'Â·' || trimmed === '·' || /^Replying to$/i.test(trimmed) || /^@/.test(trimmed) || /^\d+\s*h$/i.test(trimmed) || /^\d+\s*d$/i.test(trimmed)) {
        if (trimmed) meta.push(trimmed);
        j += 1;
        continue;
      }
      break;
    }
    const body = [];
    while (j < lines.length) {
      const trimmed = lines[j].trim();
      if (STOP_LINE_RE.test(trimmed)) break;
      if (/^@AdamMancini4\b/i.test(trimmed)) break;
      if (/^r\/ThePiratesDen\b/i.test(trimmed)) break;
      body.push(lines[j]);
      j += 1;
    }
    const text = cleanBodyLines(body);
    if (MANCINI_KEYWORD_RE.test(text)) {
      posts.push({
        text,
        transport: 'twitter_x',
        relative_date: meta.find(item => /\d+\s*[hd]|ago/i.test(item)) || null,
        date_hint: inferRelativeDate(meta.join(' '), latestDate),
      });
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!/Adam_Mankini\s+commented/i.test(line)) continue;
    const body = [];
    let j = i + 1;
    while (j < lines.length) {
      const trimmed = lines[j].trim();
      if (/^Upvote$/i.test(trimmed)) break;
      if (/^r\/ThePiratesDen\b/i.test(trimmed) && body.length) break;
      body.push(lines[j]);
      j += 1;
    }
    const text = cleanBodyLines(body);
    if (MANCINI_KEYWORD_RE.test(text)) {
      posts.push({
        text,
        transport: 'reddit',
        relative_date: line.match(/commented\s+(.+?ago)/i)?.[1] || null,
        date_hint: inferRelativeDate(line, latestDate),
      });
    }
  }

  const seen = new Set();
  return posts.filter(post => {
    const key = sha1(`${post.transport}|${post.text}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function expandSuffix(basePrice, suffix) {
  const base = Math.floor(Number(basePrice) / 100) * 100;
  let candidate = base + Number(suffix);
  if (candidate < Number(basePrice) - 50) candidate += 100;
  if (candidate > Number(basePrice) + 80) candidate -= 100;
  return candidate;
}

function rangeEndToFull(startPrice, suffix) {
  const width = String(suffix).length;
  const divisor = 10 ** width;
  let candidate = Math.floor(startPrice / divisor) * divisor + Number(suffix);
  if (candidate < startPrice) candidate += divisor;
  return candidate;
}

function contextRole(text, index) {
  const ctx = text.slice(Math.max(0, index - 80), index + 120).toLowerCase();
  if (/target|bonus|above|next|pop|resistance/.test(ctx)) return 'target_or_resistance';
  if (/support|below|low|sweep|trap|reclaim|failed breakdown|backtest|pivot/.test(ctx)) return 'support_or_trigger';
  if (/fail|sell/.test(ctx)) return 'invalidation';
  return 'level';
}

function extractManciniFallbackLevels(text) {
  const output = [];
  const seen = new Set();
  const push = (price, index, role = null) => {
    const value = Number(price);
    if (!Number.isFinite(value) || value < 3000 || value > 20000) return;
    const key = value.toFixed(2);
    if (seen.has(key)) return;
    seen.add(key);
    output.push({
      price: value,
      role: role || contextRole(text, index),
      label: `Mancini ${value}`,
      source_snippet: text.slice(Math.max(0, index - 80), Math.min(text.length, index + 120)).replace(/\s+/g, ' ').trim(),
    });
  };

  const planRe = /\b(\d{4,5}(?:\.\d+)?)\b[^.\n]{0,45}\b(?:sees?|targets?|above)\s+([0-9,\s+]+)/gi;
  let plan;
  while ((plan = planRe.exec(text)) !== null) {
    const base = Number(plan[1]);
    push(base, plan.index, 'support_or_trigger');
    for (const suffix of plan[2].match(/\b\d{2}\b/g) || []) {
      push(expandSuffix(base, suffix), plan.index, 'target_or_resistance');
    }
  }

  const rangeRe = /\b(\d{4,5})-(\d{2})(?!\d)\b/g;
  let range;
  while ((range = rangeRe.exec(text)) !== null) {
    const start = Number(range[1]);
    push(start, range.index);
    push(rangeEndToFull(start, range[2]), range.index);
  }

  const priceRe = /\b(\d{4,5}(?:\.\d+)?)\b/g;
  let match;
  while ((match = priceRe.exec(text)) !== null) {
    push(Number(match[1]), match.index);
  }
  return output;
}

function roleFromManciniLevel(level) {
  if (level.intent === 'failed_breakdown' || level.intent === 'long_trigger' || level.trigger_type === 'reclaim') return 'support_or_trigger';
  if (/target/.test(String(level.intent || '')) || level.direction === 'resistance') return 'target_or_resistance';
  if (level.direction === 'support' || level.intent === 'stop') return 'support_or_trigger';
  if (level.intent === 'chop_boundary') return 'chop_or_veto';
  return 'level';
}

function confidenceFromManciniLevel(level) {
  if (level.significance === 'key') return 0.85;
  if (level.intent || level.direction) return 0.7;
  return 0.55;
}

function normalizeManciniRecord({
  level,
  parsed,
  post,
  sourceFile,
  latestDate,
  activeCutoff,
  fallback = false,
}) {
  const date = parsed?.date || post.date_hint || latestDate;
  const timestamp = parsed?.tweet_timestamp || dateToEtIso(date);
  const role = normalizeRole(level.role || roleFromManciniLevel(level));
  return {
    price: Number(level.price),
    instrument: parsed?.instrument || 'ES',
    source_family: 'mancini',
    source_transport: post.transport || 'unknown',
    role,
    label: level.label || `Mancini ${role}`,
    freshness: {
      status: date >= activeCutoff ? 'current' : 'historical',
      date,
    },
    timestamp_et: timestamp,
    active: date >= activeCutoff && role !== 'chop_or_veto',
    confidence: fallback ? 0.55 : confidenceFromManciniLevel(level),
    notes: level.source_snippet || null,
    source_file: sourceFile,
    source_hash: sha1(`${post.transport}|${post.text}`),
  };
}

function dedupeNormalizedLevels(levels) {
  const byKey = new Map();
  for (const level of levels) {
    if (!Number.isFinite(Number(level.price))) continue;
    const key = `${level.source_family}|${level.instrument}|${Number(level.price).toFixed(2)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, level);
      continue;
    }
    const existingScore = `${existing.active ? 1 : 0}|${existing.timestamp_et || ''}|${existing.confidence || 0}`;
    const nextScore = `${level.active ? 1 : 0}|${level.timestamp_et || ''}|${level.confidence || 0}`;
    if (nextScore >= existingScore) {
      byKey.set(key, {
        ...existing,
        ...level,
        notes: [existing.notes, level.notes].filter(Boolean).find(Boolean) || null,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.price - b.price || String(a.source_family).localeCompare(String(b.source_family)));
}

function extractManciniLevelsFromLog({ filePath, latestDate, now = new Date(), lookbackDays = 3 } = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const effectiveLatestDate = latestDate || parseManciniDateRange(raw.split(/\r?\n/).slice(0, 4).join('\n'))?.end || formatDate(now);
  const activeCutoff = addDays(effectiveLatestDate, -lookbackDays);
  const posts = extractManciniLogPosts(raw, { latestDate: effectiveLatestDate });
  const normalized = [];
  const parseErrors = [];

  for (const post of posts) {
    const parseText = explicitDateInText(post.text) ? post.text : `${monthDayPrefix(post.date_hint || effectiveLatestDate)}\n${post.text}`;
    let parsed;
    try {
      parsed = parseManciniTweet(parseText, {
        tweetTimestamp: post.date_hint ? dateToEtIso(post.date_hint) : null,
        instrument: 'ES',
      });
    } catch (err) {
      parseErrors.push(err.message);
      parsed = { levels: [], date: post.date_hint || effectiveLatestDate, instrument: 'ES' };
    }

    const parsedPrices = new Set((parsed.levels || []).map(level => Number(level.price).toFixed(2)));
    for (const level of parsed.levels || []) {
      normalized.push(normalizeManciniRecord({
        level,
        parsed,
        post,
        sourceFile: filePath,
        latestDate: effectiveLatestDate,
        activeCutoff,
      }));
    }

    for (const fallback of extractManciniFallbackLevels(post.text)) {
      if (parsedPrices.has(Number(fallback.price).toFixed(2))) continue;
      normalized.push(normalizeManciniRecord({
        level: fallback,
        parsed,
        post,
        sourceFile: filePath,
        latestDate: effectiveLatestDate,
        activeCutoff,
        fallback: true,
      }));
    }
  }

  return {
    source_file: filePath,
    latest_date: effectiveLatestDate,
    active_cutoff: activeCutoff,
    posts_scanned: posts.length,
    levels: dedupeNormalizedLevels(normalized),
    parse_errors: [...new Set(parseErrors)],
  };
}

function normalizeSatyLevels({ rootDir = ROOT, now = new Date() } = {}) {
  const filePath = path.join(rootDir, 'data', 'saty-levels.json');
  const saty = readJson(filePath, null);
  if (!saty) return [];
  const ageMinutes = Math.max(0, Math.round((now.getTime() - Date.parse(saty.updated || now)) / 60000));
  return SATY_FIELDS
    .filter(([field]) => Number.isFinite(Number(saty[field])))
    .map(([field, label]) => ({
      price: Number(saty[field]),
      instrument: String(saty.instrument || 'SPX').toUpperCase(),
      source_family: 'saty',
      source_transport: 'manual',
      role: field.includes('trigger') ? 'support_or_trigger' : 'atr_level',
      label: `Saty ${label}`,
      freshness: {
        status: ageMinutes <= 480 ? 'current' : 'stale',
        age_minutes: ageMinutes,
      },
      timestamp_et: saty.updated || null,
      active: ageMinutes <= 480,
      confidence: field.includes('trigger') || field.includes('atr_') ? 0.8 : 0.65,
      notes: saty.source_note || saty.source || null,
    }));
}

function normalizeDubzLevels({ rootDir = ROOT, now = new Date() } = {}) {
  const filePath = path.join(rootDir, 'data', 'dubz-levels.json');
  const state = readJson(filePath, null);
  const age = state?.last_updated ? Math.max(0, Math.round((now.getTime() - Date.parse(state.last_updated)) / 60000)) : null;
  const out = [];
  for (const [instrument, bucket] of Object.entries(state?.instruments || {})) {
    for (const level of bucket.levels || []) {
      if (!Number.isFinite(Number(level.price))) continue;
      const sourceFamily = normalizeSourceFamily('dubz', level);
      out.push({
        price: Number(level.price),
        instrument,
        source_family: sourceFamily,
        source_transport: normalizeTransport('dubz', level),
        role: normalizeRole(level.direction || level.intent || 'level'),
        label: `Dubz ${level.direction || level.intent || 'level'}`,
        freshness: {
          status: state.date ? 'structural_carry_forward' : 'unknown',
          age_minutes: age,
        },
        timestamp_et: state.last_updated || null,
        active: true,
        confidence: level.significance === 'key' ? 0.75 : 0.6,
        notes: level.source_snippet || null,
      });
    }
  }
  return dedupeNormalizedLevels(out);
}

function pushHeatmapLevel(out, event, price, role, instrument, now, policy) {
  if (!Number.isFinite(Number(price))) return;
  const ts = event.date || event.ts || event.timestamp_et || event.available_at_et || null;
  const freshness = heatmapFreshness(ts, now.toISOString(), policy);
  const transport = normalizeTransport(event.source || event.channel || 'bobby', event);
  out.push({
    price: Number(price),
    instrument: instrument || 'SPX',
    source_family: 'heatmap_gex',
    source_transport: transport === 'unknown' ? 'bobby' : transport,
    role: normalizeRole(role),
    label: `heatmap_gex ${role}`,
    freshness,
    timestamp_et: ts,
    active: freshness.active === true,
    confidence: freshness.status === 'fresh' ? 0.75 : freshness.status === 'aging' ? 0.5 : 0.25,
    notes: event.notes || event.bias_statement || event.raw || null,
    source_hash: event.source_id || sha1(JSON.stringify({
      source: event.source,
      date: ts,
      price,
      role,
      instrument,
    })),
  });
}

function normalizeHeatmapGexLevels({ rootDir = ROOT, now = new Date(), policy = {} } = {}) {
  const events = readJsonl(path.join(rootDir, 'state', 'events', 'bobby-context.jsonl'));
  const out = [];
  for (const event of events) {
    if (Array.isArray(event.panels) && event.panels.length) {
      for (const panel of event.panels) {
        for (const price of panel.king_nodes || []) pushHeatmapLevel(out, event, price, 'king_node', panel.instrument || panel.ticker || 'SPX', now, policy);
        for (const price of panel.support || []) pushHeatmapLevel(out, event, price, 'support', panel.instrument || panel.ticker || 'SPX', now, policy);
        for (const price of panel.resistance || []) pushHeatmapLevel(out, event, price, 'resistance', panel.instrument || panel.ticker || 'SPX', now, policy);
      }
      continue;
    }
    for (const price of event.king_nodes || []) pushHeatmapLevel(out, event, price, 'king_node', 'SPX', now, policy);
    for (const price of event.support || []) pushHeatmapLevel(out, event, price, 'support', 'SPX', now, policy);
    for (const price of event.resistance || []) pushHeatmapLevel(out, event, price, 'resistance', 'SPX', now, policy);
  }
  return dedupeNormalizedLevels(out);
}

function capTolerance(tolerance, maxTolerance = 3) {
  const value = Number.isFinite(Number(tolerance)) ? Number(tolerance) : 1.25;
  return Math.max(0, Math.min(value, maxTolerance));
}

function roundToTick(price, tick = 0.25) {
  return Math.round(Number(price) / tick) * tick;
}

function clusterLevelsForPineExport(levels, { tolerance = 1.25, maxTolerance = 3 } = {}) {
  const tol = capTolerance(tolerance, maxTolerance);
  const sorted = (levels || [])
    .filter(level => level && level.active !== false && Number.isFinite(Number(level.price)))
    .sort((a, b) => Number(a.price) - Number(b.price));
  const clusters = [];

  for (const level of sorted) {
    const price = Number(level.price);
    const last = clusters[clusters.length - 1];
    const canMerge = last
      && Math.abs(price - last.anchor) <= tol
      && Math.max(last.max, price) - Math.min(last.min, price) <= tol;
    if (!canMerge) {
      clusters.push({
        min: price,
        max: price,
        anchor: price,
        levels: [level],
      });
      continue;
    }
    last.levels.push(level);
    last.min = Math.min(last.min, price);
    last.max = Math.max(last.max, price);
    const executable = last.levels.filter(item => item.instrument === 'ES');
    if (executable.length) {
      const avg = executable.reduce((sum, item) => sum + Number(item.price), 0) / executable.length;
      last.anchor = roundToTick(avg);
    } else {
      last.anchor = roundToTick(last.levels.reduce((sum, item) => sum + Number(item.price), 0) / last.levels.length);
    }
  }

  return clusters.map((cluster, index) => {
    const sourceFamilies = [...new Set(cluster.levels.map(level => level.source_family))].sort();
    const transports = [...new Set(cluster.levels.map(level => level.source_transport))].sort();
    return {
      id: `tv-cluster-${index + 1}`,
      price: cluster.anchor,
      min: cluster.min,
      max: cluster.max,
      strength: sourceFamilies.length,
      source_families: sourceFamilies,
      source_transports: transports,
      labels: cluster.levels.map(level => `${level.source_family}:${level.label || level.role}`),
      levels: cluster.levels,
    };
  });
}

function uniqueSortedPrices(levels, limit = 120) {
  const seen = new Set();
  const values = [];
  for (const level of levels || []) {
    if (level.active === false) continue;
    const price = Number(level.price);
    if (!Number.isFinite(price)) continue;
    const key = price.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(price);
  }
  return values
    .sort((a, b) => a - b)
    .slice(0, limit)
    .map(price => Number.isInteger(price) ? String(price) : String(Number(price.toFixed(2))));
}

function buildPineInputText({ mancini = [], dubz = [], heatmap = [], heatmapSnapshotTime = '' } = {}) {
  const manciniList = uniqueSortedPrices(mancini).join(',');
  const dubzList = uniqueSortedPrices(dubz).join(',');
  const heatmapList = uniqueSortedPrices(heatmap.filter(level => level.freshness?.status !== 'stale')).join(',');
  return [
    'Luke TradingView level inputs',
    '',
    'Mancini levels:',
    manciniList,
    '',
    'Dubz levels:',
    dubzList,
    '',
    'Heatmap/GEX levels:',
    heatmapList,
    '',
    'Heatmap/GEX snapshot time:',
    heatmapSnapshotTime || 'none',
    '',
    'Warning: paste only into the intended chart/instrument. No SPX-to-ES fixed basis conversion is applied.',
  ].join('\n');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function levelsToCsv(levels) {
  const headers = ['price', 'instrument', 'source_family', 'source_transport', 'role', 'label', 'freshness', 'timestamp_et', 'active', 'confidence', 'notes'];
  return [
    headers.join(','),
    ...levels.map(level => headers.map(header => csvEscape(level[header])).join(',')),
  ].join('\n');
}

function pineString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderGeneratedPine(baseSource, pineInputs) {
  return baseSource
    .replace('input.string("", "Mancini levels"', `input.string("${pineString(pineInputs.mancini)}", "Mancini levels"`)
    .replace('input.string("", "Dubz levels"', `input.string("${pineString(pineInputs.dubz)}", "Dubz levels"`)
    .replace('input.string("", "Heatmap/GEX levels"', `input.string("${pineString(pineInputs.heatmap)}", "Heatmap/GEX levels"`)
    .replace('input.string("", "Heatmap/GEX snapshot time"', `input.string("${pineString(pineInputs.heatmapSnapshotTime)}", "Heatmap/GEX snapshot time"`);
}

function buildTradingViewLevelExport({
  rootDir = ROOT,
  now = new Date(),
  clusterTolerance = 1.25,
  heatmapPolicy = { freshMinutes: 60, agingMinutes: 120 },
} = {}) {
  const manciniLog = discoverManciniCurrentLog({ rootDir });
  const manciniExport = manciniLog
    ? extractManciniLevelsFromLog({ filePath: manciniLog.path, latestDate: manciniLog.latest_date, now })
    : { levels: [], posts_scanned: 0, parse_errors: [] };
  const saty = normalizeSatyLevels({ rootDir, now });
  const dubz = normalizeDubzLevels({ rootDir, now });
  const heatmap = normalizeHeatmapGexLevels({ rootDir, now, policy: heatmapPolicy });
  const levels = dedupeNormalizedLevels([...saty, ...manciniExport.levels, ...dubz, ...heatmap]);
  const heatmapActive = heatmap.filter(level => level.active && level.freshness?.status !== 'stale');
  const latestHeatmapTs = heatmapActive
    .map(level => level.timestamp_et)
    .filter(Boolean)
    .sort()
    .pop() || '';
  const pineInputs = {
    mancini: uniqueSortedPrices(manciniExport.levels.filter(level => level.active)).join(','),
    dubz: uniqueSortedPrices(dubz.filter(level => level.active)).join(','),
    heatmap: uniqueSortedPrices(heatmapActive).join(','),
    heatmapSnapshotTime: latestHeatmapTs,
  };
  const clusters = clusterLevelsForPineExport(levels, { tolerance: clusterTolerance });

  return {
    generated_at: now.toISOString(),
    normalized_shape: {
      price: 'number',
      instrument: 'string',
      source_family: 'saty|mancini|dubz_structural|dubz_callout|heatmap_gex',
      source_transport: 'manual|bobby|katbot|jefe|mathemeatloaf|discord|reddit|twitter_x|unknown',
      role: 'string',
      label: 'string',
      freshness: 'object',
      timestamp_et: 'string|null',
      active: 'boolean',
      confidence: 'number',
      notes: 'string|null',
    },
    source_files: {
      mancini_current_log: manciniLog?.path || null,
      mancini_misnamed: manciniLog?.misnamed === true,
      saty: path.join(rootDir, 'data', 'saty-levels.json'),
      dubz: path.join(rootDir, 'data', 'dubz-levels.json'),
      heatmap_gex: path.join(rootDir, 'state', 'events', 'bobby-context.jsonl'),
    },
    source_summary: {
      saty: saty.length,
      mancini: manciniExport.levels.filter(level => level.active).length,
      mancini_full_log_levels: manciniExport.levels.length,
      mancini_posts_scanned: manciniExport.posts_scanned,
      dubz: dubz.length,
      heatmap_gex: heatmapActive.length,
      heatmap_gex_total_seen: heatmap.length,
      clusters: clusters.length,
    },
    pine_inputs: pineInputs,
    levels,
    clusters,
    issues: [
      ...(manciniLog?.misnamed ? [`Mancini current log is misnamed: ${path.basename(manciniLog.path)} header ends ${manciniLog.header_range?.end}`] : []),
      ...(manciniExport.parse_errors || []),
      ...(clusterTolerance > 3 ? ['cluster tolerance requested above 3.0; capped for export'] : []),
    ],
  };
}

function writeTradingViewArtifacts({
  exportData,
  rootDir = ROOT,
  artifactDir = DEFAULT_ARTIFACT_DIR,
  basePinePath = DEFAULT_BASE_PINE,
  realisticPinePath = DEFAULT_REALISTIC_PINE,
  productionTestPinePath = DEFAULT_PRODUCTION_TEST_PINE,
  simulationStrategyPinePath = DEFAULT_SIMULATION_STRATEGY_PINE,
  hardmodePinePath = DEFAULT_HARDMODE_PINE,
} = {}) {
  fs.mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, 'luke-levels-current.json');
  const csvPath = path.join(artifactDir, 'luke-levels-current.csv');
  const inputPath = path.join(artifactDir, 'luke-levels-pine-input.txt');
  const generatedPinePath = path.join(artifactDir, 'luke-level-reclaim-watch.generated.pine');
  const generatedRealisticPath = path.join(artifactDir, 'luke-level-reclaim-watch-realistic-accounting.generated.pine');
  const generatedProductionTestPath = path.join(artifactDir, 'luke-watch-production-test.generated.pine');
  const generatedSimulationStrategyPath = path.join(artifactDir, 'luke-watch-production-test-simulation.generated.strategy.pine');
  const generatedHardmodePath = path.join(artifactDir, 'luke-level-reclaim-watch-hardmode.generated.strategy.pine');
  const summaryPath = path.join(artifactDir, 'export-summary.json');
  const pineFilesSummaryPath = path.join(artifactDir, 'pine-files-summary.json');
  const slippageModesSummaryPath = path.join(artifactDir, 'slippage-modes-summary.json');
  const hardmodeAuditPath = path.join(artifactDir, 'pine-hardmode-audit.json');

  const pineInputText = buildPineInputText({
    mancini: exportData.levels.filter(level => level.source_family === 'mancini' && level.active),
    dubz: exportData.levels.filter(level => level.source_family.startsWith('dubz') && level.active),
    heatmap: exportData.levels.filter(level => level.source_family === 'heatmap_gex' && level.active),
    heatmapSnapshotTime: exportData.pine_inputs.heatmapSnapshotTime,
  });

  fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');
  fs.writeFileSync(csvPath, levelsToCsv(exportData.levels), 'utf8');
  fs.writeFileSync(inputPath, pineInputText, 'utf8');

  if (fs.existsSync(basePinePath)) {
    const base = fs.readFileSync(basePinePath, 'utf8');
    fs.writeFileSync(generatedPinePath, renderGeneratedPine(base, exportData.pine_inputs), 'utf8');
  }
  if (fs.existsSync(realisticPinePath)) {
    const realistic = fs.readFileSync(realisticPinePath, 'utf8');
    fs.writeFileSync(generatedRealisticPath, renderGeneratedPine(realistic, exportData.pine_inputs), 'utf8');
  }
  if (fs.existsSync(productionTestPinePath)) {
    const productionTest = fs.readFileSync(productionTestPinePath, 'utf8');
    fs.writeFileSync(generatedProductionTestPath, renderGeneratedPine(productionTest, exportData.pine_inputs), 'utf8');
  }
  if (fs.existsSync(simulationStrategyPinePath)) {
    const simulationStrategy = fs.readFileSync(simulationStrategyPinePath, 'utf8');
    fs.writeFileSync(generatedSimulationStrategyPath, renderGeneratedPine(simulationStrategy, exportData.pine_inputs), 'utf8');
  }
  if (fs.existsSync(hardmodePinePath)) {
    const hardmode = fs.readFileSync(hardmodePinePath, 'utf8');
    fs.writeFileSync(generatedHardmodePath, renderGeneratedPine(hardmode, exportData.pine_inputs), 'utf8');
  }

  const pineFilesSummary = {
    generated_at: exportData.generated_at,
    files: [
      {
        path: path.relative(rootDir, basePinePath),
        classification: 'Luke visual indicator - legacy accounting',
        declaration: 'indicator',
        generated_artifact: fs.existsSync(generatedPinePath) ? generatedPinePath : null,
        order_logic: false,
        alertconditions: true,
      },
      {
        path: path.relative(rootDir, realisticPinePath),
        classification: 'Luke visual indicator - realistic accounting',
        declaration: 'indicator',
        generated_artifact: fs.existsSync(generatedRealisticPath) ? generatedRealisticPath : null,
        order_logic: false,
        alertconditions: true,
      },
      {
        path: path.relative(rootDir, productionTestPinePath),
        classification: 'Luke chart-facing production test indicator - realistic accounting',
        declaration: 'indicator',
        generated_artifact: fs.existsSync(generatedProductionTestPath) ? generatedProductionTestPath : null,
        order_logic: false,
        alertconditions: true,
      },
      {
        path: path.relative(rootDir, simulationStrategyPinePath),
        classification: 'Luke Strategy Tester simulation only',
        declaration: 'strategy',
        generated_artifact: fs.existsSync(generatedSimulationStrategyPath) ? generatedSimulationStrategyPath : null,
        order_logic: 'TradingView Strategy Tester broker-emulator only',
        alertconditions: 'non-executable',
      },
      {
        path: path.relative(rootDir, hardmodePinePath),
        classification: 'research strategy',
        declaration: 'strategy',
        generated_artifact: fs.existsSync(generatedHardmodePath) ? generatedHardmodePath : null,
        order_logic: 'TradingView research strategy constructs only',
        alertconditions: true,
      },
      {
        path: path.relative(rootDir, path.join(rootDir, 'tradingview', 'saty-atr-levels-source.pine')),
        classification: 'Saty source/reference',
        declaration: 'indicator',
        generated_artifact: null,
        request_security_lookahead: 'lookahead_on display reference',
      },
    ],
  };
  const slippageModesSummary = {
    generated_at: exportData.generated_at,
    modes: [
      'none',
      'entry_only_0_25',
      'exit_only_0_25',
      'both_sides_0_25_each',
      'round_trip_0_50',
      'round_trip_1_00',
      'custom_points',
    ],
    default_mode: 'both_sides_0_25_each',
    es_point_value: 50,
    one_es_dollars_per_point: 50,
    two_es_dollars_per_point: 100,
    same_bar_default: 'stop_first_hard_mode',
  };
  const hardmodeAudit = {
    generated_at: exportData.generated_at,
    hardmode_strategy: fs.existsSync(hardmodePinePath) ? hardmodePinePath : null,
    generated_hardmode_strategy: fs.existsSync(generatedHardmodePath) ? generatedHardmodePath : null,
    safety: {
      research_only: true,
      no_external_broker_integration: true,
      no_fixed_spx_to_es_conversion: true,
      manual_drawn_lines_not_read: true,
      strategy_safe_saty_uses_lookahead_off: true,
      saty_reference_preserved: true,
    },
    hard_mode_features: {
      slippage_modes: slippageModesSummary.modes,
      same_bar_policy_default: 'stop_first_hard_mode',
      ambiguous_count_surfaced: true,
      confirmed_bar_timing: true,
      manual_accounting_table: true,
    },
  };
  fs.writeFileSync(pineFilesSummaryPath, JSON.stringify(pineFilesSummary, null, 2), 'utf8');
  fs.writeFileSync(slippageModesSummaryPath, JSON.stringify(slippageModesSummary, null, 2), 'utf8');
  fs.writeFileSync(hardmodeAuditPath, JSON.stringify(hardmodeAudit, null, 2), 'utf8');

  const summary = {
    generated_at: exportData.generated_at,
    artifacts: {
      json: jsonPath,
      csv: csvPath,
      pine_input: inputPath,
      generated_pine: fs.existsSync(generatedPinePath) ? generatedPinePath : null,
      generated_realistic_indicator: fs.existsSync(generatedRealisticPath) ? generatedRealisticPath : null,
      generated_production_test_indicator: fs.existsSync(generatedProductionTestPath) ? generatedProductionTestPath : null,
      generated_simulation_strategy: fs.existsSync(generatedSimulationStrategyPath) ? generatedSimulationStrategyPath : null,
      generated_hardmode_strategy: fs.existsSync(generatedHardmodePath) ? generatedHardmodePath : null,
      pine_files_summary: pineFilesSummaryPath,
      slippage_modes_summary: slippageModesSummaryPath,
      pine_hardmode_audit: hardmodeAuditPath,
      summary: summaryPath,
    },
    source_summary: exportData.source_summary,
    issues: exportData.issues,
    safety: {
      no_live_execution: true,
      no_broker_routes: true,
      no_spx_to_es_fixed_conversion: true,
      manual_tradingview_lines_not_read: true,
      hardmode_research_only: true,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

module.exports = {
  buildTradingViewLevelExport,
  writeTradingViewArtifacts,
  discoverManciniCurrentLog,
  extractManciniLogPosts,
  extractManciniLevelsFromLog,
  extractManciniFallbackLevels,
  normalizeSatyLevels,
  normalizeDubzLevels,
  normalizeHeatmapGexLevels,
  clusterLevelsForPineExport,
  buildPineInputText,
  renderGeneratedPine,
  _internal: {
    parseManciniDateRange,
    inferRelativeDate,
    explicitDateInText,
    uniqueSortedPrices,
    dedupeNormalizedLevels,
    capTolerance,
  },
};
