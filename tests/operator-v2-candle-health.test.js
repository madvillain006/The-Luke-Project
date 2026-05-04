'use strict';

const fs = require('fs');
const path = require('path');

const OPERATOR_FILE = path.join(__dirname, '..', 'operator-v2.html');

describe('operator-v2 candle health UI', () => {
  it('shows candle source, replay warning, and live arming status', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');

    expect(html).toContain('/api/trading/candle-status?instrument=ES');
    expect(html).toContain('ES 1m candles');
    expect(html).toContain('SPX 1m candles');
    expect(html).toContain('ES live arming');
    expect(html).toContain('Using local/replay 1m candles - proof only, not live arming.');
    expect(html).toContain('1m ES candles unavailable - candle-confirmed candidates disabled.');
    expect(html).toContain("method: 'GET'");
    expect(html).not.toMatch(/method:\s*['"]POST['"]/i);
  });
});
