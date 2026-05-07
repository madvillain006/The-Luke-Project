'use strict';

const {
  buildVisionGainsPosts,
  hydrateHeatmapsWithVision,
} = require('../lib/kat-stage2/ocr');

describe('Kat Stage 2 existing vision/OCR integration', () => {
  it('hydrates heatmap metadata from existing vision rows without running OCR', () => {
    const heatmaps = [{
      heatmap_id: 'h1',
      source_message_id: 'm1',
      symbol: null,
      extracted_levels: [],
      confluence_tags: [],
      parse_confidence: 0.45,
    }];
    const visionRow = {
      vision_id: 'v1',
      message_id: 'm1',
      source_class: 'heatmap',
      chart_type: 'heatmap',
      ticker: 'SPX',
      levels: [5300, 5325],
      notes: 'SPX heatmap levels 5300 and 5325',
      bias: 'bullish',
    };

    const result = hydrateHeatmapsWithVision(heatmaps, {
      visionIndex: new Map([['m1', [visionRow]]]),
    });

    expect(result.summary.heatmaps_hydrated).toBe(1);
    expect(result.heatmaps[0].symbol).toBe('SPX');
    expect(result.heatmaps[0].extracted_levels).toEqual([5300, 5325]);
    expect(result.heatmaps[0].confluence_tags).toContain('vision_heatmap');
  });

  it('creates unverified vision gains evidence from existing OCR text only', () => {
    const gains = buildVisionGainsPosts({
      rows: [{
        vision_id: 'v2',
        message_id: 'm2',
        ts: '2026-04-22T15:30:00.000Z',
        user_id: 'kaprik0rn3',
        analyst: 'kaprik0rn3',
        source_class: 'screenshot',
        notes: 'P/L screenshot sold SPX 0DTE 7300c .10 to .90 gains',
      }],
    });

    expect(gains).toHaveLength(1);
    expect(gains[0].verification_status).toBe('gains_only_unverified');
    expect(gains[0].option_ticker).toBe('O:SPXW260422C07300000');
    expect(gains[0].option_contract.entry_premium).toBe(0.10);
    expect(gains[0].option_contract.exit_premium).toBe(0.90);
  });
});
