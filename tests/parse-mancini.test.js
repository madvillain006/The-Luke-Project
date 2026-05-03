'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseManciniText, parseManciniTweet, parseManciniBatch, appendManciniToMemory } = require('../lib/parse-mancini');
const { recordLevel, queryLevels, _internal: { _setMemoryFile, _resetWriteFn } } = require('../lib/level-memory');
const { scoreLevel } = require('../lib/confluence-engine');

const DEFAULT_MEMORY_FILE = path.join(__dirname, '../data/level-memory.json');

function makeTempMemoryFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mancini-test-'));
  const file = path.join(dir, 'level-memory.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, last_updated: null, levels: [] }), 'utf8');
  return { dir, file };
}

describe('parseManciniText', () => {
  it('T1: extracts long trigger from reclaim text', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6809 reclaim was today\'s long trigger');
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        price: 6809,
        intent: 'long_trigger',
        trigger_type: 'reclaim',
        significance: 'key',
      }),
    ]));
  });

  it('T2: extracts first target with resistance direction in long context', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6809 reclaim was today\'s long trigger. 1st target was 6819 (hit).');
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        price: 6819,
        intent: 'first_target',
        significance: 'key',
        direction: 'resistance',
      }),
    ]));
  });

  it('T3: extracts bonus slate as three bonus targets', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 Bonus slate today remains 6846, 6854, 6872');
    const bonus = parsed.levels.filter(level => level.intent === 'bonus_target');
    expect(bonus).toHaveLength(3);
    expect(bonus.map(level => level.price)).toEqual([6846, 6854, 6872]);
    expect(bonus.every(level => level.significance === 'unclear')).toBe(true);
  });

  it('T4: extracts chop zone from slash shorthand', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6793/88 to 6830 = pure chop');
    expect(parsed.chop_zones).toEqual([
      expect.objectContaining({ low: 6788, high: 6830 }),
    ]);
  });

  it('T5: extracts failed breakdown pattern entry', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6593 Failed Breakdown long');
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        price: 6593,
        intent: 'failed_breakdown',
        direction: 'flip',
        significance: 'key',
      }),
    ]));
  });

  it('T6: parses Apr 9 morning multi-line plan tweet', () => {
    const parsed = parseManciniText(
      '@AdamMancini4 · Apr 9\n' +
      'No change: 6793/88 to 6830=pure chop. 6809 reclaims see 6819, 6830+. 6788 fails, sell 6781 (watch traps), 6766-70'
    );
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({ price: 6809, intent: 'long_trigger' }),
      expect.objectContaining({ price: 6819, intent: 'first_target' }),
      expect.objectContaining({ price: 6830, intent: 'second_target' }),
      expect.objectContaining({ price: 6781, intent: 'short_trigger' }),
    ]));
    expect(parsed.chop_zones).toEqual([
      expect.objectContaining({ low: 6788, high: 6830 }),
    ]);
  });

  it('T7: deduplicates repeated target mentions inside one tweet', () => {
    const parsed = parseManciniText(
      '@AdamMancini4 · Apr 9 1st target was 6819 (hit). 6819 held. 6819 again. 6809 reclaim was long trigger.'
    );
    const matches = parsed.levels.filter(level => level.price === 6819);
    expect(matches).toHaveLength(1);
    expect(matches[0].intent).toBe('first_target');
  });

  it('T8: rejects off-topic tweet', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 26 Less is more when it comes to day trading');
    expect(parsed.levels).toEqual([]);
    expect(parsed.parse_errors).toContain('no Mancini-format content detected');
  });

  it('T9: extracts ISO date from Apr 9 header', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6809 reclaim was today\'s long trigger');
    expect(parsed.date).toBe('2026-04-09');
  });

  it('T10: extracts range resistance without explicit intent', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6830 remains range res');
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        price: 6830,
        direction: 'resistance',
        significance: 'unclear',
        intent: null,
      }),
    ]));
  });

  it('T11: parses fail-stop plus short trigger', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6788 fails, sell 6781 (watch traps), 6766-70');
    expect(parsed.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        price: 6788,
        intent: 'stop',
        significance: 'key',
      }),
      expect.objectContaining({
        price: 6781,
        intent: 'short_trigger',
        trigger_type: 'fail',
      }),
    ]));
  });

  it('T12: rejects out-of-range price', () => {
    const parsed = parseManciniText('@AdamMancini4 · Apr 9 we\'re at 1000 next target');
    expect(parsed.levels).toEqual([]);
    expect(parsed.parse_errors.some(err => err.includes('1000'))).toBe(true);
  });

  it('defaults ambiguous instrument to ES and honors explicit SPX', () => {
    expect(parseManciniText('6809 reclaim was long trigger').instrument).toBe('ES');
    expect(parseManciniText('$SPX 5100 reclaim was long trigger').instrument).toBe('SPX');
  });

  it('parses Mancini support and target list clauses from May 1 style plan text', () => {
    const parsed = parseManciniText(
      'May 1 8am #ES_F plan: ES needs to digest and backtest. ' +
      '7245, 7198 (backtest) = supports. Sets up 7300, 7345, 7395 next. ' +
      'Prior working support 7265 and 7248 are supports. ' +
      'Bonus set were 7297, 7310, 7328. ' +
      'Just ride runner, now +155 from the most recent 7137 Failed Breakdown Wednesday.'
    );
    const byPrice = new Map(parsed.levels.map(level => [level.price, level]));

    for (const price of [7245, 7198, 7265, 7248]) {
      expect(byPrice.get(price)).toEqual(expect.objectContaining({
        direction: 'support',
      }));
    }

    for (const price of [7300, 7345, 7395]) {
      expect(byPrice.get(price)).toEqual(expect.objectContaining({
        direction: 'resistance',
      }));
    }

    expect(byPrice.get(7297)?.intent).toBe('bonus_target');
    expect(byPrice.get(7310)?.direction).toBe('resistance');
    expect(byPrice.has(7137)).toBe(false);
    expect(parsed.runner_active).toEqual({ trigger_price: 7137, points_paid: 155 });
  });

  it('keeps real May 1 Mancini supports and ignores all-hit target lists as fresh levels', () => {
    const parsed = parseManciniText(
      'Big Picture View: 1 week ago, when #ES_F was 7180, I posted it spent the week building a bull flag 7198-7080. I was looking for a breakout to 7300+, we got it\n\n' +
      'Plan Next Week: ES needs to digest this and backtest. 7245, 7198 (backtest) = supports. Sets up 7300, 7345, 7395 next\n\n' +
      'All targets hit #ES_F. Given at 8am they were 7287 main (hit). Bonus set were 7297 (exact high of day), 7310, 7328. I posted 2hrs ago 7265 was 1st support. Levels working - we hit 7266 and bounced.\n\n' +
      'Just ride runner, now +155 from the most recent 7137 Failed Breakdown Wednesday\n\n' +
      "May 1\nUntradable mid-day chop in #ES_F. Today's targets given at 8am were 7265, 7276, 7287 (all hit). Just nothing to do but hold runner until we get a sell. We are +154 points from Wednesday's 420PM Failed Breakdown\n\n" +
      '7265, 7248=supports x.com/AdamMancini4/s...\n1:56 PM · May 1, 2026'
    );
    const byPrice = new Map(parsed.levels.map(level => [level.price, level]));

    for (const price of [7198, 7245, 7248, 7265]) {
      expect(byPrice.get(price)).toEqual(expect.objectContaining({
        direction: 'support',
        intent: null,
      }));
    }

    for (const price of [7300, 7345, 7395]) {
      expect(byPrice.get(price)).toEqual(expect.objectContaining({
        direction: 'resistance',
      }));
    }

    expect(byPrice.has(7276)).toBe(false);
    expect(byPrice.has(7287)).toBe(false);
    expect(byPrice.has(7137)).toBe(false);
    expect(parsed.parse_errors.join('\n')).toContain('all-hit target list recorded as context only');
  });
});

