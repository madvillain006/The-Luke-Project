'use strict';

const {
  classifyIndexTicker,
  extractIndexTickers,
  isSpxOptionsDirectTicker,
  normalizeIndexTicker,
} = require('../lib/kat-index-scope');

describe('Kat index scope', () => {
  it('keeps SPX options direct lane limited to SPX and SPY', () => {
    expect(isSpxOptionsDirectTicker('SPX')).toBe(true);
    expect(isSpxOptionsDirectTicker('SPY')).toBe(true);
    expect(isSpxOptionsDirectTicker('ES')).toBe(false);
    expect(isSpxOptionsDirectTicker('NQ')).toBe(false);
    expect(isSpxOptionsDirectTicker('QQQ')).toBe(false);
  });

  it('keeps QQQ/NDX/NQ in a separate confluence lane', () => {
    expect(classifyIndexTicker('QQQ').lane).toBe('qqq_ndx_nq_context');
    expect(classifyIndexTicker('NDX').lane).toBe('qqq_ndx_nq_context');
    expect(classifyIndexTicker('#NQ_F').lane).toBe('qqq_ndx_nq_context');
  });

  it('ignores single-name equities for this Katbot pass', () => {
    expect(normalizeIndexTicker('GLW')).toBeNull();
    expect(classifyIndexTicker('GLW').lane).toBe('ignored');
  });

  it('extracts only watched index tickers from analyst text', () => {
    const tickers = extractIndexTickers('$GLW bounce, $SPY calls, #NQ_F heatmap, NDX watch, SPXW flow');
    expect(tickers.sort()).toEqual(['NDX', 'NQ', 'SPX', 'SPY']);
  });
});
