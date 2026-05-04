'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  appendKatVisionRecord,
  buildKatVisionRecord,
  buildProcessedSignalFromVision,
  readKatVisionSignals,
} = require('../lib/kat-vision-store');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-vision-'));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, 'data', 'kat'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Kat vision store', () => {
  it('normalizes chart image parses into durable vision and processed-signal records', () => {
    const entry = {
      ts: '2026-05-04T14:00:00.000Z',
      message_id: 'm-chart',
      username: 'analyst1',
      channel_name: 'trade-floor',
      content: '$SPY 5m reclaim chart',
      attachments: [],
    };
    const record = buildKatVisionRecord({
      entry,
      attachment: { id: 'a1', filename: 'chart.png', content_type: 'image/png', url: 'https://cdn/chart.png' },
      attachmentIndex: 0,
      parsedSignal: { ticker: 'SPY' },
      vision: {
        chart_type: 'candlestick',
        ticker: 'SPY',
        key_levels: [560, 560, '562.25'],
        support_levels: [558],
        resistance_levels: [565],
        bias: 'BULLISH',
        patterns: ['reclaim'],
        notes: 'visible reclaim',
      },
      model: 'test-model',
      now: new Date('2026-05-04T14:01:00.000Z'),
    });

    const processed = buildProcessedSignalFromVision(record);

    expect(record.source_class).toBe('chart');
    expect(record.parse_status).toBe('parsed_levels');
    expect(record.levels).toEqual([560, 562.25, 558, 565]);
    expect(processed.signal_type).toBe('CHART_ANALYSIS');
    expect(processed.source_type).toBe('vision');
    expect(processed.levels).toEqual(record.levels);
    expect(processed.entry_context.mode).toBe('human_gated_confluence_only');
  });

  it('persists heatmap parses separately while also feeding the processed stream', () => {
    const root = makeRoot();
    const record = buildKatVisionRecord({
      entry: {
        ts: '2026-05-04T14:05:00.000Z',
        message_id: 'm-heatmap',
        username: 'analyst2',
        channel_name: 'spy',
        content: '$SPX heatmap',
      },
      attachment: { id: 'h1', filename: 'heatmap.png', content_type: 'image/png', url: 'https://cdn/heatmap.png' },
      vision: {
        chart_type: 'heatmap',
        ticker: 'SPX',
        key_levels: [],
        support_levels: [5590],
        resistance_levels: [5625],
        heatmap_context: { king_nodes: [5600], gatekeeper_nodes: [5610], air_pockets: [5635], node_read: 'overhead resistance' },
        bias: 'BEARISH',
      },
    });

    const stored = appendKatVisionRecord(record, { rootDir: root });
    const visionRows = readKatVisionSignals({ rootDir: root });
    const processedText = fs.readFileSync(path.join(root, 'data', 'kat', 'processed-signals.jsonl'), 'utf8');

    expect(stored.processed.vision_source_class).toBe('heatmap');
    expect(visionRows).toHaveLength(1);
    expect(visionRows[0].source_class).toBe('heatmap');
    expect(processedText).toContain('"source_type":"vision"');
    expect(processedText).toContain('"heatmap_context"');
  });
});
