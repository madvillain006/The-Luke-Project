'use strict';

const { buildStoredHeatmapAnswer } = require('../lib/heatmap-context');

describe('stored heatmap follow-up answers', () => {
  it('answers heatmap questions from the parsed Bobby image state', () => {
    const now = new Date('2026-05-03T10:00:00.000Z');
    const reply = buildStoredHeatmapAnswer('tell me about the heatmap', {
      now,
      levels: {
        date: '2026-05-03',
        bobby: [{
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-03T09:53:36.373Z',
          bias: 'BULLISH',
          trinity: true,
          king_nodes: [7175, 715, 664],
          support: [7200, 7150, 709, 708, 673, 662],
          resistance: [7240],
          air_pockets: [],
          notes: 'SPXW anchors at 7175 with 7200 acting as overhead resistance.',
          panels: [
            { ticker: 'SPXW', current_price: 7230.12, king_nodes: [7175], support: [7200, 7150], resistance: [7240] },
            { ticker: 'SPY', current_price: 720.65, king_nodes: [715], support: [709, 708], resistance: [] },
          ],
        }],
      },
    });

    expect(reply).toContain('Yes, the heatmap is stored');
    expect(reply).toContain('Source: bobby-vision via vision');
    expect(reply).toContain('Bias: BULLISH; trinity view parsed');
    expect(reply).toContain('King nodes: 7175, 715, 664');
    expect(reply).toContain('SPXW: image price 7230.12; kings 7175; support 7200, 7150; resistance 7240.');
    expect(reply).toContain('stored image-derived context, not live price');
    expect(reply).not.toContain("can't see images");
  });

  it('does not claim missing data when the image receipt exists but node parse is absent', () => {
    const reply = buildStoredHeatmapAnswer('what was in the heatmap image?', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: { date: '2026-05-03', bobby: [] },
      dailyContext: { heatmap: { source: 'image', stored_at: '2026-05-03T09:53:28.170Z' } },
      events: [],
    });

    expect(reply).toContain('heatmap marked as received from image');
    expect(reply).toContain("do not have parsed Bobby node details");
    expect(reply).not.toContain('No Bobby heatmap is loaded');
  });

  it('treats direct references to the supplied image as stored heatmap follow-ups', () => {
    const reply = buildStoredHeatmapAnswer('WHAT. ITS IN THAT IMAGE', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: {
        date: '2026-05-03',
        bobby: [{
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-03T09:53:36.373Z',
          bias: 'BULLISH',
          king_nodes: [7175],
          support: [7200],
          resistance: [7240],
          panels: [],
        }],
      },
    });

    expect(reply).toContain('Yes, the heatmap is stored');
    expect(reply).toContain('King nodes: 7175');
    expect(reply).not.toContain("can't see images");
  });

  it('answers correction-style follow-ups after the heatmap was stored', () => {
    const reply = buildStoredHeatmapAnswer('i just gave it to you', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: {
        date: '2026-05-03',
        bobby: [{
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-03T09:53:36.373Z',
          bias: 'BULLISH',
          king_nodes: [7175],
          support: [7200],
          resistance: [7240],
          panels: [],
        }],
      },
    });

    expect(reply).toContain('Yes, the heatmap is stored');
    expect(reply).toContain('Support/floors: 7200');
  });

  it('does not turn a plain acknowledgement into a heatmap summary', () => {
    const reply = buildStoredHeatmapAnswer('got it', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: {
        date: '2026-05-03',
        bobby: [{
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-03T09:53:36.373Z',
          king_nodes: [7175],
        }],
      },
    });

    expect(reply).toBe(null);
  });

  it('does not show epoch age for text heatmaps without a per-row timestamp', () => {
    const reply = buildStoredHeatmapAnswer('tell me about the heatmap', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: {
        date: '2026-05-03',
        bobby: [{
          source: 'bobby-text',
          bias: 'BULLISH',
          king_nodes: [7175],
          support: [],
          resistance: [],
        }],
      },
      events: [],
    });

    expect(reply).toContain('age 0m ago');
    expect(reply).toContain('stored text-derived heatmap context');
    expect(reply).not.toContain('493');
    expect(reply).not.toContain('1970');
  });

  it('falls back to the durable Bobby event log when today levels are absent', () => {
    const reply = buildStoredHeatmapAnswer('tell me about the heatmap', {
      now: new Date('2026-05-03T10:00:00.000Z'),
      levels: null,
      dailyContext: { heatmap: { source: 'image', stored_at: '2026-05-03T09:53:28.170Z' } },
      events: [
        {
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-02T18:30:00.000Z',
          king_nodes: [7125],
        },
        {
          source: 'bobby-vision',
          vision_parsed: true,
          date: '2026-05-03T09:53:36.373Z',
          bias: 'BULLISH',
          trinity: true,
          king_nodes: [7175, 715, 664],
          support: [7200, 7150],
          resistance: [7240],
          panels: [
            { ticker: 'SPXW', current_price: 7230.12, king_nodes: [7175], support: [7200, 7150], resistance: [7240] },
          ],
        },
      ],
    });

    expect(reply).toContain('Yes, the heatmap is stored');
    expect(reply).toContain('Bias: BULLISH; trinity view parsed');
    expect(reply).toContain('King nodes: 7175, 715, 664');
    expect(reply).toContain('SPXW: image price 7230.12; kings 7175');
  });
});