describe('appendManciniToMemory', () => {
  afterEach(() => {
    _setMemoryFile(DEFAULT_MEMORY_FILE);
    _resetWriteFn();
  });

  it('T13: writes parsed Mancini levels into Level Memory', async () => {
    const temp = makeTempMemoryFile();
    _setMemoryFile(temp.file);

    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6809 reclaim was today\'s long trigger. 1st target was 6819 (hit).');
    await appendManciniToMemory(parsed);

    const levels = queryLevels({ instrument: 'ES' });
    expect(levels).toHaveLength(2);
    const trigger = levels.find(level => level.canonical_price === 6809);
    expect(trigger.mentions[0]).toEqual(expect.objectContaining({
      analyst: 'mancini',
      intent: 'long_trigger',
      source_type: 'text',
    }));
  });

  it('T14: contributes a distinct analyst to Phase 2 scoreLevel', async () => {
    const temp = makeTempMemoryFile();
    _setMemoryFile(temp.file);

    await recordLevel({
      analyst: 'dubz',
      instrument: 'ES',
      price: 7100,
      significance: 'key',
      direction: 'flip',
      intent: null,
      source_type: 'text',
      source_snippet: 'Dubz ES 7100 flip',
      timestamp: '2026-04-27T14:00:00.000Z',
    });

    const parsed = parseManciniText('@AdamMancini4 · Apr 27 7100 reclaim was today\'s long trigger');
    await appendManciniToMemory(parsed);

    const levels = queryLevels({ instrument: 'ES' });
    expect(levels).toHaveLength(1);

    const scored = scoreLevel(levels[0]);
    expect(scored.breakdown.distinct_analysts_contribution).toBeCloseTo(0.40, 5);
  });

  it('T16: chop zone prices are NOT written to Level Memory', async () => {
    const temp = makeTempMemoryFile();
    _setMemoryFile(temp.file);

    const parsed = parseManciniText('@AdamMancini4 · Apr 9 6793/88 to 6830 = pure chop. 6809 reclaims see 6819.');
    await appendManciniToMemory(parsed);

    const levels = queryLevels({ instrument: 'ES' });
    // 6788, 6793, 6830 are chop zone prices — must not appear in Level Memory
    const prices = levels.map(l => l.canonical_price);
    expect(prices).not.toContain(6788);
    expect(prices).not.toContain(6793);
    expect(prices).not.toContain(6830);
    // The trigger and target should still be written
    expect(prices).toContain(6809);
  });
});

