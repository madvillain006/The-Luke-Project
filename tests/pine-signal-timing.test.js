'use strict';

const fs = require('fs');
const path = require('path');

const HARDMODE = path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch-hardmode.strategy.pine');
const SATY = path.join(__dirname, '..', 'tradingview', 'saty-atr-levels-source.pine');

describe('Pine hard-mode signal timing and repaint controls', () => {
  it('gates research signals on confirmed bars and next-bar entry timing', () => {
    const hardmode = fs.readFileSync(HARDMODE, 'utf8');

    expect(hardmode).toContain('barstate.isconfirmed');
    expect(hardmode).toContain('entry_timing_mode = input.string("next_bar_open"');
    expect(hardmode).toContain('bar_index > pending_signal_bar');
    expect(hardmode).toContain('pending_setup_bar');
    expect(hardmode).toContain('pending_confirmation_bar');
    expect(hardmode).toContain('pending_signal_bar');
    expect(hardmode).toContain('manual_entry_bar');
    expect(hardmode).toContain('"confirmed bars + lookahead_off"');
    expect(hardmode).not.toMatch(/offset\s*=\s*-\d+/);
  });

  it('uses strategy-safe Saty lookahead_off while preserving the display reference file', () => {
    const hardmode = fs.readFileSync(HARDMODE, 'utf8');
    const saty = fs.readFileSync(SATY, 'utf8');

    expect(hardmode).toContain('barmerge.lookahead_off');
    expect(hardmode).not.toContain('barmerge.lookahead_on');
    expect(hardmode).toContain('Strategy-safe Saty');
    expect(saty).toContain('barmerge.lookahead_on');
    expect(saty).toContain('indicator(');
    expect(saty).not.toContain('strategy(');
  });
});
