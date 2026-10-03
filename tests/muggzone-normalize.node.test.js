'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMessage } = require('../lib/muggzone/normalize');

function message(raw_text, extra = {}) {
  return { message_id: 'm1', channel_id: 'options', author_id: 'analyst', raw_text, timestamp_utc: '2026-10-03T14:00:00.000Z', observed_at: '2026-10-03T14:04:00.000Z', ...extra };
}

const normalize = (text, extra) => normalizeMessage(message(text, extra));
const actions = result => result.instructions.map(item => item.action);

test('explicit option entry becomes one OPEN with a price plan, not target-hit events', () => {
  const result = normalize('Buying SPY 10/9/2026 600c @ 1.25 stop .75 TP1 2.00 TP2 2.50 TP3 3.00');
  assert.equal(result.status, 'normalized');
  assert.deepEqual(result.instructions, [{ action: 'OPEN', contract: { underlying: 'SPY', expiration_date: '2026-10-09', strike: 600, option_side: 'CALL' }, symbol: 'SPY', premium: 1.25, stop: 0.75, targets: [{ target_number: 1, premium: 2 }, { target_number: 2, premium: 2.5 }, { target_number: 3, premium: 3 }] }]);
  assert.equal(result.parsed.normalization_provenance.source_parser, 'parseTradeCall');
});

test('lowercase contracts, puts, and paid entries preserve explicit premium', () => {
  const result = normalize('bought mu 10/9 500 puts paid 2.85 stop 2.20 target 4.00');
  assert.equal(result.status, 'normalized');
  assert.equal(result.instructions[0].contract.underlying, 'MU');
  assert.equal(result.instructions[0].contract.option_side, 'PUT');
  assert.equal(result.instructions[0].premium, 2.85);
  assert.deepEqual(result.instructions[0].targets, [{ target_number: 1, premium: 4 }]);
});

test('unknown entry premium stays null and strike is never its substitute', () => {
  const result = normalize('buy SPY 10/9 600c here stop .75');
  assert.equal(result.status, 'normalized');
  assert.equal(result.instructions[0].premium, null);
});

test('missing expiry and missing underlying require review without SPX heuristic authority', () => {
  assert.equal(normalize('Buy SPY 600c @ 1.25').reason, 'explicit_expiration_required');
  const result = normalize('Buy 10/9 7300c @ 1.25');
  assert.equal(result.status, 'review');
  assert.equal(result.reason, 'explicit_underlying_required');
  assert.equal(result.parsed.option_contract.underlying, 'SPX');
  assert.deepEqual(result.instructions, []);
});

test('invalid dates, three-digit years, and expired entries are rejected', () => {
  for (const expiry of ['2/30/2026', '13/9/2026', '0/9/2026', '2/29/2026']) assert.equal(normalize(`Buy SPY ${expiry} 600c @ 1.25`).status, 'review', expiry);
  assert.equal(normalize('Buy SPY 10/9/202 600c @ 1.25').status, 'review');
  assert.equal(normalize('Buy SPY 10/2/2026 600c @ 1.25').reason, 'expiration_precedes_published_date');
  assert.equal(normalize('Buy SPY 2/29/2028 600c @ 1.25').status, 'normalized');
});

test('ISO and named dates are valid explicit dates without timestamp defaults', () => {
  for (const expiry of ['2026-10-09', 'OCT 9 2026']) {
    const result = normalize(`Buy SPY ${expiry} 600c @ 1.25`, { timestamp_utc: null });
    assert.equal(result.status, 'normalized');
    assert.equal(result.instructions[0].contract.expiration_date, '2026-10-09');
    assert.equal(result.parsed.normalization_provenance.expiry[0].resolution, 'explicit_calendar_date');
  }
});

