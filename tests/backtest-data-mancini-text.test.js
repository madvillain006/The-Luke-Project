import { describe, it, expect } from 'vitest';
import { parseManciniText, _internal } from '../lib/backtest-data/mancini-text.js';

const {
  normalizeMojibake,
  parseRelativeTimestamp,
  reconstructDate,
  extractLevels,
  parseThreadHeader,
  candidateTradingDatesFromThreadHeader,
} = _internal;

// ── Small inline fixture ──────────────────────────────────────────────────────
// Three posts in most-recent-first order.
const FIXTURE = `The Duck Boat for Week of 4/26/2026 by tpdthreadmanager in ThePiratesDen

[–]Adam_Mankini 2 points an hour ago

7147 support given at 8am. Held exact. 7180 must reclaim to see 7186, 7193+.

Watch traps below 7147. 7135, 7121 below.

permalinksavecontextfull comments (1790)report
The Duck Boat for Week of 4/26/2026 by tpdthreadmanager in ThePiratesDen

[–]Adam_Mankini 4 points 1 day ago

Closing update: 7180 is resistance. Held as target zone. Chop between 7147-7180.

permalinksavecontextfull comments (1790)report
The Duck Boat for Week of 4/20/2026 by tpdthreadmanager in ThePiratesDen

[–]Adam_Mankini 3 points 1 month ago

Old post. Levels: 7050 support, 7100 target.

permalinksavecontextfull comments (1790)report
`;

// ── normalizeMojibake ─────────────────────────────────────────────────────────
describe('normalizeMojibake', () => {
  it('converts en-dash mojibake', () => {
    expect(normalizeMojibake('â€"')).toBe('–');
  });
  it('converts copyright symbol', () => {
    expect(normalizeMojibake('Â©')).toBe('©');
  });
  it('leaves clean text unchanged', () => {
    const clean = 'ES support at 7147';
    expect(normalizeMojibake(clean)).toBe(clean);
  });
});

// ── parseRelativeTimestamp ────────────────────────────────────────────────────
describe('parseRelativeTimestamp', () => {
  it('parses "an hour ago"', () => {
    const r = parseRelativeTimestamp('an hour ago');
    expect(r).toMatchObject({ value: 1, unit: 'hour' });
  });
  it('parses "17 hours ago"', () => {
    const r = parseRelativeTimestamp('17 hours ago');
    expect(r).toMatchObject({ value: 17, unit: 'hour' });
  });
  it('parses "1 day ago"', () => {
    const r = parseRelativeTimestamp('1 day ago');
    expect(r).toMatchObject({ value: 1, unit: 'day' });
  });
  it('parses "1 month ago"', () => {
    const r = parseRelativeTimestamp('1 month ago');
    expect(r).toMatchObject({ value: 1, unit: 'month' });
  });
  it('returns null for unrecognized format', () => {
    expect(parseRelativeTimestamp('yesterday')).toBeNull();
  });
  it('returns null for null input', () => {
    expect(parseRelativeTimestamp(null)).toBeNull();
  });
});

// ── reconstructDate ───────────────────────────────────────────────────────────
describe('reconstructDate', () => {
  const scrapeDate = '2026-04-29';

  it('returns scrapeDate for hour-level timestamps (high confidence)', () => {
    const relTs = { value: 1, unit: 'hour' };
    const r = reconstructDate(relTs, scrapeDate);
    expect(r.date).toBe('2026-04-29');
    expect(r.confidence).toBe('high');
  });

  it('subtracts 1 day for "1 day ago" (high confidence)', () => {
    const relTs = { value: 1, unit: 'day' };
    const r = reconstructDate(relTs, scrapeDate);
    expect(r.date).toBe('2026-04-28');
    expect(r.confidence).toBe('high');
  });

  it('subtracts 6 days (still high confidence)', () => {
    const relTs = { value: 6, unit: 'day' };
    const r = reconstructDate(relTs, scrapeDate);
    expect(r.date).toBe('2026-04-23');
    expect(r.confidence).toBe('high');
  });

  it('returns week confidence for "1 month ago"', () => {
    const relTs = { value: 1, unit: 'month' };
    const r = reconstructDate(relTs, scrapeDate);
    expect(r.confidence).toBe('week');
    expect(r.date).toBeNull();
  });

  it('returns low confidence when scrapeDate is null', () => {
    const relTs = { value: 1, unit: 'day' };
    const r = reconstructDate(relTs, null);
    expect(r.confidence).toBe('low');
    expect(r.date).toBeNull();
  });
});