describe('parseManciniTweet additional fields', () => {
  it('T8-noTrade: no_trade_signal true when no-trade phrase present', () => {
    const result = parseManciniTweet('No elevator down sell = no trading for me. Period');
    expect(result.no_trade_signal).toBe(true);
  });

  it('T8-noTrade: no_trade_signal false when phrase absent', () => {
    const result = parseManciniTweet('@AdamMancini4 · Apr 9 6809 reclaim was long trigger');
    expect(result.no_trade_signal).toBe(false);
  });

  it('T9-runner: runner_active extracted from +280 reclaim text', () => {
    const result = parseManciniTweet(
      "Little to do now but let the runner pay, which is now +280 points from Tuesday's 6592 reclaim long."
    );
    expect(result.runner_active).toEqual({ trigger_price: 6592, points_paid: 280 });
    expect(result.levels.map(level => level.price)).not.toContain(6592);
    expect(result.parse_errors.some(error => error.includes('context only'))).toBe(true);
  });

  it('T10-hitStatus: hit_status=hit when (hit) follows price', () => {
    const result = parseManciniTweet(
      '@AdamMancini4 · Apr 9 6809 reclaim was long trigger. 1st target was 6819 (hit). 2nd target 6830.'
    );
    const l6819 = result.levels.find(l => l.price === 6819);
    const l6830 = result.levels.find(l => l.price === 6830);
    expect(l6819).toBeTruthy();
    expect(l6819.hit_status).toBe('hit');
    expect(l6830).toBeTruthy();
    expect(l6830.hit_status).toBe('pending');
  });

  it('T10-hitExact: (hit exact) also sets hit_status=hit', () => {
    const result = parseManciniTweet('6872 (hit exact) — Bonus/breakout slate were 6846 (hit), 6854 (hit), 6872 (hit exact)');
    const l6872 = result.levels.find(l => l.price === 6872);
    expect(l6872?.hit_status).toBe('hit');
  });

  it('T11-batch: parseManciniBatch deduplicates levels across sections', () => {
    const text = [
      '## [2026-04-09 — morning]\n> 6809 reclaim was long trigger. 1st target 6819.',
      '## [2026-04-09 — midday]\n> 6809 reclaim was long trigger. 1st target 6819 (hit). Bonus 6846, 6854.',
    ].join('\n\n');
    const batch = parseManciniBatch(text);
    expect(batch.tweets.length).toBeGreaterThanOrEqual(1);
    const prices = batch.deduped_levels.map(l => l.price);
    expect(prices.filter(p => p === 6809)).toHaveLength(1);
    // Most-specific intent kept — long_trigger > first_target > bonus_target
    const l6809 = batch.deduped_levels.find(l => l.price === 6809);
    expect(l6809?.intent).toBe('long_trigger');
    // tweet_count shows repetition
    expect(l6809?.tweet_count).toBeGreaterThanOrEqual(2);
  });

  it('T12-bracketDate: tweet_timestamp from bracket header resolves to ISO with ET offset', () => {
    const result = parseManciniTweet('## [2026-04-09 — opening setup]\n> 6809 reclaim was long trigger');
    expect(result.tweet_timestamp).toBe('2026-04-09T12:00:00-04:00');
  });
});

