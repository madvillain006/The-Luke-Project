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
        content: '$ups 110 C 06/18/2026',
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
    expect(proof.outputs.help).toContain('Katbot is live in trade-floor.');
    expect(proof.outputs.help).toContain('!bias spx - 18h SPX bias');
    expect(proof.outputs.help).toContain('!kat heatmap spx');
    expect(proof.outputs.help).toContain('!equity ups');
    expect(proof.outputs.levels).toContain('5600');
    expect(proof.outputs.bias).toContain('Collective bias');
    expect(proof.outputs.bias).toContain('Use !recent SPX for the source posts.');
    expect(proof.outputs.bias).not.toContain('NBIS');
    expect(proof.outputs.heatmap).toContain('Found saved image from El Jefe.');
    expect(proof.outputs.heatmap).not.toContain('heatmap-requests');
    expect(proof.outputs.heatmap).not.toContain('Image:');
    expect(proof.outputs.queue_heatmap).toContain('Kat simulated output: !queue spx heatmap');
    expect(proof.outputs.equity_chart).toContain('Kat recent: UPS chart-backed posts');
    expect(proof.outputs.equity_chart).toContain('$ups 110 C');
    expect(proof.outputs.equity_chart).toContain('Source:');
    expect(proof.outputs.equity_chart).not.toContain('image:');
    expect(proof.outputs.equity_chart).not.toContain('cdn.example');
    expect(proof.outputs.equity_chart).not.toContain('trade-floor');
    expect(proof.outputs.magnet).toContain('Level Magnet');
    expect(proof.outputs.magnet).toContain('Source:');
    expect(proof.outputs.magnet).not.toContain('captured analyst posts');
    expect(proof.proof_text).toContain('No HTML report is written.');
  });

  it('keeps thin bias output short instead of dumping stale source posts', () => {
    const root = makeRoot();
    writeJson(path.join(root, 'data', 'kat', 'monitored-users.json'), {
      enabled: true,
      monitored_channels: ['trade-floor'],
      monitored_channel_ids: ['1040400353490911292'],
      discord_responses_enabled: true,
      discord_posts_enabled: true,
    });
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [{
      ts: '2026-05-05T13:00:00.000Z',
      message_id: 'old-chart',
      guild_id: 'guild1',
      channel_id: '1040400353490911292',
      channel_name: 'trade-floor',
      username: 'analyst1',
      content: '$SPX old chart',
      attachments: [{ filename: 'spx.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
    }]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), []);

    const proof = buildKatPlainProof({ rootDir: root, ticker: 'SPX', now: new Date('2026-05-05T13:10:00.000Z') });

    expect(proof.outputs.bias).toContain('Kat bias: no call.');
    expect(proof.outputs.bias).toContain('SPX signals last 18h: 0/3 required.');
    expect(proof.outputs.bias).toContain('Use !recent SPX for source posts');
    expect(proof.outputs.bias).not.toContain('Recent chart-backed source posts');
    expect(proof.outputs.bias).not.toContain('image: attached');
    expect(proof.outputs.bias).not.toContain('discord.com/channels');
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
      outputs: { help: 'help', levels: 'levels', bias: 'bias', heatmap: 'heatmap', queue_heatmap: 'queue', equity_chart: 'equity', magnet: 'magnet' },
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
    expect(_internal.signalTickerMatches({ ticker: 'ES', raw: '<:KC_yes:1129057964158898256> $LAC' }, 'SPX')).toBe(false);
    expect(_internal.signalTickerMatches({ ticker: 'ES', raw: '$es_f 1d retest' }, 'SPX')).toBe(true);
    expect(_internal.signalSourceMessageId({ message_id: 'raw-message:vision:attachment' })).toBe('raw-message');
  });

  it('sorts chart evidence by timestamp and keeps image URLs and channel names out of trader-facing proof text', () => {
    const raw = [
      {
        ts: '2026-05-05T12:00:00.000Z',
        message_id: 'older',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$ups older setup',
        attachments: [{ filename: 'older.png', content_type: 'image/png', url: 'https://cdn.example/older.png' }],
      },
      {
        ts: '2026-05-05T13:00:00.000Z',
        message_id: 'newer',
        guild_id: 'guild1',
        channel_id: 'channel1',
        channel_name: 'trade-floor',
        username: 'analyst1',
        content: '$ups newer setup',
        attachments: [{ filename: 'newer.png', content_type: 'image/png', url: 'https://cdn.example/newer.png' }],
      },
    ];

    const evidence = _internal.findChartEvidence(raw, 'UPS', 2, new Date('2026-05-05T13:05:00.000Z'));
    const output = _internal.buildEquityChartCommandOutput(raw, 'UPS', new Date('2026-05-05T13:05:00.000Z'));

    expect(evidence[0].entry.message_id).toBe('newer');
    expect(output).not.toContain('https://discord.com/channels/guild1/channel1/newer');
    expect(output).not.toContain('image:');
    expect(output).not.toContain('cdn.example');
    expect(output).not.toContain('trade-floor');
    expect(output).toContain('$ups newer setup');
    expect(output).toContain('Source:');
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

    expect(output).not.toContain('Source message: https://discord.com/channels/guild1/channel1/spx');
    expect(output).not.toContain('Image:');
    expect(output).not.toContain('cdn.example');
    expect(output).not.toContain('Channel:');
    expect(output).not.toContain('okta');
  });

  it('does not let a mismatched cashtag in heatmap-requests satisfy an SPX heatmap lookup', () => {
    const raw = [
      {
        ts: '2026-05-05T13:25:00.000Z',
        message_id: 'mstr-heatmap',
        guild_id: 'guild1',
        channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
        channel_name: 'heatmap-requests',
        username: 'analyst1',
        content: '$mstr',
        attachments: [{ filename: 'mstr.png', content_type: 'image/png', url: 'https://cdn.example/mstr.png' }],
      },
      {
        ts: '2026-05-05T13:00:00.000Z',
        message_id: 'spx-heatmap',
        guild_id: 'guild1',
        channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
        channel_name: 'heatmap-requests',
        username: 'analyst1',
        content: '$spx',
        attachments: [{ filename: 'spx.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
      },
    ];

    const output = _internal.buildHeatmapCommandOutput(raw, [], 'SPX', new Date('2026-05-05T13:30:00.000Z'));

    expect(output).toContain('Post: "$spx"');
    expect(output).not.toContain('mstr-heatmap');
    expect(output).not.toContain('$mstr');
    expect(output).not.toContain('mstr.png');
  });

  it('refuses stale heatmap images instead of replaying old charts', () => {
    const raw = [{
      ts: '2026-05-04T13:00:00.000Z',
      message_id: 'old-heatmap',
      guild_id: 'guild1',
      channel_id: HEATMAP_REQUESTS_CHANNEL_ID,
      channel_name: 'heatmap-requests',
      username: 'analyst1',
      content: '$SPX heatmap',
      attachments: [{ filename: 'spx.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
    }];

    const output = _internal.buildHeatmapCommandOutput(raw, [], 'SPX', new Date('2026-05-05T13:30:00.000Z'));

    expect(output).toContain('No fresh heatmap found for SPX in the last 18 hours.');
    expect(output).toContain('Kat will not post a stale heatmap.');
    expect(output).not.toContain('Found saved image');
    expect(output).not.toContain('cdn.example');
  });

  it('refuses stale chart images instead of embedding expired recent-post URLs', () => {
    const raw = [{
      ts: '2026-05-04T13:00:00.000Z',
      message_id: 'old-ups',
      guild_id: 'guild1',
      channel_id: 'channel1',
      channel_name: 'trade-floor',
      username: 'analyst1',
      content: '$ups old setup',
      attachments: [{ filename: 'ups.png', content_type: 'image/png', url: 'https://cdn.example/ups.png' }],
    }];

    const output = _internal.buildEquityChartCommandOutput(raw, 'UPS', new Date('2026-05-05T13:30:00.000Z'));

    expect(output).toContain('No fresh chart-backed analyst posts found for UPS in the last 18 hours.');
    expect(output).toContain('Kat will not embed stale or expired chart images.');
    expect(output).not.toContain('cdn.example');
    expect(output).not.toContain('$ups old setup');
  });
});
