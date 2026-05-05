const {
  classifyBarTouch,
  firstTouchOutcome,
} = require('../lib/research/pine-slippage-audit/same-bar-policy');

function bar(timestamp, high, low, close = 100) {
  return { timestamp, open: close, high, low, close };
}

describe('pine same-bar policy', () => {
  it('classifies target-only, stop-only, both, and neither 1m bars', () => {
    expect(classifyBarTouch(bar('2026-04-24T09:31:00-04:00', 103, 100), { stopPrice: 98, targetPrice: 102 })).toBe('target_only');
    expect(classifyBarTouch(bar('2026-04-24T09:31:00-04:00', 101, 97), { stopPrice: 98, targetPrice: 102 })).toBe('stop_only');
    expect(classifyBarTouch(bar('2026-04-24T09:31:00-04:00', 103, 97), { stopPrice: 98, targetPrice: 102 })).toBe('both_same_bar');
    expect(classifyBarTouch(bar('2026-04-24T09:31:00-04:00', 101, 99), { stopPrice: 98, targetPrice: 102 })).toBe('neither');
  });

  it('resolves same-bar stop-first hard mode as a converted loss', () => {
    const outcome = firstTouchOutcome({
      bars: [bar('2026-04-24T09:31:00-04:00', 103, 97)],
      entryTimestamp: '2026-04-24T09:31:00-04:00',
      entryPrice: 100,
      stopPrice: 98,
      targetPrice: 102,
      policy: 'stop_first_hard',
    });
    expect(outcome.outcome).toBe('ambiguous_stop_first');
    expect(outcome.winConvertedToLoss).toBe(true);
    expect(outcome.exit_price).toBe(98);
  });

  it('can exclude ambiguous bars without pretending they were clean wins', () => {
    const outcome = firstTouchOutcome({
      bars: [bar('2026-04-24T09:31:00-04:00', 103, 97)],
      entryTimestamp: '2026-04-24T09:31:00-04:00',
      entryPrice: 100,
      stopPrice: 98,
      targetPrice: 102,
      policy: 'ambiguous_exclude',
    });
    expect(outcome.outcome).toBe('ambiguous_excluded');
    expect(outcome.excluded).toBe(true);
    expect(outcome.exit_price).toBe(100);
  });
});