test('year-less expiry resolves only from published timestamp in New York with provenance', () => {
  const result = normalize('Buy SPY 12/31 600c @ 1.25', { timestamp_utc: '2026-01-01T00:30:00Z', observed_at: '2030-01-01T12:00:00Z' });
  assert.equal(result.status, 'normalized');
  assert.equal(result.instructions[0].contract.expiration_date, '2025-12-31');
  assert.equal(result.parsed.normalization_provenance.published_date_et, '2025-12-31');
  assert.equal(result.parsed.normalization_provenance.expiry[0].resolution, 'explicit_month_day_year_from_published_timestamp_et');
  assert.equal(normalize('Buy SPY 10/9 600c @ 1.25', { timestamp_utc: null }).reason, 'expiry_requires_published_timestamp');
  assert.equal(normalize('Buy SPY 10/9 600c @ 1.25', { timestamp_utc: '2026-02-30T12:00:00Z' }).status, 'review');
});

test('0DTE uses published ET day; nonzero DTE is left for explicit-date review', () => {
  const result = normalize('Buy SPX 0DTE 7300c paid 1.25', { timestamp_utc: '2026-01-01T00:30:00Z' });
  assert.equal(result.status, 'normalized');
  assert.equal(result.instructions[0].contract.expiration_date, '2025-12-31');
  assert.equal(normalize('Buy SPX 0DTE 7300c paid 1.25', { timestamp_utc: null }).status, 'review');
  assert.equal(normalize('Buy SPX 3DTE 7300c paid 1.25').reason, 'nonzero_dte_requires_explicit_expiry');
});

test('each TP1/2/3 hit is management; target numbers never become premiums', () => {
  for (const n of [1, 2, 3]) {
    const result = normalize(`TP${n} hit`);
    assert.equal(result.status, 'normalized');
    assert.deepEqual(result.instructions, [{ action: 'TARGET_HIT', contract: null, symbol: null, premium: null, target_number: n }]);
    assert.equal(result.parsed.normalization_provenance.source_parser, 'parseTradeUpdate');
  }
  assert.deepEqual(actions(normalize('hit target 2 at 2.50')), ['TARGET_HIT']);
  assert.equal(normalize('hit target 2 at 2.50').instructions[0].premium, 2.5);
  assert.equal(normalize('TP1 2.00').status, 'review');
});

test('compound target, trim and breakeven management emits all actions once', () => {
  const result = normalize('TP1 hit trim 50% move stops to breakeven');
  assert.deepEqual(actions(result), ['TARGET_HIT', 'TRIM', 'BREAKEVEN']);
  assert.equal(result.instructions[1].fraction, 0.5);
  assert.ok(result.instructions.every(item => item.premium === null));
  assert.deepEqual(actions(normalize('TP1 hit TP2 hit all out at 3.00')), ['TARGET_HIT', 'TARGET_HIT', 'CLOSE']);
  assert.deepEqual(actions(normalize('TP1 hit TP1 hit trim 50%')), ['TARGET_HIT', 'TRIM']);
});

test('trim supports percentages and explicit fractions; unspecified amount stays valid and null', () => {
  for (const text of ['trim 50%', 'take 50%', 'taking half', 'scaling out half', 'trim half', 'trim 1/2', 'closed 50%', 'sell 50%']) {
    const result = normalize(text);
    assert.deepEqual(actions(result), ['TRIM'], text);
    assert.equal(result.instructions[0].fraction, 0.5, text);
    assert.equal(result.instructions[0].premium, null, text);
  }
  const unspecified = normalize('trim here +100%');
  assert.equal(unspecified.status, 'normalized');
  assert.equal(unspecified.instructions[0].fraction, null);
  assert.equal(unspecified.instructions[0].premium, null);
  for (const text of ['trim 0%', 'trim 150%', 'trim 1/0']) assert.equal(normalize(text).status, 'review', text);
});

