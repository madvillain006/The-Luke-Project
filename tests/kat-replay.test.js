'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildKatReplay } = require('../lib/kat-replay');

const tempDirs = [];

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kat-replay-'));
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

describe('Kat replay', () => {
  it('dedupes raw Discord messages and keeps only index-scoped parsed signals', () => {
    const root = makeRoot();
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-01T13:30:00.000Z',
        message_id: 'spy-1',
        username: 'analyst',
        channel_name: 'trade-floor',
        content: '$SPY bullish above 560',
        attachments: [],
      },
      {
        ts: '2026-05-01T13:30:00.000Z',
        message_id: 'spy-1',
        username: 'analyst',
        channel_name: 'trade-floor',
        content: '$SPY bullish above 560',
        attachments: [],
      },
      {
        ts: '2026-05-01T13:31:00.000Z',
        message_id: 'glw-1',
        username: 'analyst',
        channel_name: 'trade-floor',
        content: '$GLW bullish above 80',
        attachments: [],
      },
      {
        ts: '2026-05-01T13:32:00.000Z',
        message_id: 'nq-1',
        username: 'analyst',
        channel_name: 'trade-floor',
        content: '#NQ_F bearish below 18000',
        attachments: [],
      },
    ]);

    const replay = buildKatReplay({ rootDir: root });
    expect(replay.summary.duplicate_message_ids_skipped).toBe(1);
    expect(replay.records).toHaveLength(2);
    expect(replay.records.map(r => r.ticker).sort()).toEqual(['NQ', 'SPY']);
    expect(replay.records.find(r => r.ticker === 'SPY').spx_options_direct).toBe(true);
    expect(replay.records.find(r => r.ticker === 'NQ').lane).toBe('qqq_ndx_nq_context');
  });

  it('preserves image evidence metadata for heatmap candidates', () => {
    const root = makeRoot();
    writeJsonl(path.join(root, 'data', 'kat', 'raw-feed.jsonl'), [
      {
        ts: '2026-05-01T13:30:00.000Z',
        message_id: 'img-1',
        username: 'analyst',
        channel_name: 'trade-floor',
        content: '$SPX heatmap',
        attachments: [{ id: 'a1', filename: 'spx.png', content_type: 'image/png', url: 'https://cdn.example/spx.png' }],
      },
    ]);

    const replay = buildKatReplay({ rootDir: root });
    expect(replay.records).toHaveLength(1);
    expect(replay.records[0].image_evidence.has_image).toBe(true);
    expect(replay.records[0].image_evidence.heatmap_candidate).toBe(true);
    expect(replay.records[0].image_evidence.parse_status).toBe('metadata_only');
  });
});
