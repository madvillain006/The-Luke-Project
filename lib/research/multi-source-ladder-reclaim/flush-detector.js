'use strict';

const { tsMs } = require('../common');
const { buildTrustedLadder, nextExecutableClustersAbove } = require('./ladder');
const { rounded } = require('./level-clusters');

function flushType(count) {
  if (count <= 1) return 'single_level';
  if (count <= 3) return 'multi_level';
  return 'deep_flush';
}

function minutesBetween(a, b) {
  const at = tsMs(a);
  const bt = tsMs(b);
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return null;
  return Math.round((bt - at) / 60000);
}

function sweepInfo(bars, startIndex, maxMinutes = 15) {
  const start = tsMs(bars[startIndex]?.timestamp);
  let low = Number.POSITIVE_INFINITY;
  let index = startIndex;
  for (let i = startIndex; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxMinutes) break;
    if (bars[i].low < low) {
      low = bars[i].low;
      index = i;
    }
  }
  return { sweep_low: rounded(low), sweep_index: index, sweep_timestamp_et: bars[index]?.timestamp || null };
}

function lostClustersForFlush({ clusters, previousClose, sweepLow, breakBuffer = 0.25 }) {
  return (clusters || [])
    .filter(cluster => !cluster.is_veto_or_chop)
    .filter(cluster => Number.isFinite(cluster.canonical_price_es))
    .filter(cluster => previousClose >= cluster.canonical_price_es - 0.25)
    .filter(cluster => sweepLow <= cluster.canonical_price_es - breakBuffer)
    .sort((a, b) => b.canonical_price_es - a.canonical_price_es);
}

function findFirstReclaim({ bars, startIndex, lostClusters, maxMinutes = 30 }) {
  const start = tsMs(bars[startIndex]?.timestamp);
  const lostAsc = (lostClusters || [])
    .slice()
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  for (let i = startIndex; i < bars.length; i += 1) {
    const elapsed = Math.round((tsMs(bars[i].timestamp) - start) / 60000);
    if (elapsed > maxMinutes) return null;
    for (const cluster of lostAsc) {
      const price = cluster.canonical_price_es;
      const priorClose = i > 0 ? bars[i - 1].close : null;
      const closedBackAbove = bars[i].close >= price && (!Number.isFinite(priorClose) || priorClose < price);
      const reclaimedIntrabar = bars[i].low <= price && bars[i].close >= price;
      if (closedBackAbove || reclaimedIntrabar) {
        return {
          reclaim_index: i,
          reclaim_timestamp_et: bars[i].timestamp,
          reclaim_bar: bars[i],
          first_reclaimed_cluster: cluster,
          minutes_to_reclaim: elapsed,
        };
      }
    }
  }
  return null;
}