describe('Gate 1B — Reddit format support', () => {
  it('T17: multi-tweet Reddit comment splits on embedded timestamps and merges levels', () => {
    // Comment 1 from 2026-04-22 in the archive: 3 sub-tweets with 07:56/07:57/07:58AM prefixes
    const raw = [
      '04/22/2026 07:56AM - Last eve after 4pm we got a textbook Failed Breakdown. ' +
        'Setup was Failed Breakdown of 7097. Target was 7147, hit\n\n' +
        'Plan: Ride runner. 7153, 7165, 7180 next up. 7135, 7120 (watch traps)=supports',
      '04/22/2026 07:57AM - Note: there is nothing to do now. No elevator down sell = no trading for me.',
      '04/22/2026 07:58AM - I repeat this every single day to take my points out.',
    ].join('\n\n');

    const result = parseManciniTweet(raw);

    // Should split into 3 sub-tweets
    expect(result.sub_tweets).toHaveLength(3);

    // Levels from sub-tweet 1 should be present in merged result
    const prices = result.levels.map(l => l.price);
    expect(prices).toContain(7097);
    expect(prices).toContain(7147);

    // no_trade_signal from sub-tweet 2 propagates up
    expect(result.no_trade_signal).toBe(true);

    // Each sub-tweet has its own timestamp
    expect(result.sub_tweets[0].tweet_timestamp).toBe('2026-04-22T07:56:00-04:00');
    expect(result.sub_tweets[1].tweet_timestamp).toBe('2026-04-22T07:57:00-04:00');
  });

  it('T18: pure-narrative post returns narrative_only=true with empty levels', () => {
    const raw = '## [2026-04-18 — philosophy]\n> The biggest game changer for my trading was stopping myself whenever I have a "prediction thought". Its irrelevant. Plan your levels, plan your setup, plan your triggers, wait on price to pick 1, react';
    const result = parseManciniTweet(raw);
    expect(result.narrative_only).toBe(true);
    expect(result.levels).toHaveLength(0);
    expect(result.parse_errors.some(e => e.includes('narrative-only'))).toBe(true);
  });

  it('T19: tight-range syntax emits two levels with shared direction', () => {
    const result = parseManciniTweet('@AdamMancini4 · Apr 20 7147-53 was today\'s support');
    const prices = result.levels.map(l => l.price);
    expect(prices).toContain(7147);
    expect(prices).toContain(7153);
    const l7147 = result.levels.find(l => l.price === 7147);
    const l7153 = result.levels.find(l => l.price === 7153);
    expect(l7147.direction).toBe('support');
    expect(l7153.direction).toBe('support');
  });

  it('T20: wide-flag syntax emits one chop_zone, NOT two levels', () => {
    const result = parseManciniTweet('@AdamMancini4 · Apr 22 7085-7185 remains a massive flag');
    expect(result.chop_zones).toHaveLength(1);
    expect(result.chop_zones[0].low).toBe(7085);
    expect(result.chop_zones[0].high).toBe(7185);
    // Boundary prices marked as chop_boundary in levels, not as regular S/R
    const nonChop = result.levels.filter(l => l.intent !== 'chop_boundary');
    expect(nonChop.some(l => l.price === 7085 || l.price === 7185)).toBe(false);
  });

  it('T21: trap_warning flag set when "watch traps" appears near price', () => {
    const result = parseManciniTweet('@AdamMancini4 · Apr 20 7120 (watch traps)=support');
    const l7120 = result.levels.find(l => l.price === 7120);
    expect(l7120).toBeTruthy();
    expect(l7120.trap_warning).toBe(true);
  });

  it('T22: time-of-day inference from "Closing update" resolves to 16:00 ET', () => {
    const result = parseManciniTweet(
      '### Comment 9 (closing update, ~4PM)\n' +
      '> Closing update #ES_F: 7058 support continues to defend. Newsletter out soon.'
    );
    // Apr 17 is EDT so offset is -04:00; "Closing update" → 16:00
    expect(result.tweet_timestamp).toMatch(/T16:00:00-\d{2}:00/);
  });
});
