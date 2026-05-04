'use strict';

const fs = require('fs');
const path = require('path');
const { queryLevels } = require('../level-memory');
const { scoreLevel } = require('../confluence-engine');
const { round } = require('./prop-risk-gate');
const {
  normalizeSourceFamily,
  normalizeTransport,
  normalizeRole,
  lifecycleForFamily,
} = require('./source-normalization');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const DEFAULT_CLUSTER_TOLERANCE = 1.5;

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeInstrument(value) {
  return String(value || 'ES').toUpperCase();
}

function normalizeSource(value) {
  return normalizeSourceFamily(value);
}

function sourceStrength(source) {
  const weights = {
    saty: 5,
    mancini: 5,
    heatmap_gex: 4,
    dubz_structural: 3,
    dubz_callout: 3,
    katbot_context: 1,
    market_data: 1,
    unknown: 1,
  };
  return weights[normalizeSource(source)] || 1;
}

function ageMinutes(timestamp, now = new Date()) {
  const then = Date.parse(timestamp);
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(then) || !Number.isFinite(current)) return null;
  return Math.max(0, Math.round((current - then) / 60000));
}

function roleFromMention(mention = {}) {
  const text = `${mention.significance || ''} ${mention.direction || ''} ${mention.intent || ''} ${mention.source_type || ''}`;
  if (/chop|veto|avoid|no.?trade/i.test(text)) return 'chop_or_veto';
  if (/target|resistance|call/i.test(text)) return 'target_or_resistance';
  if (/support|put|trigger|key|flip/i.test(text)) return 'support_or_trigger';
  return 'level';
}

function levelMemoryRows({ instrument = 'ES', queryLevelsFn = queryLevels, now = new Date() } = {}) {
  const normalized = normalizeInstrument(instrument);
  const rows = [];
  let records = [];
  try {
    records = queryLevelsFn({ instrument: normalized, window: 'active' });
  } catch {
    records = [];
  }

  for (const record of records || []) {
    const mentions = record.mentions || [];
    const sources = [...new Set(mentions.map(m => normalizeSourceFamily(m.analyst, m)))];
    const transports = [...new Set(mentions.map(m => normalizeTransport(m.analyst, m)))];
    rows.push({
      id: `lm:${normalized}:${record.canonical_price}:${sources.join('+') || 'unknown'}`,
      instrument: normalized,
      executable_instrument: normalized === 'ES' ? 'ES' : null,
      canonical_price_es: normalized === 'ES' ? Number(record.canonical_price) : null,
      original_price: Number(record.canonical_price),
      original_instrument: normalized,
      source: sources[0] || 'unknown',
      source_family: sources[0] || 'unknown',
      sources,
      source_families: sources,
      transports,
      transport: transports[0] || 'unknown',
      lifecycle: lifecycleForFamily(sources[0] || 'unknown'),
      roles: [...new Set(mentions.map(roleFromMention))],
      freshness: ageMinutes(record.last_seen || mentions[mentions.length - 1]?.timestamp, now),
      basis_method: normalized === 'ES' ? 'native_es' : 'reference_only',
      is_executable_es: normalized === 'ES',
      is_reference_only: normalized !== 'ES',
      is_chop_or_veto: mentions.some(m => roleFromMention(m) === 'chop_or_veto'),
      confidence: scoreLevel(record).grade,
      original: record,
      evidence: mentions.slice(-4).map(m => ({
        source: normalizeSourceFamily(m.analyst, m),
        transport: normalizeTransport(m.analyst, m),
        role: roleFromMention(m),
        timestamp: m.timestamp || null,
        snippet: m.source_snippet || null,
      })),
    });
  }
  return rows;
}

