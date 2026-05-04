'use strict';

const { tsMs } = require('../common');
const { BASIS_METHODS, convertSpxLevel } = require('../prop-fake-breakdown/basis');

const SOURCE_STRENGTH = {
  saty: 5,
  mancini: 5,
  bobby: 4,
  gex: 4,
  heatseeker: 4,
  dubz: 3,
  katbot: 1,
  jefe: 1,
  unknown: 1,
};

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function normalizeSource(source) {
  const value = String(source || '').toLowerCase();
  if (value.includes('saty')) return 'saty';
  if (value.includes('mancini')) return 'mancini';
  if (value.includes('bobby') || value.includes('heatmap')) return 'bobby';
  if (value.includes('dubz') || value.includes('ximes')) return 'dubz';
  if (value.includes('heatseeker')) return 'heatseeker';
  if (value.includes('gex')) return 'gex';
  if (value.includes('kat')) return 'katbot';
  if (value.includes('jefe')) return 'jefe';
  return value || 'unknown';
}

function sourceStrength(source) {
  return SOURCE_STRENGTH[normalizeSource(source)] || 1;
}

function ageMinutes(availableAt, timestamp) {
  const a = tsMs(availableAt);
  const b = tsMs(timestamp);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
}

function isChopOrVeto(levelType) {
  return /chop|veto|avoid|no.?trade|boundary/i.test(String(levelType || ''));
}

function sourceCombo(rows) {
  return [...new Set((rows || []).map(row => row.source).filter(Boolean))]
    .sort()
    .join('+') || 'unknown';
}

function basisRowsForSpxFact({ fact, timestamp, esBars, spxBars, basisMethods }) {
  const requested = (basisMethods || ['reference_only'])
    .filter(method => BASIS_METHODS.includes(method));
  const methods = requested.length ? requested : ['reference_only'];
  const rows = [];
  for (const method of methods) {
    const converted = convertSpxLevel({
      spxLevel: fact.original_level,
      timestamp,
      esBars,
      spxBars,
      method,
    });
    const diagnostic = converted.diagnostic_only === true;
    const executable = converted.executable === true && !diagnostic;
    rows.push({
      id: `${fact.id}:${method}`,
      source: normalizeSource(fact.source),
      source_type: fact.source_type || fact.level_type || null,
      level_type: fact.level_type || fact.role || 'level',
      original_price: fact.original_level,
      original_instrument: 'SPX',
      executable_instrument: executable ? 'ES' : null,
      canonical_price_es: executable ? rounded(converted.executable_level) : null,
      diagnostic_price_es: diagnostic && Number.isFinite(converted.executable_level) ? rounded(converted.executable_level) : null,
      timestamp_et: fact.available_at_et,
      available_at_et: fact.available_at_et,
      freshness: ageMinutes(fact.available_at_et, timestamp),
      basis_method: method,
      basis: converted.basis?.basis ?? null,
      confidence: fact.confidence || 'medium',
      is_executable_es: executable,
      is_reference_only: method === 'reference_only' || (!executable && !diagnostic),
      is_diagnostic_only: diagnostic,
      is_veto_or_chop: isChopOrVeto(fact.level_type || fact.role),
      raw_path: fact.raw_path || null,
      unusable_reason: executable ? null : (converted.basis?.reason || (diagnostic ? 'fixed_plus_30_diagnostic_only' : 'reference_only_or_basis_unavailable')),
    });
  }
  return rows;
}

function rowsForFact({ fact, timestamp, esBars, spxBars, basisMethods = ['reference_only'] }) {
  if (!fact || !Number.isFinite(Number(fact.original_level))) return [];
  const originalInstrument = String(fact.original_level_instrument || '').toUpperCase();
  if (originalInstrument === 'ES') {
    return [{
      id: `${fact.id}:native_es`,
      source: normalizeSource(fact.source),
      source_type: fact.source_type || fact.level_type || null,
      level_type: fact.level_type || fact.role || 'level',
      original_price: Number(fact.original_level),
      original_instrument: 'ES',
      executable_instrument: 'ES',
      canonical_price_es: rounded(Number(fact.original_level)),
      diagnostic_price_es: null,
      timestamp_et: fact.available_at_et,
      available_at_et: fact.available_at_et,
      freshness: ageMinutes(fact.available_at_et, timestamp),
      basis_method: 'native_es',
      basis: null,
      confidence: fact.confidence || 'medium',
      is_executable_es: true,
      is_reference_only: false,
      is_diagnostic_only: false,
      is_veto_or_chop: isChopOrVeto(fact.level_type || fact.role),
      raw_path: fact.raw_path || null,
      unusable_reason: null,
    }];
  }
  if (originalInstrument === 'SPX') {
    return basisRowsForSpxFact({ fact, timestamp, esBars, spxBars, basisMethods });
  }
  return [];
}

