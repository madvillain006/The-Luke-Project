'use strict';

const {
  parseArgs,
  selectImageJobs,
  heatmapCandidate,
} = require('../scripts/parse-kat-images');

describe('parse-kat-images script planning', () => {
  it('defaults to dry-run and requires explicit execute mode', () => {
    const args = parseArgs(['--limit', '5', '--resume', '--only', 'heatmap']);

    expect(args.execute).toBe(false);
    expect(args.resume).toBe(true);
    expect(args.limit).toBe(5);
    expect(args.only).toBe('heatmap');
  });

  it('selects chart and heatmap image jobs without downloading images', () => {
    const records = [
      {
        ts: '2026-05-04T14:00:00.000Z',
        message_id: 'chart-1',
        username: 'analyst1',
        channel_name: 'trade-floor',
        content: '$SPY reclaim chart',
        attachments: [{ id: 'a1', url: 'https://cdn/chart.png', filename: 'chart.png', content_type: 'image/png' }],
      },
      {
        ts: '2026-05-04T14:01:00.000Z',
        message_id: 'heat-1',
        username: 'analyst2',
        channel_name: 'trade-floor',
        content: '$SPX heatmap king node',
        attachments: [{ id: 'a2', url: 'https://cdn/heatmap.png', filename: 'heatmap.png', content_type: 'image/png' }],
      },
    ];

    const all = selectImageJobs(records, parseArgs([]), 'missing-root');
    const heatmaps = selectImageJobs(records, parseArgs(['--only', 'heatmap']), 'missing-root');
    const charts = selectImageJobs(records, parseArgs(['--only', 'chart']), 'missing-root');

    expect(all).toHaveLength(2);
    expect(heatmaps).toHaveLength(1);
    expect(charts).toHaveLength(1);
    expect(heatmapCandidate(records[1])).toBe(true);
  });
});