function satyRows({ satyLevels = readJson(path.join(DATA_DIR, 'saty-levels.json'), null), now = new Date() } = {}) {
  if (!satyLevels || satyLevels.valid === false) return [];
  const originalInstrument = normalizeInstrument(satyLevels.instrument || 'SPX');
  const fields = [
    'prev_close',
    'call_trigger',
    'put_trigger',
    'ext_plus_1',
    'ext_plus_2',
    'ext_plus_3',
    'ext_plus_4',
    'atr_plus_1',
    'ext_minus_1',
    'ext_minus_2',
    'ext_minus_3',
    'ext_minus_4',
    'atr_minus_1',
  ];
  return fields
    .filter(key => Number.isFinite(Number(satyLevels[key])))
    .map(key => {
      const executable = originalInstrument === 'ES';
      return {
        id: `saty:${originalInstrument}:${key}:${satyLevels[key]}`,
        instrument: originalInstrument,
        executable_instrument: executable ? 'ES' : null,
        canonical_price_es: executable ? Number(satyLevels[key]) : null,
        original_price: Number(satyLevels[key]),
        original_instrument: originalInstrument,
        source: 'saty',
        source_family: 'saty',
        sources: ['saty'],
        source_families: ['saty'],
        transport: 'manual',
        transports: ['manual'],
        lifecycle: lifecycleForFamily('saty'),
        roles: [key.includes('trigger') ? 'trigger' : 'atr_level'],
        freshness: ageMinutes(satyLevels.updated || satyLevels.auto_pull_reference?.captured_at, now),
        basis_method: executable ? 'native_es' : 'reference_only',
        is_executable_es: executable,
        is_reference_only: !executable,
        is_chop_or_veto: false,
        confidence: 'B',
        original: { field: key, value: satyLevels[key], payload: satyLevels },
        evidence: [{ source: 'saty', transport: 'manual', role: key, timestamp: satyLevels.updated || null, snippet: satyLevels.source_note || null }],
      };
    });
}

function dubzRows({ dubzLevels = readJson(path.join(DATA_DIR, 'dubz-levels.json'), null), instrument = 'ES', now = new Date() } = {}) {
  const normalized = normalizeInstrument(instrument);
  const levels = dubzLevels?.instruments?.[normalized]?.levels || [];
  return levels
    .filter(level => Number.isFinite(Number(level.price)))
    .map((level, index) => ({
      id: `dubz:${normalized}:${level.price}:${index}`,
      instrument: normalized,
      executable_instrument: normalized === 'ES' ? 'ES' : null,
      canonical_price_es: normalized === 'ES' ? Number(level.price) : null,
      original_price: Number(level.price),
      original_instrument: normalized,
      source: normalizeSourceFamily('dubz', level),
      source_family: normalizeSourceFamily('dubz', level),
      sources: [normalizeSourceFamily('dubz', level)],
      source_families: [normalizeSourceFamily('dubz', level)],
      transport: normalizeTransport('dubz', level),
      transports: [normalizeTransport('dubz', level)],
      lifecycle: lifecycleForFamily(normalizeSourceFamily('dubz', level)),
      roles: [normalizeRole(roleFromMention(level))],
      freshness: ageMinutes(dubzLevels.last_updated, now),
      basis_method: normalized === 'ES' ? 'native_es' : 'reference_only',
      is_executable_es: normalized === 'ES',
      is_reference_only: normalized !== 'ES',
      is_chop_or_veto: roleFromMention(level) === 'chop_or_veto',
      confidence: level.significance === 'key' ? 'B' : 'C',
      original: level,
      evidence: [{ source: normalizeSourceFamily('dubz', level), transport: normalizeTransport('dubz', level), role: roleFromMention(level), timestamp: dubzLevels.last_updated || null, snippet: level.source_snippet || null }],
    }));
}

function confidenceFromRows(rows) {
  const strength = rows.reduce((sum, row) => sum + sourceStrength(row.source), 0);
  if (strength >= 10) return 'A';
  if (strength >= 7) return 'B';
  if (strength >= 4) return 'C';
  return 'D';
}

function clusterExecutableRows(rows, tolerance) {
  const sorted = rows
    .filter(row => row.is_executable_es && Number.isFinite(row.canonical_price_es))
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  const groups = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (!last || Math.abs(row.canonical_price_es - last.anchor) > tolerance) {
      groups.push({ anchor: row.canonical_price_es, rows: [row] });
    } else {
      last.rows.push(row);
      last.anchor = round(last.rows.reduce((sum, item) => sum + item.canonical_price_es, 0) / last.rows.length);
    }
  }
  return groups.map((group, index) => {
    const price = round(group.rows.reduce((sum, item) => sum + item.canonical_price_es, 0) / group.rows.length);
    const sources = [...new Set(group.rows.flatMap(row => row.source_families || row.sources || [row.source]).map(normalizeSource))].sort();
    const transports = [...new Set(group.rows.flatMap(row => row.transports || [row.transport || normalizeTransport(row.source, row.original)]))].sort();
    const roles = [...new Set(group.rows.flatMap(row => row.roles || []))].sort();
    return {
      id: `cluster:ES:${price}:${sources.join('+') || index}`,
      instrument: 'ES',
      executable_instrument: 'ES',
      canonical_price_es: price,
      original_levels: group.rows.map(row => ({
        source: normalizeSource(row.source_family || row.source),
        source_family: normalizeSource(row.source_family || row.source),
        transport: row.transport || normalizeTransport(row.source, row.original),
        lifecycle: row.lifecycle || lifecycleForFamily(row.source_family || row.source),
        instrument: row.original_instrument,
        price: row.original_price,
        role: row.roles?.[0] || 'level',
        freshness: row.freshness,
        freshness_status: row.freshness_status || null,
        available_at_et: row.available_at_et || null,
      })),
      sources,
      source_families: sources,
      transports,
      roles,
      freshness: Math.min(...group.rows.map(row => row.freshness).filter(Number.isFinite), 999999),
      confidence: confidenceFromRows(group.rows),
      basis_method: group.rows.some(row => row.basis_method === 'native_es') ? 'native_es' : group.rows[0]?.basis_method || 'unknown',
      basis_methods: [...new Set(group.rows.map(row => row.basis_method))],
      is_executable_es: true,
      is_reference_only: false,
      is_chop_or_veto: group.rows.some(row => row.is_chop_or_veto),
      nearest_above: null,
      nearest_below: null,
      state: 'LEVELS_LOADED',
      last_transition_at: null,
      evidence: group.rows.flatMap(row => row.evidence || []).slice(-8),
      rows: group.rows,
    };
  });
}

