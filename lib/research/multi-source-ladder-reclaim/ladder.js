'use strict';

const { tsMs } = require('../common');
const { rowsForFact, clusterRows } = require('./level-clusters');

const DEFAULT_BASIS_METHODS = [
  'same_minute_basis',
  'session_open_basis',
  'prior_close_basis',
  'rolling_15m_basis',
  'reference_only',
  'fixed_plus_30_proxy',
];

function activeFactsAt(facts, timestamp) {
  const t = tsMs(timestamp);
  return (facts || []).filter(fact => {
    const available = tsMs(fact.available_at_et);
    return Number.isFinite(available) && Number.isFinite(t) && available <= t;
  });
}

function buildTrustedLadder({
  facts,
  timestamp,
  esBars = [],
  spxBars = [],
  clusterTolerance = 1.5,
  basisMethods = DEFAULT_BASIS_METHODS,
}) {
  const activeFacts = activeFactsAt(facts, timestamp);
  const rows = activeFacts.flatMap(fact => rowsForFact({
    fact,
    timestamp,
    esBars,
    spxBars,
    basisMethods,
  }));
  const clusters = clusterRows(rows, clusterTolerance)
    .sort((a, b) => {
      if (Number.isFinite(a.canonical_price_es) && Number.isFinite(b.canonical_price_es)) {
        return a.canonical_price_es - b.canonical_price_es;
      }
      if (Number.isFinite(a.canonical_price_es)) return -1;
      if (Number.isFinite(b.canonical_price_es)) return 1;
      return String(a.cluster_id).localeCompare(String(b.cluster_id));
    });
  return {
    timestamp_et: timestamp,
    cluster_tolerance: clusterTolerance,
    active_fact_count: activeFacts.length,
    level_row_count: rows.length,
    clusters,
    executable_clusters: clusters.filter(cluster => cluster.is_executable_es && Number.isFinite(cluster.canonical_price_es)),
    reference_only_clusters: clusters.filter(cluster => cluster.is_reference_only),
    diagnostic_only_clusters: clusters.filter(cluster => cluster.is_diagnostic_only),
  };
}

function splitLadderByPrice(ladder, price) {
  const executable = (ladder?.executable_clusters || [])
    .filter(cluster => Number.isFinite(cluster.canonical_price_es));
  return {
    below: executable.filter(cluster => cluster.canonical_price_es < price).sort((a, b) => b.canonical_price_es - a.canonical_price_es),
    current_or_near: executable.filter(cluster => Math.abs(cluster.canonical_price_es - price) <= (ladder?.cluster_tolerance || 1.5)),
    above: executable.filter(cluster => cluster.canonical_price_es > price).sort((a, b) => a.canonical_price_es - b.canonical_price_es),
  };
}

function nextExecutableClustersAbove(ladder, price, options = {}) {
  const minDistance = Number.isFinite(options.minDistance) ? options.minDistance : 0.25;
  const allowChop = options.allowChop === true;
  return (ladder?.executable_clusters || [])
    .filter(cluster => Number.isFinite(cluster.canonical_price_es))
    .filter(cluster => cluster.canonical_price_es > price + minDistance)
    .filter(cluster => allowChop || !cluster.is_veto_or_chop)
    .sort((a, b) => {
      const distance = (a.canonical_price_es - price) - (b.canonical_price_es - price);
      if (Math.abs(distance) > 0.01) return distance;
      return b.cluster_strength - a.cluster_strength;
    });
}

module.exports = {
  DEFAULT_BASIS_METHODS,
  activeFactsAt,
  buildTrustedLadder,
  splitLadderByPrice,
  nextExecutableClustersAbove,
};
