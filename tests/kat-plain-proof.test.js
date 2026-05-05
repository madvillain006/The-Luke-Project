'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HEATMAP_REQUESTS_CHANNEL_ID,
  SECONDARY_RESEARCH_CHANNEL_ID,
  buildKatPlainProof,
  writeKatPlainProof,
  _internal,
} = require('../lib/kat-plain-proof');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-plain-proof-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat'), { recursive: true });
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

describe('Kat plain proof', () => {
  it('simulates public Kat command output from captured raw and processed records', () => {
    const root = makeRoot();
    writeJson(path.join(root, 'data', 'kat', 'monitored-users.json'), {
      enabled: true,
      monitored_users: [{ username: 'El Jefe', discord_id: '755259514068009041' }],
      monitored_channels: ['trade-floor', 'heatmap-requests'],
      monitored_channel_ids: ['1040400353490911292', HEATMAP_REQUESTS_CHANNEL_ID, SECONDARY_RESEARCH_CHANNEL_ID],
      discord_responses_enabled: false,
      discord_posts_enabled: false,
    });
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-05T13:00:00.000Z',
        message_id: 'raw-heat',
        username: 'El Jefe',
        channel_name: 'heatmap-requests',
        channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
        content: '$SPX heatmap king node 5600',
        attachments: [{ filename: 'spx-heatmap.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
      },
      {
        ts: '2026-05-05T13:05:00.000Z',
        message_id: 'raw-ups',
        guild_id: 'guild1',
        channel_id: '1040400353490911292',
        channel_name: 'trade-floor',
        username: 'El Jefe',
        content: '$UPS 110 C 06/18/2026',
        attachments: [{ filename: 'ups-chart.png', content_type: 'image/png', url: 'https://cdn.example/ups.png' }],
      },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-05T12:00:00.000Z', message_id: 'p1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'SPX', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [5601], raw: '$SPX 5601' },
      { ts: '2026-05-05T12:10:00.000Z', message_id: 'p2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'SPX', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [5599], raw: '$SPX 5599' },
      { ts: '2026-05-05T12:20:00.000Z', message_id: 'p3', analyst: 'analyst1', channel: 'trade-floor', ticker: 'SPX', signal_type: 'DIRECTIONAL', bias: 'BEARISH', levels: [], raw: '$SPX resistance' },
      { ts: '2026-05-05T12:30:00.000Z', message_id: 'p4', analyst: 'analyst1', channel: 'trade-floor', ticker: 'NBIS', signal_type: 'DIRECTIONAL', bias: 'BULLISH', levels: [], raw: '$NBIS broad ticker chatter' },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'vision-signals.jsonl'), [
      { ts: '2026-05-05T13:01:00.000Z', message_id: 'raw-heat', attachment_id: 'a1', analyst: 'El Jefe', channel: 'heatmap-requests', ticker: 'SPX', source_class: 'heatmap', chart_type: 'heatmap', bias: 'BULLISH', levels: [5600], parse_status: 'parsed_levels' },
    ]);

    const proof = buildKatPlainProof({ rootDir: root, ticker: 'SPX', now: new Date('2026-05-05T13:10:00.000Z') });

    expect(proof.config.heatmap_requests_configured).toBe(true);
    expect(proof.config.secondary_research_configured).toBe(true);
    expect(proof.outputs.help).toContain('!kat levels SPX');
    expect(proof.outputs.help).toContain('!kat equity UPS');
    expect(proof.outputs.levels).toContain('5600');
    expect(proof.outputs.bias).toContain('Collective bias');
    expect(proof.outputs.bias).not.toContain('NBIS');
    expect(proof.outputs.heatmap).toContain('heatmap-requests');
    expect(proof.outputs.equity_chart).toContain('UPS chart-backed analyst posts');
    expect(proof.outputs.equity_chart).toContain('image: attached in Discord payload');
    expect(proof.outputs.equity_chart).not.toContain('https://cdn.example/ups.png');
    expect(proof.outputs.magnet).toContain('Level Magnet');
    expect(proof.proof_text).toContain('No HTML report is written.');
  });

  it('writes plain text, JSON, and procedure files without creating an HTML proof file', () => {
    const root = makeRoot();
    const outDir = path.join(root, 'artifacts', 'proof', 'katbot-plain');
    const proof = {
      generated_at: '2026-05-05T13:10:00.000Z',
      as_of: '2026-05-05T13:00:00.000Z',
      ticker: 'SPX',
      counts: { raw: 1, processed: 1, vision: 0, heatmap_requests_rows: 0 },
      config: {
        heatmap_requests_configured: true,
        secondary_research_configured: true,
        monitored_channel_ids: [HEATMAP_REQUESTS_CHANNEL_ID, SECONDARY_RESEARCH_CHANNEL_ID],
        monitored_channels: ['heatmap-requests'],
        monitored_users: ['El Jefe'],
        discord_responses_enabled: false,
        discord_posts_enabled: false,
      },
      outputs: { help: 'help', levels: 'levels', bias: 'bias', heatmap: 'heatmap', equity_chart: 'equity', magnet: 'magnet' },
      proof_text: 'plain proof',
    };

    const files = writeKatPlainProof(proof, outDir);

    expect(fs.existsSync(files.text)).toBe(true);
    expect(fs.existsSync(files.json)).toBe(true);
    expect(fs.existsSync(files.procedure)).toBe(true);
    expect(fs.readdirSync(outDir).some(file => file.endsWith('.html'))).toBe(false);
  });

  it('matches SPX aliases without treating arbitrary symbols as SPX', () => {
    expect(_internal.tickerMatches('SPX', 'SPY')).toBe(true);
    expect(_internal.tickerMatches('SPX', 'ES')).toBe(true);
    expect(_internal.tickerMatches('SPX', 'QQQ')).toBe(false);
    expect(_internal.publicTicker('UPS')).toBe('UPS');
    expect(_internal.publicTicker('QQQ')).toBe(null);
  });

  it('sorts chart evidence by timestamp and keeps image URLs out of trader-facing proof text', () => {
    const raw = [
      {
        ts: '2026-05-05T12:00:00.000Z',
        message_id: 'older',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$UPS older setup',
        attachments: [{ filename: 'older.png', content_type: 'image/png', url: 'https://cdn.example/older.png' }],
      },
      {
        ts: '2026-05-05T13:00:00.000Z',
        message_id: 'newer',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$UPS newer setup',
        attachments: [{ filename: 'newer.png', content_type: 'image/png', url: 'https://cdn.example/newer.png' }],
      },
    ];

    const evidence = _internal.findChartEvidence(raw, 'UPS', 2);
    const output = _internal.buildEquityChartCommandOutput(raw, 'UPS', new Date('2026-05-05T13:05:00.000Z'));

    expect(evidence[0].entry.message_id).toBe('newer');
    expect(output).toContain('https://discord.com/channels/guild1/channel1/newer');
    expect(output).toContain('image: attached in Discord payload');
    expect(output).not.toContain('cdn.example');
  });

  it('does not let generic node language hijack SPX heatmap lookup from non-heatmap channels', () => {
    const raw = [
      {
        ts: '2026-05-05T13:00:00.000Z',
        message_id: 'spx',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$SPX heatmap context',
        attachments: [{ filename: 'spx.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
      },
      {
        ts: '2026-05-05T13:30:00.000Z',
        message_id: 'okta',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$OKTA rolled up to king node',
        attachments: [{ filename: 'okta.png', content_type: 'image/png', url: 'https://cdn.example/okta.png' }],
      },
    ];

    const output = _internal.buildHeatmapCommandOutput(raw, [], 'SPX', new Date('2026-05-05T13:35:00.000Z'));

    expect(output).toContain('Source message: https://discord.com/channels/guild1/channel1/spx');
    expect(output).not.toContain('okta');
  });
});