function referenceClusters(rows) {
  return rows
    .filter(row => !row.is_executable_es)
    .map(row => ({
      id: `reference:${row.original_instrument}:${row.original_price}:${normalizeSource(row.source_family || row.source)}`,
      instrument: row.original_instrument,
      executable_instrument: null,
      canonical_price_es: null,
      original_levels: [{
        source: normalizeSource(row.source_family || row.source),
        source_family: normalizeSource(row.source_family || row.source),
        transport: row.transport || normalizeTransport(row.source, row.original),
        lifecycle: row.lifecycle || lifecycleForFamily(row.source_family || row.source),
        instrument: row.original_instrument,
        price: row.original_price,
        role: row.roles?.[0] || 'level',
        freshness: row.freshness,
        freshness_status: row.freshness_status || null,
        available_at_et: row.available_at_et || null,
      }],
      sources: row.source_families || row.sources,
      source_families: row.source_families || row.sources,
      transports: row.transports || [row.transport || normalizeTransport(row.source, row.original)],
      roles: row.roles,
      freshness: row.freshness,
      confidence: row.confidence,
      basis_method: row.basis_method,
      basis_methods: [row.basis_method],
      is_executable_es: false,
      is_reference_only: true,
      is_chop_or_veto: row.is_chop_or_veto,
      nearest_above: null,
      nearest_below: null,
      state: 'REFERENCE_ONLY',
      last_transition_at: null,
      evidence: row.evidence || [],
      rows: [row],
      warnings: ['reference-only level; no ES execution level without explicit basis'],
    }));
}

function addNearest(clusters) {
  const executable = clusters
    .filter(cluster => cluster.is_executable_es && Number.isFinite(cluster.canonical_price_es))
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  for (let index = 0; index < executable.length; index += 1) {
    executable[index].nearest_below = executable[index - 1]?.canonical_price_es ?? null;
    executable[index].nearest_above = executable[index + 1]?.canonical_price_es ?? null;
  }
  return clusters;
}

function buildLevelClusters({
  instrument = 'ES',
  now = new Date(),
  tolerance = DEFAULT_CLUSTER_TOLERANCE,
  rows = null,
  queryLevelsFn = queryLevels,
  satyLevels,
  dubzLevels,
} = {}) {
  const normalized = normalizeInstrument(instrument);
  const sourceRows = rows || [
    ...levelMemoryRows({ instrument: normalized, queryLevelsFn, now }),
    ...satyRows({ satyLevels, now }),
    ...dubzRows({ dubzLevels, instrument: normalized, now }),
  ];
  return addNearest([
    ...clusterExecutableRows(sourceRows, tolerance),
    ...referenceClusters(sourceRows),
  ]);
}

function sourceFreshness(clusters) {
  const sources = ['saty', 'mancini', 'dubz_structural', 'dubz_callout', 'heatmap_gex', 'katbot_context', 'market_data', 'unknown'];
  const output = {};
  for (const source of sources) {
    const matching = clusters.filter(cluster => cluster.sources?.includes(source));
    output[source] = {
      loaded: matching.length > 0,
      count: matching.length,
      freshness_minutes: matching.length ? Math.min(...matching.map(cluster => cluster.freshness).filter(Number.isFinite), 999999) : null,
    };
  }
  return output;
}

module.exports = {
  DEFAULT_CLUSTER_TOLERANCE,
  buildLevelClusters,
  sourceFreshness,
  normalizeInstrument,
  normalizeSource,
  roleFromMention,
  levelMemoryRows,
  satyRows,
  dubzRows,
};
