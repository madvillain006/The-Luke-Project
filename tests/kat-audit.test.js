'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildKatAudit } = require('../lib/kat-audit');

const tempDirs = [];

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-audit-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'data', 'kat'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data', 'historical'), { recursive: true });
  return dir;
}

function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat audit', () => {
  it('summarizes index-only raw feed and market data coverage', () => {
    const root = makeTempRepo();
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-01T13:30:00.000Z',
        message_id: '1',
        username: 'analyst1',
        channel_name: 'trade-floor',
        content: '$SPY calls above 560 heatmap',
        attachments: [{ filename: 'spy.png', content_type: 'image/png' }],
      },
      {
        ts: '2026-05-01T13:31:00.000Z',
        message_id: '2',
        username: 'analyst2',
        channel_name: 'trade-floor',
        content: '$GLW looks good but irrelevant',
        attachments: [],
      },
      {
        ts: '2026-05-01T13:32:00.000Z',
        message_id: '3',
        username: 'analyst3',
        channel_name: 'trade-floor',
        content: '#NQ_F rejecting 18000',
        attachments: [],
      },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-01T13:30:00.000Z', analyst: 'analyst1', ticker: 'SPY', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [560], has_image: true },
      { ts: '2026-05-01T13:31:00.000Z', analyst: 'analyst2', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', levels: [], has_image: false },
      { ts: '2026-05-01T13:32:00.000Z', analyst: 'analyst3', ticker: 'NQ', signal_type: 'LEVEL_WATCH', bias: 'BEARISH', levels: [18000], has_image: false },
    ]);
    fs.writeFileSync(path.join(root, 'data', 'historical', 'spx_intraday.csv'), 'Time,Close\n2026-05-01 09:30,5600\n', 'utf8');

    const audit = buildKatAudit({ rootDir: root });
    expect(audit.raw.total).toBe(3);
    expect(audit.raw.heatmap_candidates).toBe(1);
    expect(audit.raw.lane_counts.spx_options_direct).toBe(1);
    expect(audit.raw.lane_counts.qqq_ndx_nq_context).toBe(1);
    expect(audit.processed.spx_options_direct_signals).toBe(1);
    expect(audit.processed.non_index_signals).toBe(1);
    expect(audit.watchlist.candidates[0].ticker).toBe('GLW');
    expect(audit.equity_options.tickers.some(ticker => ticker.ticker === 'GLW')).toBe(true);
    expect(audit.scope.single_name_policy).toContain('shadow-watch');
    expect(audit.market_data.available_tickers).toContain('SPX');
    expect(audit.next_actions.join('\n')).toContain('QQQ/NDX/NQ');
  });
});
