'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  hasLevelsLoadedToday,
  levelsLoadedLabel,
  makeLevelsWarningPayload,
  appendBobbyVisionResult,
} = require('../lib/today-levels-shim');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-today-levels-'));
  return path.join(dir, 'today-levels.json');
}

describe('today-levels-shim', () => {
  it('reports loaded only when Bobby or Richy levels exist for the current date', () => {
    const file = tempFile();
    const now = new Date('2026-04-29T13:00:00.000Z');

    fs.writeFileSync(file, JSON.stringify({ date: '2026-04-28', richyd: [{}], bobby: [] }), 'utf8');
    expect(hasLevelsLoadedToday(file, now)).toBe(false);
    expect(levelsLoadedLabel(file, now)).toBe('NO');

    fs.writeFileSync(file, JSON.stringify({ date: '2026-04-29', richyd: [], bobby: [{}] }), 'utf8');
    expect(hasLevelsLoadedToday(file, now)).toBe(true);
    expect(levelsLoadedLabel(file, now)).toBe('YES');
  });

  it('returns a stable WebSocket warning payload when levels are missing', () => {
    expect(makeLevelsWarningPayload()).toEqual({
      type: 'levels_warning',
      message: 'Warning: No levels loaded. Paste /heatmap [Bobby text] before trading.',
    });
  });

  it('appends Bobby vision results under today instead of preserving a stale date', () => {
    const file = tempFile();
    const now = new Date('2026-04-29T14:15:00.000Z');
    fs.writeFileSync(file, JSON.stringify({
      date: '2026-04-28',
      richyd: [{ level: 7100 }],
      bobby: [{ source: 'old' }],
    }), 'utf8');

    const saved = appendBobbyVisionResult(file, {
      king_nodes: [7200],
      resistance: [7210],
      support: [7190],
      air_pockets: [],
      bias: 'bullish',
    }, now);

    expect(saved.date).toBe('2026-04-29');
    expect(saved.richyd).toEqual([]);
    expect(saved.bobby).toHaveLength(1);
    expect(saved.bobby[0]).toMatchObject({
      source: 'bobby-vision',
      date: '2026-04-29T14:15:00.000Z',
      king_nodes: [7200],
    });
    expect(hasLevelsLoadedToday(file, now)).toBe(true);
  });
});

