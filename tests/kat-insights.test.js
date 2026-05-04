'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildKatInsights,
  formatKatInsightsForDiscord,
  buildKatHandoffMarkdown,
} = require('../lib/kat-insights');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-insights-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat', 'derived'), { recursive: true });
  return root;
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat insights', () => {
  it('builds Luke/Discord-readable status from replay artifacts', () => {
    const root = makeRoot();
    writeJson(path.join(root, 'data', 'kat', 'monitored-users.json'), {
      enabled: true,
      monitored_users: [{ username: 'analyst' }],
      monitored_channels: ['trade-floor'],
      command_channels: ['kat-room'],
    });
    writeJson(path.join(root, 'data', 'kat', 'activity.json'), {
      analyst: '2026-05-03T13:30:00.000Z',
    });
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [{
      ts: '2026-05-03T13:30:00.000Z',
      message_id: '1',
      username: 'analyst',
      channel_name: 'trade-floor',
      content: '$SPY heatmap bullish above 560',
      attachments: [{ filename: 'spy.png', content_type: 'image/png' }],
    }, {
      ts: '2026-05-03T13:31:00.000Z',
      message_id: '2',
      username: 'analyst',
      channel_name: 'trade-floor',
      content: '$GLW breakout setup',
      attachments: [],
    }, {
      ts: '2026-05-03T13:32:00.000Z',
      message_id: '3',
      username: 'analyst2',
      channel_name: 'trade-floor',
      content: 'GLW 1D bull flag',
      attachments: [],
    }]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [{
      ts: '2026-05-03T13:30:00.000Z',
      message_id: '1',
      analyst: 'analyst',
      ticker: 'SPY',
      signal_type: 'CHART_ANALYSIS',
      bias: 'BULLISH',
      levels: [560],
      has_image: true,
    }, {
      ts: '2026-05-03T13:32:00.000Z',
      message_id: '3',
      analyst: 'analyst2',
      ticker: 'GLW',
      signal_type: 'DIRECTIONAL',
      bias: 'BULLISH',
      levels: [],
      has_image: false,
      raw: 'GLW 1D bull flag',
    }]);
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-replay-summary.json'), {
      parsed_records: 10,
      spx_options_direct_records: 7,
    });
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-evaluation-summary.json'), {
      total: 7,
      evaluated: 3,
      win_rate_30m: { eligible: 3, wins: 2, losses: 1, scratches: 0, pct: 66.67 },
    });
    writeJsonl(path.join(root, 'data', 'kat', 'derived', 'kat-spx-spy-evaluations.jsonl'), [{
      status: 'evaluated',
      ts: '2026-05-03T13:30:00.000Z',
      analyst: 'analyst',
      ticker: 'SPY',
      direction: 'LONG',
      entry: { price: 560 },
      outcomes: { '30m': { verdict: 'WIN' } },
      heatmap_candidate: true,
      recommendation: { recommendation: 'long' },
    }]);

    const insights = buildKatInsights({
      rootDir: root,
      now: new Date('2026-05-03T14:00:00.000Z'),
    });
    expect(insights.audit.raw_messages).toBe(3);
    expect(insights.watchlist.candidates[0].ticker).toBe('GLW');
    expect(insights.equity_options.tickers.some(ticker => ticker.ticker === 'GLW')).toBe(true);
    expect(insights.replay.parsed_records).toBe(10);
    expect(insights.evaluation.evaluated).toBe(3);
    expect(formatKatInsightsForDiscord(insights)).toContain('30m baseline: 66.67%');
    expect(formatKatInsightsForDiscord(insights)).toContain('Watchlist: GLW');
    expect(formatKatInsightsForDiscord(insights)).toContain('Equity/options: GLW');
    expect(buildKatHandoffMarkdown(insights)).toContain('Direct SPX options lane is SPX/SPY only.');
    expect(buildKatHandoffMarkdown(insights)).toContain('Single-name equities are shadow-watch only');
    expect(buildKatHandoffMarkdown(insights)).toContain('/agent/kat/equity-options');
  });
});
