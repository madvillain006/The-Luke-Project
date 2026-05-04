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
    expect(fs.existsSync(path.join(ROOT, 'docs', oldName))).toBe(false);
    expect(current).toContain('Local Replay Candles');
    expect(current).toContain('Wire a real delayed/live');
    for (const file of ['CURRENT_STATUS.md', 'REVIEW_READINESS.md', 'LIVE_BLOCKERS.md', 'CANDLE_FEED_AND_RUNTIME.md']) {
      const text = readDoc(file).toLowerCase();
      expect(text).not.toContain(oldWord);
      expect(text).not.toContain(oldOtherWord);
    }
  });
});
