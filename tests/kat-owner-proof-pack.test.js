'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildKatOwnerProofPack } = require('../lib/kat-owner-proof-pack');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-owner-proof-'));
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

describe('Kat owner proof pack', () => {
  it('writes owner-facing report, proof HTML, Luke preview, and evidence JSON', () => {
    const root = makeRoot();
    const outDir = path.join(root, 'reports', 'katbot-owner-proof');
    const now = new Date('2026-05-03T14:00:00.000Z');
    const raw = [];
    for (let i = 0; i < 1001; i++) {
      raw.push({
        ts: '2026-05-03T13:00:00.000Z',
        message_id: 'raw-' + i,
        username: i % 2 ? 'analyst1' : 'analyst2',
        channel_name: 'trade-floor',
        content: i % 2 ? '$SPY bullish above 560 heatmap' : '$GLW breakout over 60',
        attachments: [{ filename: 'chart.png', content_type: 'image/png', url: 'https://cdn.example/chart.png' }],
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
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'raw-1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'SPY', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [560], raw: '$SPY bullish above 560 heatmap', has_image: true },
      { ts: '2026-05-03T13:01:00.000Z', message_id: 'raw-2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$GLW breakout over 60' },
      { ts: '2026-05-03T13:02:00.000Z', message_id: 'raw-4', analyst: 'analyst1', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$GLW breakout over 60' },
    ]);
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-replay-summary.json'), { parsed_records: 100, spx_options_direct_records: 50 });
    writeJson(path.join(root, 'data', 'kat', 'derived', 'kat-evaluation-summary.json'), { total: 50, evaluated: 114, win_rate_30m: { pct: 53.51 } });
    fs.writeFileSync(path.join(root, 'data', 'historical', 'spx_intraday.csv'), 'Time,Close\n2026-05-01 09:30,5600\n', 'utf8');
    fs.writeFileSync(path.join(root, 'agents', 'agent-14-kat.js'), [
      'const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false });',
      'function discordOutputAllowed() {}',
      "console.log('[kat] Discord reply suppressed by output gate');",
      "console.log('[kat] Discord channel post suppressed by output gate');",
    ].join('\n'), 'utf8');

    const result = buildKatOwnerProofPack({ rootDir: root, outDir, now });

    expect(fs.existsSync(result.files.ownerMarkdown)).toBe(true);
    expect(fs.existsSync(result.files.ownerHtml)).toBe(true);
    expect(fs.existsSync(result.files.lukeHtml)).toBe(true);
    expect(fs.existsSync(result.files.evidenceJson)).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'message-bin', 'katbot-message-examples.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'message-bin', 'katbot-message-examples.html'))).toBe(true);
    expect(fs.readFileSync(result.files.ownerMarkdown, 'utf8')).toContain('```mermaid');
    expect(fs.readFileSync(result.files.ownerMarkdown, 'utf8')).toContain('Discord Preview');
    expect(fs.readFileSync(result.files.ownerMarkdown, 'utf8')).toContain('Timestamped Message Bin');
    expect(fs.readFileSync(result.files.lukeHtml, 'utf8')).toContain('Luke Trading Window');
    expect(result.pack.previews.lukePayloads.some(payload => payload.type === 'kat_signal')).toBe(true);
  });
});
