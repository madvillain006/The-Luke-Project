'use strict';

// Synthetic test inputs only. Every consumer supplies this temporary root
// explicitly or restores a test-scoped reader override; no production data is
// created, downloaded, or claimed by these fixtures.
const fs = require('fs');
const os = require('os');
const path = require('path');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
}

function syntheticLevelRow(price, source = 'mancini') {
  return {
    id: `synthetic-ci:${source}:${price}`,
    instrument: 'ES',
    executable_instrument: 'ES',
    canonical_price_es: price,
    original_price: price,
    original_instrument: 'ES',
    source,
    sources: [source],
    roles: ['support_or_trigger'],
    freshness: 1,
    basis_method: 'native_es',
    is_executable_es: true,
    is_reference_only: false,
    is_chop_or_veto: false,
    confidence: 'B',
    evidence: [{ source, timestamp: '2026-04-29T08:00:00-04:00', snippet: 'Synthetic CI input' }],
  };
}

function createChartLevelFixtures() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-ci-chart-level-fixtures-'));
  const candleDir = path.join(root, 'synthetic-candles');
  fs.mkdirSync(candleDir, { recursive: true });
  const header = 'timestamp,open,high,low,close,volume\n';
  const replayBars = [
    ['2026-04-29T08:29:00-04:00', 7225, 7226, 7224, 7225, 10],
    ['2026-04-29T08:30:00-04:00', 7225, 7225, 7221.5, 7222, 10],
    ['2026-04-29T08:31:00-04:00', 7222, 7224, 7221.75, 7223.25, 10],
    ['2026-04-29T08:32:00-04:00', 7223.25, 7225, 7223, 7224, 10],
    ['2026-04-29T08:33:00-04:00', 7224, 7225, 7223.25, 7224.5, 10],
  ];
  fs.writeFileSync(path.join(candleDir, 'ES_1m_synthetic_ci.csv'), header + replayBars.map(row => row.join(',')).join('\n') + '\n');
  fs.writeFileSync(path.join(candleDir, 'SPX_1m_synthetic_ci.csv'), header
    + '2026-04-29T08:32:00-04:00,6100,6102,6099,6101,20\n'
    + '2026-04-29T08:33:00-04:00,6101,6103,6100,6102,20\n');

  const plansDir = path.join(root, 'data', 'research', 'mancini', 'daily-plans');
  writeJson(path.join(plansDir, '2026-05-07-synthetic-ci.json'), {
    date: '2026-05-07', target_session: '2026-05-08', instrument: 'ES',
    corrected_luke_inputs: { trade_levels: [7300] },
  });
  writeJson(path.join(plansDir, '2026-05-08-synthetic-ci.json'), {
    date: '2026-05-08', target_session: '2026-05-11', instrument: 'ES',
    corrected_luke_inputs: {
      trade_levels: [7402, 7391, 7402], major_levels: [7402], focus_long_levels: [7391],
      target_only_levels: [7434, 7462], read_reaction_levels: [7380, 7391],
    },
    trigger_guidance: [{ level: 7391, type: 'reclaim long' }],
  });
  const centralCsv = path.join(root, 'synthetic-mancini-context-protocol', 'events.csv');
  fs.mkdirSync(path.dirname(centralCsv), { recursive: true });
  const centralPrices = [7111, 7455, 7467, ...Array.from({ length: 45 }, (_, index) => 7120 + index)];
  fs.writeFileSync(centralCsv, 'plan_date,price,direction,long_eligible,primary_role,tags,event_status\n'
    + centralPrices.map(price => `2026-05-14,${price},support,true,support,synthetic_ci,active`).join('\n')
    + '\n2026-05-14,7991,resistance,true,resistance,synthetic_ci,active'
    + '\n2026-05-14,7992,support,false,support,synthetic_ci,active'
    + '\n2026-05-13,7993,support,true,support,synthetic_ci,active\n');

  const historicalDir = path.join(root, 'synthetic-historical');
  fs.mkdirSync(historicalDir, { recursive: true });
  // Twenty weekday sessions before April 29. Each has a range of 20 points,
  // smaller inter-session gaps, and a known last close of 7009.75.
  const history = [];
  for (let day = 1; day <= 28; day += 1) {
    const date = `2026-04-${String(day).padStart(2, '0')}`;
    if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
    const open = 7000 + history.length * 0.25;
    history.push([`${date}T16:59:00-04:00`, open, open + 10, open - 10, open + 5, 100]);
  }
  fs.writeFileSync(path.join(historicalDir, 'esm26_intraday-1min_historical-data-download-synthetic-ci.csv'),
    header + history.map(row => row.join(',')).join('\n') + '\n');

  return {
    root, candleDir, centralCsv, historicalDir, centralPrices,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

module.exports = { createChartLevelFixtures, syntheticLevelRow };
