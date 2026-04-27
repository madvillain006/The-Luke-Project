'use strict';

const { detectPasteIntent } = require('../lib/detect-paste');
const { classifyPaste } = require('../lib/daily-accumulator');

describe('Richy/Dubz paste routing regressions', () => {
  it('routes Richy analyst text to /dubz instead of legacy /levels', () => {
    const result = detectPasteIntent('RichyDubz ES flipped 7185.75 and SPY 712.38 premarket.', false);
    expect(result.command).toBe('/dubz');
    expect(result.detectedAnalyst).toBe('richy');
  });

  it('does not classify Richy analyst text as a Ximes alert', () => {
    const result = classifyPaste('RichyDubz ES flipped 7185.75 and SPY 712.38 premarket.');
    expect(result.type).toBeNull();
  });
});