test('prices are action-local rather than harvested from targets, strikes, dates or percentages', () => {
  const result = normalize('SPY 10/9 600c TP1 hit trim 50% at 2.50 move stop to 1.25');
  assert.equal(result.status, 'normalized');
  assert.equal(result.instructions[0].premium, null);
  assert.equal(result.instructions[1].premium, 2.5);
  assert.equal(result.instructions[2].premium, null);
  assert.equal(result.instructions[2].stop, 1.25);
  assert.equal(normalize('Buy SPY 10/9 600c at 50%').instructions[0].premium, null);
  assert.equal(normalize('Buy SPY 10/9 600c at 10/9').instructions[0].premium, null);
  assert.equal(normalize('Buy SPY 10/9 600c @ 600c').status, 'review');
});

test('stop moves require numeric price, and BE produces a single breakeven instruction', () => {
  assert.deepEqual(normalize('move stops to .75').instructions, [{ action: 'MOVE_STOP', contract: null, symbol: null, premium: null, stop: 0.75 }]);
  for (const text of ['move stops to BE', 'stop to entry', 'breakeven', 'break even', 'b/e', 'BE']) assert.deepEqual(actions(normalize(text)), ['BREAKEVEN'], text);
  assert.equal(normalize('move stop').reason, 'stop_move_price_required');
  assert.equal(normalize('move stop to 50%').status, 'review');
  assert.equal(normalize('move stop to 1.00 and breakeven').reason, 'conflicting_stop_instructions');
});

test('stop hits, closes, cancellation, and adds normalize independently', () => {
  for (const text of ['stopped', 'stopped out', 'stop hit']) assert.deepEqual(actions(normalize(text)), ['STOP_HIT'], text);
  for (const text of ['closed', 'close SPY', 'Closing SPY', 'Closing the SPY trade', 'Exiting SPY', 'STC SPY', 'all out', 'out at 2.50', 'cut', 'sell to close']) assert.deepEqual(actions(normalize(text)), ['CLOSE'], text);
  assert.deepEqual(actions(normalize('cancel SPY')), ['CANCEL']);
  assert.deepEqual(actions(normalize('added SPY at 1.20')), ['ADD']);
  assert.deepEqual(actions(normalize('add SPY at 1.20')), ['ADD']);
  assert.equal(normalize('cancel stop').status, 'review');
});

test('management containing a complete contract is never another OPEN', () => {
  const result = normalize('closed SPY 10/9 600 calls at 2.50');
  assert.equal(result.status, 'normalized');
  assert.deepEqual(actions(result), ['CLOSE']);
  assert.equal(result.parsed.normalization_provenance.source_parser, 'parseTradeUpdate');
  assert.equal(result.instructions[0].contract.strike, 600);
  assert.equal(result.instructions[0].premium, 2.5);
});

test('partial management selectors and reply keys survive for conservative ledger linking', () => {
  const result = normalize('SPY 600p trim', { reply_to_message_id: 'original-call' });
  assert.equal(result.status, 'normalized');
  assert.deepEqual(result.instructions[0].contract_hint, { underlying: 'SPY', strike: 600, option_side: 'PUT' });
  assert.equal(result.instructions[0].contract, null);
  assert.equal(result.instructions[0].reply_to_message_id, 'original-call');
  assert.equal(result.instructions[0].fraction, null);
  assert.equal(normalize('SPY trim').instructions[0].symbol, 'SPY');
  assert.deepEqual(normalize('SPY 10/9 close').instructions[0].contract_hint, { underlying: 'SPY', expiration_date: '2026-10-09' });
});

test('uppercase management words do not become ticker identities', () => {
  const result = normalize('TP1 HIT TRIM 50% MOVE STOPS TO BREAKEVEN');
  assert.equal(result.status, 'normalized');
  assert.deepEqual(actions(result), ['TARGET_HIT', 'TRIM', 'BREAKEVEN']);
  assert.ok(result.instructions.every(item => item.symbol === null));
});

test('gains-only messages with or without full contract are ignored', () => {
  for (const text of ['+100% gains from earlier', 'SPY 10/9 600c .10 to .90 gains from earlier', 'Bought SPY 10/9 600c from earlier +100% gains', 'nice win']) assert.equal(normalize(text).status, 'ignored', text);
  assert.equal(normalize('TP1 hit +50%').status, 'normalized');
});