function detectFlushAt({ bars, index, ladder, breakBuffer = 0.25, minClusters = 1 }) {
  if (!bars[index] || !bars[index - 1]) return null;
  const previousClose = bars[index - 1].close;
  const crossedNow = (ladder.executable_clusters || [])
    .filter(cluster => !cluster.is_veto_or_chop)
    .filter(cluster => Number.isFinite(cluster.canonical_price_es))
    .some(cluster => previousClose >= cluster.canonical_price_es - 0.25 && bars[index].low <= cluster.canonical_price_es - breakBuffer);
  if (!crossedNow) return null;

  const sweep = sweepInfo(bars, index, 15);
  const lostClusters = lostClustersForFlush({
    clusters: ladder.executable_clusters,
    previousClose,
    sweepLow: sweep.sweep_low,
    breakBuffer,
  });
  if (lostClusters.length < minClusters) return null;

  const reclaim = findFirstReclaim({
    bars,
    startIndex: sweep.sweep_index,
    lostClusters,
    maxMinutes: 30,
  });
  if (!reclaim) return null;

  const firstPrice = reclaim.first_reclaimed_cluster.canonical_price_es;
  const upperLost = lostClusters
    .filter(cluster => cluster.canonical_price_es > firstPrice + 0.25)
    .sort((a, b) => a.canonical_price_es - b.canonical_price_es);
  const targets = nextExecutableClustersAbove(ladder, firstPrice, { minDistance: 0.25 });

  return {
    id: `${bars[index].timestamp}:${reclaim.reclaim_timestamp_et}:${reclaim.first_reclaimed_cluster.cluster_id}`,
    date: String(bars[index].timestamp).slice(0, 10),
    strategy: 'multi_source_ladder_first_reclaim_long',
    flush_start_timestamp_et: bars[index].timestamp,
    timestamp_et: reclaim.reclaim_timestamp_et,
    flush_type: flushType(lostClusters.length),
    clusters_lost_count: lostClusters.length,
    clusters_lost: lostClusters,
    lost_cluster_prices: lostClusters.map(cluster => cluster.canonical_price_es),
    lowest_swept_cluster: lostClusters.slice().sort((a, b) => a.canonical_price_es - b.canonical_price_es)[0] || null,
    first_reclaimed_cluster: reclaim.first_reclaimed_cluster,
    first_reclaimed_price: firstPrice,
    sweep_low: sweep.sweep_low,
    sweep_timestamp_et: sweep.sweep_timestamp_et,
    reclaim_timestamp_et: reclaim.reclaim_timestamp_et,
    reclaim_bar: reclaim.reclaim_bar,
    reclaim_index: reclaim.reclaim_index,
    flush_start_index: index,
    sweep_index: sweep.sweep_index,
    minutes_to_reclaim: minutesBetween(bars[index].timestamp, reclaim.reclaim_timestamp_et),
    minutes_from_sweep_to_reclaim: minutesBetween(sweep.sweep_timestamp_et, reclaim.reclaim_timestamp_et),
    upper_lost_clusters: upperLost,
    next_cluster_above: targets[0] || null,
    second_cluster_above: targets[1] || null,
    source_combo: reclaim.first_reclaimed_cluster.source_combo,
    flush_source_combo: [...new Set(lostClusters.flatMap(cluster => cluster.sources || []))].sort().join('+') || 'unknown',
    included_sources: {
      saty: lostClusters.some(cluster => cluster.sources?.includes('saty')),
      mancini: lostClusters.some(cluster => cluster.sources?.includes('mancini')),
      bobby_heatmap: lostClusters.some(cluster => cluster.sources?.includes('bobby')),
      dubz: lostClusters.some(cluster => cluster.sources?.includes('dubz')),
      gex_heatseeker: lostClusters.some(cluster => cluster.sources?.some(source => ['gex', 'heatseeker'].includes(source))),
      multi_source_cluster: lostClusters.some(cluster => (cluster.sources || []).length > 1),
    },
    basis_method: reclaim.first_reclaimed_cluster.basis_method,
    basis_methods: reclaim.first_reclaimed_cluster.basis_methods,
    no_lookahead_violation: false,
  };
}

function detectFlushesForSession({
  session,
  facts,
  esBars,
  spxBars,
  options = {},
}) {
  const bars = session.replayBars || session.bars?.rth || session.bars?.es || [];
  const minClusters = Number.isFinite(options.minClusters) ? options.minClusters : 1;
  const breakBuffer = Number.isFinite(options.breakBuffer) ? options.breakBuffer : 0.25;
  const clusterTolerance = Number.isFinite(options.clusterTolerance) ? options.clusterTolerance : 1.5;
  const seen = new Set();
  const events = [];

  for (let i = 1; i < bars.length - 2; i += 1) {
    const ladder = buildTrustedLadder({
      facts,
      timestamp: bars[i].timestamp,
      esBars: esBars || bars,
      spxBars,
      clusterTolerance,
      basisMethods: options.basisMethods,
    });
    const event = detectFlushAt({ bars, index: i, ladder, breakBuffer, minClusters });
    if (!event) continue;
    const key = `${event.date}:${event.reclaim_timestamp_et}:${event.first_reclaimed_cluster.cluster_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }

  return events;
}

module.exports = {
  flushType,
  sweepInfo,
  lostClustersForFlush,
  findFirstReclaim,
  detectFlushAt,
  detectFlushesForSession,
};
