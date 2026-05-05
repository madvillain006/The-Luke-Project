'use strict';

const fs = require('fs');
const path = require('path');

const HARDMODE = path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch-hardmode.strategy.pine');

describe('Pine hard-mode same-bar ambiguity', () => {
  it('defaults ambiguous same-bar target/stop touches to stop-first hard mode', () => {
    const hardmode = fs.readFileSync(HARDMODE, 'utf8');

    expect(hardmode).toContain('same_bar_policy = input.string("stop_first_hard_mode"');
    expect(hardmode).toContain('target_first');
    expect(hardmode).toContain('ambiguous_exclude');
    expect(hardmode).toContain('ambiguous_report_only');
    expect(hardmode).toContain('pessimistic_same_bar = input.bool(true');
  });

  it('surfaces ambiguous count, conversions, and exclusions in manual accounting', () => {
    const hardmode = fs.readFileSync(HARDMODE, 'utf8');

    expect(hardmode).toContain('same_bar_ambiguous_count');
    expect(hardmode).toContain('wins_converted_to_losses');
    expect(hardmode).toContain('ambiguous_excluded_count');
    expect(hardmode).toContain('same_bar_ambiguous_count += 1');
    expect(hardmode).toContain('wins_converted_to_losses += 1');
    expect(hardmode).toContain('ambiguous_excluded_count += 1');
    expect(hardmode).toContain('"ambiguous"');
  });
});