test('conflicting identity, multiple contracts, spreads and ambiguous direction require review', () => {
  for (const text of [
    'Buy SPY 10/9 600c and QQQ 10/9 500c at 1.25',
    'Buy SPY 10/9 600c and SPY 10/9 600p at 1.25',
    'Buy SPY and QQQ 10/9 600c at 1.25',
    'Buy SPY 10/9 600c puts at 1.25',
    'Buy and sell SPY 10/9 600c at 1.25',
    'Short SPY 10/9 600 calls at 1.25',
    'Buy SPY 10/9 600/605c spread at 1.25',
    'Buy SPY 10/9 600c roll to 10/16 605c',
    'Buy SPY 10/9 600c TP1 hit',
    'SPY 10/9 600c 10/16 close',
  ]) {
    const result = normalize(text);
    assert.equal(result.status, 'review', text);
    assert.deepEqual(result.instructions, [], text);
  }
});

test('conditional, negated and conflicting management are withheld for review', () => {
  for (const text of ['if TP1 hit trim 50%', 'do not trim', 'not buying SPY 10/9 600c', 'maybe buy SPY 10/9 600c', 'closed cancel', 'closed add', 'trim 25% trim 50%', 'move stop to .75 move stop to 1.25']) assert.equal(normalize(text).status, 'review', text);
});

test('narrative action words and historical management cannot mutate trade state', () => {
  for (const text of ['The market is flat today', 'That was a close call', 'I need to cut down on coffee', 'close to target', 'I added more details to the recap', 'You can add a screenshot', 'TP1 hit yesterday', 'Closed SPY yesterday', 'Reposting: BTO SPY 600c 10/9 @1.25']) {
    const result = normalize(text);
    assert.notEqual(result.status, 'normalized', text);
    assert.deepEqual(result.instructions, [], text);
  }
});

test('terminal events come after other source-state events in one message', () => {
  assert.deepEqual(actions(normalize('all out, TP3 hit')), ['TARGET_HIT', 'CLOSE']);
  assert.deepEqual(actions(normalize('trim all')), ['CLOSE']);
  assert.equal(normalize('trim 100%').instructions[0].fraction, 1);
  assert.equal(normalize('TP1 hit quarter trim').status, 'review');
  assert.equal(normalize('TP1 hit TP4 hit').status, 'review');
});

test('invalid, ranged and conflicting labelled prices do not become unknown-priced opens', () => {
  for (const text of ['BTO SPY 600c 10/9 @ -1.25', 'BTO SPY 600c 10/9 entry 1.25-1.50', 'BTO SPY 600c 10/9 @1.25 premium 2', 'BTO SPY 600c 10/9 @1.25 stop 0', 'BTO SPY 600c 10/9 @0']) assert.equal(normalize(text).status, 'review', text);
});

test('conflicting explicit entry or target prices require review', () => {
  assert.equal(normalize('Buy SPY 10/9 600c entry 1.25 paid 1.50').reason, 'conflicting_premiums');
  assert.equal(normalize('Buy SPY 10/9 600c @ 1.25 TP1 2.00 TP1 3.00').reason, 'conflicting_target_prices');
});

test('normalization has no wall-clock dependency and ignores observation date for expiry', () => {
  const input = message('Buy SPY 10/9 600c @ 1.25', { timestamp_utc: null });
  const original = Date.now;
  try {
    Date.now = () => 0;
    const first = normalizeMessage(input);
    Date.now = () => 4102444800000;
    assert.deepEqual(normalizeMessage(input), first);
  } finally { Date.now = original; }
});

test('empty and malformed messages do not manufacture instructions', () => {
  assert.equal(normalize(' ').status, 'ignored');
  assert.equal(normalize('great chart today').status, 'ignored');
  assert.equal(normalizeMessage(null).status, 'review');
  assert.equal(normalizeMessage({ raw_text: 12 }).status, 'review');
});
