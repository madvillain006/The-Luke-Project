'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCTION = path.join(ROOT, 'tradingview', 'luke-watch-production-test.pine');
const READABLE = path.join(ROOT, 'tradingview', 'luke-watch-production-test-readable-ledger.pine');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

describe('Pine WATCH label retention', () => {
  it('keeps WATCH labels as a capped history instead of deleting the previous WATCH label', () => {
    for (const file of [PRODUCTION, READABLE]) {
      const pine = read(file);

      expect(pine).toContain('show_watch_label = input.bool(true, "Show WATCH labels")');
      expect(pine).toContain('watch_label_history_limit = input.int(60, "WATCH label history"');
      expect(pine).toContain('var label[] watch_labels = array.new_label()');
      expect(pine).toContain('f_add_watch_label(watch_labels, bar_index, low, "WATCH #"');
      expect(pine).not.toContain('var label latest_watch_label');
      expect(pine).not.toContain('label.delete(latest_watch_label)');
    }
  });

  it('does not change executable declarations or order submission safety', () => {
    const production = read(PRODUCTION);
    const readable = read(READABLE);

    expect(production).toContain('indicator("Luke Watch Production Test - Realistic Accounting"');
    expect(readable).toContain('indicator("Luke Watch Production Test - Readable Ledger"');
    expect(production).not.toContain('strategy(');
    expect(readable).not.toContain('strategy(');
    expect(production).not.toMatch(/webhook|brokerSubmit|submitOrder|placeOrder|LIVE_READY|EXECUTE/);
    expect(readable).not.toMatch(/webhook|brokerSubmit|submitOrder|placeOrder|LIVE_READY|EXECUTE/);
  });
});
