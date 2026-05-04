'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildKatReadiness,
  formatKatReadinessMarkdown,
  _internal,
} = require('../lib/kat-readiness');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-readiness-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data', 'kat', 'derived'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data', 'historical'), { recursive: true });
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

describe('Kat readiness', () => {
  it('keeps Discord output gated and recommends owner review before public use', () => {
    const root = makeRoot();
    const now = new Date('2026-05-03T14:00:00.000Z');
    const raw = [];
    for (let i = 0; i < 1001; i++) {
      raw.push({
        ts: '2026-05-03T13:00:00.000Z',
        message_id: 'raw-' + i,
        username: i % 2 ? 'analyst1' : 'analyst2',
        channel_name: 'trade-floor',
        content: i % 2 ? '$GLW breakout over 60' : 'GLW 1D bull flag',
        attachments: i % 3 === 0 ? [{ filename: 'glw.png', content_type: 'image/png' }] : [],
      });
    }
    writeJson(path.join(root, 'data', 'kat', 'monitored-users.json'), {
      enabled: true,
      monitored_users: [{ username: 'analyst1', discord_id: '1' }],
      monitored_channels: ['trade-floor'],
      command_channels: ['kat-room'],
      discord_responses_enabled: false,
      discord_posts_enabled: false,
    });
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), raw);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'p1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$GLW breakout over 60' },
      { ts: '2026-05-03T13:01:00.000Z', message_id: 'p2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: 'GLW 1D bull flag' },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'vision-signals.jsonl'), [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'raw-0', attachment_id: 'a1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'GLW', source_class: 'chart', chart_type: 'candlestick', bias: 'BULLISH', levels: [60], parse_status: 'parsed_levels' },
    ]);
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-replay-summary.json'), {
      parsed_records: 100,
      spx_options_direct_records: 50,
    });
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-evaluation-summary.json'), {
      total: 50,
      evaluated: 114,
      win_rate_30m: { pct: 53.51 },
    });
    fs.writeFileSync(path.join(root, 'data', 'historical', 'spx_intraday.csv'), 'Time,Close\n2026-05-01 09:30,5600\n', 'utf8');
    fs.writeFileSync(path.join(root, 'agents', 'agent-14-kat.js'), [
      'const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false });',
      'function discordOutputAllowed() {}',
      "console.log('[kat] Discord reply suppressed by output gate');",
      "console.log('[kat] Discord channel post suppressed by output gate');",
    ].join('\n'), 'utf8');

    const readiness = buildKatReadiness({ rootDir: root, now });

    expect(readiness.discord_output_gate.responses_enabled).toBe(false);
    expect(readiness.discord_output_gate.posts_enabled).toBe(false);
    expect(readiness.recommendation.status).toBe('owner_review_ready');
    expect(readiness.evidence.vision_chart_signals).toBe(1);
    expect(readiness.warnings.join('\n')).toContain('SPX/SPY sample size');
    expect(formatKatReadinessMarkdown(readiness)).toContain('Discord outputs still gated');
  });

  it('detects source safety gates from the Kat agent code', () => {
    const source = [
      'const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false });',
      'function discordOutputAllowed() {}',
      "console.log('[kat] Discord reply suppressed by output gate');",
      "console.log('[kat] Discord channel post suppressed by output gate');",
    ].join('\n');

    expect(_internal.hasSourceSafetyGate(source)).toBe(true);
    expect(_internal.hasNoMentionSafety(source)).toBe(true);
  });
});
