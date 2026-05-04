'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateKatReplay } = require('../lib/kat-market-evaluation');

const BARCHART_HEADER = 'Time,Open,High,Low,Latest,Change,%Change,Volume';
const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-eval-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'historical'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data', 'backtest'), { recursive: true });
  return root;
}

function writeBarchartCsv(file, rows) {
  fs.writeFileSync(file, [BARCHART_HEADER, ...rows].join('\n'), 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat market evaluation', () => {
  it('evaluates direct SPX/SPY records against matching market bars', () => {
    const root = makeRoot();
    writeBarchartCsv(path.join(root, 'data', 'historical', 'spy_intraday-1min_historical-data-download-05-01-2026.csv'), [
      '"2026-05-01 09:30",560,561,559,560,0,+0.00%,1000',
      '"2026-05-01 09:35",560,563,559,562,2,+0.35%,1000',
      '"2026-05-01 10:00",562,564,561,563,1,+0.18%,1000',
      '"2026-05-01 16:00",563,565,562,564,1,+0.18%,1000',
    ]);

    const replayRecords = [{
      replay_id: 'r1',
      message_id: 'm1',
      ts: '2026-05-01T13:30:00.000Z',
      analyst: 'analyst',
      channel: 'trade-floor',
      ticker: 'SPY',
      spx_options_direct: true,
      bias: 'BULLISH',
      levels: [560],
      signal_type: 'LEVEL_WATCH',
      image_evidence: { has_image: true, heatmap_candidate: true },
    }];

    const result = evaluateKatReplay(replayRecords, { rootDir: root });
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].status).toBe('evaluated');
    expect(result.evaluations[0].direction).toBe('LONG');
    expect(result.evaluations[0].outcomes['5m'].verdict).toBe('WIN');
    expect(result.evaluations[0].recommendation.recommendation).toBe('long');
    expect(result.summary.win_rate_5m.pct).toBe(100);
  });

  it('does not evaluate QQQ/NQ context records as direct SPX/SPY trades', () => {
    const root = makeRoot();
    const result = evaluateKatReplay([{
      replay_id: 'r1',
      message_id: 'm1',
      ts: '2026-05-01T13:30:00.000Z',
      analyst: 'analyst',
      ticker: 'NQ',
      spx_options_direct: false,
      bias: 'BULLISH',
      levels: [18000],
      signal_type: 'LEVEL_WATCH',
    }], { rootDir: root });

    expect(result.evaluations).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });
});
