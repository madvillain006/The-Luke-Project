import { describe, it, expect } from 'vitest';
import {
  normalizeBobbyMessages,
  tradingDateET,
  extractLevelCandidates,
  extractMentionedInstruments,
  _internal,
} from '../lib/backtest-data/bobby-export.js';

const { isBobbyAuthor, normalizeMessage } = _internal;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeAuthor = (nickname, name = 'bobbyaxl') => ({ id: '1', name, nickname, discriminator: '0000' });

const MSG_BOBBY_WITH_ATT = {
  id: 'msg1',
  timestamp: '2026-03-10T09:15:00.000-04:00',
  author: makeAuthor('BOBBY'),
  content: 'SPX heatmap. King node at 5750. Support at 5700. #ES_F',
  attachments: [
    { id: 'att1', url: 'https://cdn.discordapp.com/attachments/123/456/screen.png', fileName: 'screen.png', fileSizeBytes: 100000 },
  ],
};

const MSG_BOBBY_NO_ATT = {
  id: 'msg2',
  timestamp: '2026-03-10T08:00:00.000-05:00',
  author: makeAuthor('BOBBY'),
  content: 'Good morning. ES support 5680, target 5750, 5780.',
  attachments: [],
};

const MSG_NON_BOBBY = {
  id: 'msg3',
  timestamp: '2026-03-10T10:00:00.000-04:00',
  author: { id: '2', name: 'randomuser', nickname: 'SOMEUSER', discriminator: '0000' },
  content: 'Thanks Bobby!',
  attachments: [],
};

const MSG_OLDER = {
  id: 'msg0',
  timestamp: '2026-02-28T15:30:00.000-05:00',
  author: makeAuthor('BOBBY'),
  content: 'Close recap. 4950 held, 5020 target hit.',
  attachments: [],
};

// ── isBobbyAuthor ─────────────────────────────────────────────────────────────
describe('isBobbyAuthor', () => {
  it('matches BOBBY nickname', () => {
    expect(isBobbyAuthor({ nickname: 'BOBBY', name: 'user123' })).toBe(true);
  });
  it('matches bobbyaxl name case-insensitively', () => {
    expect(isBobbyAuthor({ nickname: '', name: 'BOBBYAXL' })).toBe(true);
  });
  it('rejects non-Bobby authors', () => {
    expect(isBobbyAuthor({ nickname: 'SOMEUSER', name: 'person' })).toBe(false);
  });
  it('handles null author', () => {
    expect(isBobbyAuthor(null)).toBe(false);
  });
});

// ── tradingDateET ─────────────────────────────────────────────────────────────
describe('tradingDateET', () => {
  it('returns ET date from -04:00 offset timestamp', () => {
    expect(tradingDateET('2026-03-10T09:15:00.000-04:00')).toBe('2026-03-10');
  });
  it('returns ET date from -05:00 offset timestamp', () => {
    expect(tradingDateET('2026-03-10T08:00:00.000-05:00')).toBe('2026-03-10');
  });
  it('returns null for null input', () => {
    expect(tradingDateET(null)).toBe(null);
  });
});

// ── extractLevelCandidates ────────────────────────────────────────────────────
describe('extractLevelCandidates', () => {
  it('extracts price numbers in 4000–8999 range', () => {
    const levels = extractLevelCandidates('Support at 5700. King node 5750. Target 5780.');
    expect(levels).toContain(5700);
    expect(levels).toContain(5750);
    expect(levels).toContain(5780);
  });
  it('ignores numbers outside range', () => {
    const levels = extractLevelCandidates('Comment count 1790. Tiny 99. Huge 99999.');
    expect(levels).toHaveLength(0);
  });
  it('handles decimal prices', () => {
    const levels = extractLevelCandidates('Level at 5732.25 and 5700.50');
    expect(levels).toContain(5732.25);
    expect(levels).toContain(5700.5);
  });
  it('deduplicates repeated prices', () => {
    const levels = extractLevelCandidates('5700 held, then 5700 trapped.');
    expect(levels.filter(l => l === 5700)).toHaveLength(1);
  });
  it('returns empty array for empty string', () => {
    expect(extractLevelCandidates('')).toEqual([]);
  });
});

// ── extractMentionedInstruments ───────────────────────────────────────────────
describe('extractMentionedInstruments', () => {
  it('extracts ES from #ES_F', () => {
    expect(extractMentionedInstruments('Looking at #ES_F today')).toContain('ES');
  });
  it('extracts SPX from plain mention', () => {
    expect(extractMentionedInstruments('SPX heatmap')).toContain('SPX');
  });
  it('deduplicates instruments', () => {
    const instr = extractMentionedInstruments('ES held 5700, ES ran to 5750');
    expect(instr.filter(i => i === 'ES')).toHaveLength(1);
  });
  it('returns empty for no matches', () => {
    expect(extractMentionedInstruments('Good morning everyone')).toEqual([]);
  });
});

// ── normalizeMessage ──────────────────────────────────────────────────────────
describe('normalizeMessage', () => {
  it('extracts image URLs from image attachments', () => {
    const msg = normalizeMessage(MSG_BOBBY_WITH_ATT);
    expect(msg.imageUrls).toHaveLength(1);
    expect(msg.imageUrls[0]).toContain('screen.png');
  });
  it('marks attachment isImage correctly', () => {
    const msg = normalizeMessage(MSG_BOBBY_WITH_ATT);
    expect(msg.attachments[0].isImage).toBe(true);
  });
  it('populates tradingDateET', () => {
    const msg = normalizeMessage(MSG_BOBBY_WITH_ATT);
    expect(msg.tradingDateET).toBe('2026-03-10');
  });
  it('adds empty_content warning for blank messages', () => {
    const blank = { ...MSG_BOBBY_NO_ATT, content: '' };
    const msg = normalizeMessage(blank);
    expect(msg.parseWarnings).toContain('empty_content');
  });
});

// ── normalizeBobbyMessages ────────────────────────────────────────────────────
describe('normalizeBobbyMessages', () => {
  const input = [MSG_NON_BOBBY, MSG_OLDER, MSG_BOBBY_WITH_ATT, MSG_BOBBY_NO_ATT];

  it('filters to BOBBY messages only', () => {
    const out = normalizeBobbyMessages(input);
    expect(out.every(m => m.author.nickname === 'BOBBY')).toBe(true);
  });

  it('sorts messages ascending by timestamp', () => {
    const out = normalizeBobbyMessages(input);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].timestamp >= out[i - 1].timestamp).toBe(true);
    }
  });

  it('includes 3 BOBBY messages and excludes non-BOBBY', () => {
    const out = normalizeBobbyMessages(input);
    expect(out).toHaveLength(3);
  });

  it('includes level candidates in output', () => {
    const out = normalizeBobbyMessages(input);
    const withAtt = out.find(m => m.id === 'msg1');
    expect(withAtt.levelCandidates).toContain(5750);
    expect(withAtt.levelCandidates).toContain(5700);
  });
});
