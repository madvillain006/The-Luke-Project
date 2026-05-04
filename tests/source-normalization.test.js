'use strict';

const {
  normalizeSourceFamily,
  normalizeTransport,
  normalizeLevelEvent,
} = require('../lib/trading-state/source-normalization');

describe('source normalization', () => {
  it('normalizes heatmap/GEX aliases into heatmap_gex', () => {
    for (const source of [
      'bobby_heatmap',
      'bobby_gex',
      'heatseeker',
      'jefe_heatmap',
      'mathemeatloaf_heatmap',
      'katbot_heatmap',
      'katbot_gex',
      'bobby',
    ]) {
      expect(normalizeSourceFamily(source)).toBe('heatmap_gex');
    }
  });

  it('retains transport separately from source family', () => {
    const normalized = normalizeLevelEvent({
      id: 'katbot-image-1',
      source: 'katbot_heatmap',
      source_type: 'heatmap',
      raw_path: 'discord/katbot/raw-feed.jsonl',
      tags: ['heatmap'],
    }, { price: 7100, role: 'king_node' });

    expect(normalized.source_family).toBe('heatmap_gex');
    expect(normalized.transport).toBe('katbot');
    expect(normalized.lifecycle).toBe('intraday_snapshot_expires_supersedes');
  });

  it('keeps plain Katbot context secondary when it is not parsed heatmap data', () => {
    expect(normalizeSourceFamily('katbot context')).toBe('katbot_context');
    expect(normalizeTransport('jefe_heatmap')).toBe('jefe');
  });
});
