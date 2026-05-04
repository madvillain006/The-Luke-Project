'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildKatMessageBin,
  recordKatOutputBin,
  findConfluenceExamples,
  latestVisionExamples,
} = require('../lib/kat-message-bin');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-message-bin-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat'), { recursive: true });
  return root;
}

function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat message bin', () => {
  it('builds timestamped confluence examples from actual raw input and parsed signals', () => {
    const raw = [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'm1', username: 'analyst1', channel_name: 'trade-floor', content: '$SPY bullish above 560', attachments: [] },
      { ts: '2026-05-03T13:12:00.000Z', message_id: 'm2', username: 'analyst2', channel_name: 'trade-floor', content: '$SPX breakout 5600', attachments: [] },
    ];
    const processed = [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'm1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'SPY', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [560], raw: '$SPY bullish above 560' },
      { ts: '2026-05-03T13:12:00.000Z', message_id: 'm2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'SPX', signal_type: 'LEVEL_WATCH', bias: 'BULLISH', levels: [5600], raw: '$SPX breakout 5600' },
    ];

    const examples = findConfluenceExamples(raw, processed, { windowMinutes: 30 });

    expect(examples).toHaveLength(1);
    expect(examples[0].window_minutes).toBe(12);
    expect(examples[0].messages[0].raw_input).toContain('$SPY');
    expect(examples[0].messages[1].parsed.levels).toEqual([5600]);
  });

  it('writes example files and appends suppressed Discord output to the local sink', () => {
    const root = makeRoot();
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'm1', username: 'analyst1', channel_name: 'trade-floor', content: '$GLW breakout', attachments: [] },
      { ts: '2026-05-03T13:10:00.000Z', message_id: 'm2', username: 'analyst2', channel_name: 'trade-floor', content: 'GLW 1D bull flag', attachments: [] },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), [
      { ts: '2026-05-03T13:00:00.000Z', message_id: 'm1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: '$GLW breakout' },
      { ts: '2026-05-03T13:10:00.000Z', message_id: 'm2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'GLW', signal_type: 'DIRECTIONAL', bias: 'BULLISH', raw: 'GLW 1D bull flag' },
    ]);
    writeJsonl(path.join(root, 'data', 'kat', 'vision-signals.jsonl'), [
      { ts: '2026-05-03T13:20:00.000Z', message_id: 'm3', attachment_id: 'a1', analyst: 'analyst1', channel: 'trade-floor', ticker: 'GLW', source_class: 'chart', chart_type: 'technical', bias: 'BULLISH', levels: [60], parse_status: 'parsed_levels', raw_text: '$GLW chart' },
      { ts: '2026-05-03T13:22:00.000Z', message_id: 'm4', attachment_id: 'a2', analyst: 'analyst2', channel: 'trade-floor', ticker: 'SPX', source_class: 'heatmap', chart_type: 'heatmap', bias: 'BEARISH', levels: [5600], parse_status: 'parsed_levels', raw_text: '$SPX heatmap' },
    ]);

    const built = buildKatMessageBin({ rootDir: root });
    const output = recordKatOutputBin({
      kind: 'discord_reply_suppressed',
      target: { channel_name: 'kat-room' },
      payload: { content: 'preview only' },
    }, { rootDir: root });

    expect(fs.existsSync(built.files.examplesJson)).toBe(true);
    expect(fs.existsSync(built.files.examplesMarkdown)).toBe(true);
    expect(fs.existsSync(built.files.examplesHtml)).toBe(true);
    expect(built.bin.vision_examples.charts).toHaveLength(1);
    expect(built.bin.vision_examples.heatmaps).toHaveLength(1);
    expect(fs.readFileSync(built.files.examplesMarkdown, 'utf8')).toContain('Parsed Vision Examples: Charts');
    expect(fs.existsSync(output.outputJsonl)).toBe(true);
    expect(fs.readFileSync(output.outputJsonl, 'utf8')).toContain('preview only');
  });

  it('separates chart and heatmap vision examples', () => {
    const records = [
      { ts: '2026-05-03T13:20:00.000Z', source_class: 'chart', chart_type: 'candlestick', ticker: 'SPY', bias: 'BULLISH', levels: [560], message_id: 'chart-1' },
      { ts: '2026-05-03T13:21:00.000Z', source_class: 'heatmap', chart_type: 'heatmap', ticker: 'SPX', bias: 'BEARISH', levels: [5600], message_id: 'heat-1' },
    ];

    expect(latestVisionExamples(records, 'chart', 2)[0].kind).toBe('vision_chart_parse');
    expect(latestVisionExamples(records, 'heatmap', 2)[0].kind).toBe('vision_heatmap_parse');
  });
});