// ── extractLevels ─────────────────────────────────────────────────────────────
describe('extractLevels', () => {
  it('extracts support levels', () => {
    const levels = extractLevels('7147 support given. 7135 below.');
    expect(levels.some(l => l.price === 7147 && l.role === 'support')).toBe(true);
  });

  it('extracts resistance levels', () => {
    const levels = extractLevels('7180 resistance must reclaim.');
    expect(levels.some(l => l.price === 7180)).toBe(true);
  });

  it('extracts target levels', () => {
    const levels = extractLevels('7186, 7193 are targets.');
    expect(levels.some(l => l.price === 7186 && l.role === 'target')).toBe(true);
    expect(levels.some(l => l.price === 7193 && l.role === 'target')).toBe(true);
  });

  it('tags watch_trap role', () => {
    const levels = extractLevels('Watch traps below 7147.');
    expect(levels.some(l => l.price === 7147 && l.role === 'watch_trap')).toBe(true);
  });

  it('deduplicates same price across multiple mentions', () => {
    const levels = extractLevels('7147 support. 7147 held again.');
    expect(levels.filter(l => l.price === 7147)).toHaveLength(1);
  });

  it('returns empty for content with no price-range numbers', () => {
    expect(extractLevels('Good morning everyone!')).toEqual([]);
  });
});

// ── parseThreadHeader ─────────────────────────────────────────────────────────
describe('parseThreadHeader', () => {
  it('extracts anchorDate from "Week of 4/26/2026"', () => {
    const h = parseThreadHeader('The Duck Boat for Week of 4/26/2026 by tpdthreadmanager in ThePiratesDen');
    expect(h).not.toBeNull();
    expect(h.anchorDate).toBe('2026-04-26');
  });

  it('returns null for non-header text', () => {
    expect(parseThreadHeader('7147 support today')).toBeNull();
  });

  it('builds candidate trading dates from thread anchor', () => {
    const h = parseThreadHeader('The Duck Boat for Week of 4/26/2026 by tpdthreadmanager in ThePiratesDen');
    expect(candidateTradingDatesFromThreadHeader(h)).toEqual([
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
    ]);
  });
});

// ── parseManciniText ──────────────────────────────────────────────────────────
describe('parseManciniText', () => {
  const posts = parseManciniText(FIXTURE, { scrapeDate: '2026-04-29' });

  it('extracts 3 posts', () => {
    expect(posts).toHaveLength(3);
  });

  it('first post is most recent (high confidence, scrapeDate)', () => {
    const first = posts[0];
    expect(first.timestampConfidence).toBe('high');
    expect(first.estimatedDate).toBe('2026-04-29');
  });

  it('second post is 1 day ago (high confidence)', () => {
    const second = posts[1];
    expect(second.estimatedDate).toBe('2026-04-28');
    expect(second.timestampConfidence).toBe('high');
  });

  it('third post is 1 month ago (week confidence with candidate dates)', () => {
    const third = posts[2];
    expect(third.timestampConfidence).toBe('week');
    expect(third.estimatedDate).toBeNull();
    expect(third.candidateTradingDates).toEqual([
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
      '2026-04-24',
      '2026-04-25',
    ]);
  });

  it('extracts score from post header', () => {
    expect(posts[0].score).toBe(2);
    expect(posts[1].score).toBe(4);
  });

  it('extracts levels from post content', () => {
    const first = posts[0];
    expect(first.levels.some(l => l.price === 7147)).toBe(true);
    expect(first.levels.some(l => l.price === 7180)).toBe(true);
  });

  it('includes thread header anchorDate', () => {
    expect(posts[0].threadHeader?.anchorDate).toBe('2026-04-26');
  });

  it('produces no parseWarnings for well-formed posts', () => {
    expect(posts[0].parseWarnings).toHaveLength(0);
  });

  it('works with no scrapeDate (all timestamps low confidence)', () => {
    const noPosts = parseManciniText(FIXTURE, { scrapeDate: null });
    expect(noPosts.every(p => ['low', 'week'].includes(p.timestampConfidence))).toBe(true);
  });
});