function clusterRows(rows, tolerance = 1.5) {
  const executableRows = (rows || [])
    .filter(row => Number.isFinite(row.canonical_price_es))
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  const referenceRows = (rows || []).filter(row => !Number.isFinite(row.canonical_price_es));
  const clusters = [];

  for (const row of executableRows) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(row.canonical_price_es - last.anchor) > tolerance) {
      clusters.push({ anchor: row.canonical_price_es, rows: [row] });
    } else {
      last.rows.push(row);
      last.anchor = rounded(last.rows.reduce((sum, item) => sum + item.canonical_price_es, 0) / last.rows.length);
    }
  }

  const executableClusters = clusters.map((cluster, idx) => {
    const prices = cluster.rows.map(row => row.canonical_price_es).filter(Number.isFinite);
    const canonical = rounded(prices.reduce((sum, price) => sum + price, 0) / prices.length);
    const sources = [...new Set(cluster.rows.map(row => row.source))].sort();
    const basisMethods = [...new Set(cluster.rows.map(row => row.basis_method))].sort();
    const levelTypes = [...new Set(cluster.rows.map(row => row.level_type).filter(Boolean))].sort();
    const sourceTypes = [...new Set(cluster.rows.map(row => row.source_type).filter(Boolean))].sort();
    return {
      cluster_id: `es:${canonical}:${sources.join('+') || idx}`,
      canonical_price_es: canonical,
      original_price: cluster.rows[0]?.original_price ?? canonical,
      original_instrument: cluster.rows[0]?.original_instrument || 'ES',
      executable_instrument: 'ES',
      source: sources[0] || 'unknown',
      source_combo: sourceCombo(cluster.rows),
      sources,
      source_type: sourceTypes.join('+') || null,
      level_type: levelTypes.join('+') || 'level',
      timestamp_et: cluster.rows.map(row => row.timestamp_et).sort()[0] || null,
      available_at_et: cluster.rows.map(row => row.available_at_et).sort()[0] || null,
      freshness: Math.min(...cluster.rows.map(row => row.freshness).filter(Number.isFinite), 999999),
      basis_method: basisMethods.includes('native_es') ? 'native_es' : basisMethods[0],
      basis_methods: basisMethods,
      confidence: cluster.rows.some(row => row.confidence === 'high') ? 'high' : 'medium',
      is_executable_es: true,
      is_reference_only: false,
      is_veto_or_chop: cluster.rows.some(row => row.is_veto_or_chop),
      cluster_strength: cluster.rows.reduce((sum, row) => sum + sourceStrength(row.source), 0),
      row_count: cluster.rows.length,
      rows: cluster.rows,
    };
  });

  const referenceClusters = referenceRows.map((row, idx) => ({
    cluster_id: `ref:${row.original_instrument}:${rounded(row.original_price)}:${row.basis_method}:${idx}`,
    canonical_price_es: null,
    original_price: row.original_price,
    original_instrument: row.original_instrument,
    executable_instrument: null,
    source: row.source,
    source_combo: row.source || 'unknown',
    sources: [row.source],
    source_type: row.source_type,
    level_type: row.level_type,
    timestamp_et: row.timestamp_et,
    available_at_et: row.available_at_et,
    freshness: row.freshness,
    basis_method: row.basis_method,
    basis_methods: [row.basis_method],
    confidence: row.confidence,
    is_executable_es: false,
    is_reference_only: true,
    is_diagnostic_only: row.is_diagnostic_only,
    is_veto_or_chop: row.is_veto_or_chop,
    cluster_strength: sourceStrength(row.source),
    row_count: 1,
    rows: [row],
    unusable_reason: row.unusable_reason,
  }));

  return [...executableClusters, ...referenceClusters];
}

module.exports = {
  SOURCE_STRENGTH,
  rounded,
  normalizeSource,
  sourceStrength,
  sourceCombo,
  isChopOrVeto,
  rowsForFact,
  clusterRows,
};
