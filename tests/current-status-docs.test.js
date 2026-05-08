'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readDoc(name) {
  return fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8');
}

describe('current status docs', () => {
  it('uses durable current-status naming', () => {
    const oldName = ['TO', 'NIGHT', '_WRA', 'PUP.md'].join('');
    const oldWord = ['to', 'night'].join('');
    const oldOtherWord = ['wra', 'pup'].join('');
    const current = readDoc('CURRENT_STATUS.md');

    expect(fs.existsSync(path.join(ROOT, 'docs', 'CURRENT_STATUS.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'LUKE_90_DAY_NOW_ROADMAP.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'LUKE_COMPANION_MEMORY.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'PINE_INVENTORY_AND_FLAGSHIP_GATE.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'docs', oldName))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'PINE_SLIPPAGE_HISTORICAL_AUDIT.md'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'TRADINGVIEW_HARDMODE_AUDIT.md'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'docs', 'TRADINGVIEW_HARDMODE_RESEARCH.md'))).toBe(true);
    expect(current).toContain('Local Replay Candles');
    expect(current).toContain('Wire a real delayed/live');
    expect(current).toContain('LUKE_90_DAY_NOW_ROADMAP.md');
    expect(current).toContain('PINE_INVENTORY_AND_FLAGSHIP_GATE.md');
    expect(current).toContain('PINE_INVENTORY_GENERATED.md');
    expect(current).toContain('prove:companion-memory');
    expect(readDoc('LUKE_90_DAY_NOW_ROADMAP.md')).toContain('No duplicate front routes');
    expect(readDoc('LUKE_COMPANION_MEMORY.md')).toContain('luke_companion_memory');
    expect(readDoc('PINE_INVENTORY_AND_FLAGSHIP_GATE.md')).toContain('visual/watchlist/research only');
    expect(readDoc('PINE_INVENTORY_AND_FLAGSHIP_GATE.md')).toContain('tradingview:inventory');
    for (const file of ['CURRENT_STATUS.md', 'REVIEW_READINESS.md', 'LIVE_BLOCKERS.md', 'CANDLE_FEED_AND_RUNTIME.md']) {
      const text = readDoc(file).toLowerCase();
      expect(text).not.toContain(oldWord);
      expect(text).not.toContain(oldOtherWord);
    }
  });
});
