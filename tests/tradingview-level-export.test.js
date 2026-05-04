'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildTradingViewLevelExport,
  writeTradingViewArtifacts,
} = require('../lib/tradingview/level-export');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function makeExportRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-export-'));
  fs.mkdirSync(path.join(root, 'data', 'research', 'mancini'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'research', 'mancini', 'The Mancini Logs 3-15-2026 - 5-3-2026.txt'), [
    'The Mancini Logs 3-15-2026 - 5-4-2026',
    'Adam Mancini',
    '@AdamMancini4',
    'Â·',
    '2h',
    'Plan: 7248 reclaim sees 53, 64, 85. 7237 fails, dip 7212. 7213, 7199 below.',
  ].join('\n'), 'utf8');

  writeJson(path.join(root, 'data', 'saty-levels.json'), {
    valid: true,
    instrument: 'SPX',
    updated: '2026-05-04T13:47:23.783Z',
    prev_close: 7227.73,
    call_trigger: 7245.01,
    put_trigger: 7210.45,
    ext_plus_1: 7255.7,
    ext_plus_2: 7264.35,
    ext_plus_3: 7272.99,
    ext_plus_4: 7285.29,
    atr_plus_1: 7300.96,
    ext_minus_1: 7199.76,
    ext_minus_2: 7191.11,
    ext_minus_3: 7182.47,
    ext_minus_4: 7170.17,
    atr_minus_1: 7154.5,
  });

  writeJson(path.join(root, 'data', 'dubz-levels.json'), {
    date: '2026-05-03',
    last_updated: '2026-05-04T13:00:00.000Z',
    instruments: {
      ES: { levels: [{ price: 7245, direction: 'support', significance: 'key', source: 'text' }] },
      NQ: { levels: [] },
      SPY: { levels: [] },
      QQQ: { levels: [] },
    },
  });

  fs.mkdirSync(path.join(root, 'state', 'events'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state', 'events', 'bobby-context.jsonl'), JSON.stringify({
    source: 'bobby-text',
    source_id: 'fresh-bobby',
    date: '2026-05-04T14:30:00.000Z',
    king_nodes: [7125],
  }), 'utf8');

  return root;
}

describe('TradingView level export workflow', () => {
  it('builds normalized export data and writes TradingView artifacts', () => {
    const root = makeExportRoot();
    const exportData = buildTradingViewLevelExport({
      rootDir: root,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    const artifactDir = path.join(root, 'artifacts', 'tradingview');
    const summary = writeTradingViewArtifacts({
      exportData,
      rootDir: root,
      artifactDir,
      basePinePath: path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch.pine'),
    });

    expect(exportData.source_files.mancini_misnamed).toBe(true);
    expect(exportData.source_summary.mancini).toBeGreaterThanOrEqual(7);
    expect(exportData.pine_inputs.mancini).toContain('7248');
    expect(fs.existsSync(summary.artifacts.json)).toBe(true);
    expect(fs.existsSync(summary.artifacts.csv)).toBe(true);
    expect(fs.existsSync(summary.artifacts.pine_input)).toBe(true);
    expect(fs.existsSync(summary.artifacts.generated_pine)).toBe(true);

    const generated = fs.readFileSync(summary.artifacts.generated_pine, 'utf8');
    expect(generated).toContain('indicator("Luke Level Reclaim Watch"');
    expect(generated).toContain('alertcondition(');
    expect(generated).not.toContain('strategy(');
    expect(generated).not.toMatch(/strategy\.|submitOrder|placeOrder|broker/i);
  });

  it('keeps the base Pine indicator safe and Saty-backed', () => {
    const pine = fs.readFileSync(path.join(__dirname, '..', 'tradingview', 'luke-level-reclaim-watch.pine'), 'utf8');

    expect(pine).toContain('request.security');
    expect(pine).toContain('atr_value');
    expect(pine).not.toContain('ta.barssince');
    expect(pine).not.toContain('ta.crossunder');
    expect(pine).not.toContain('ta.crossover');
    expect(pine).toContain('bars_since_flush = -1');
    expect(pine).not.toContain('f_hold_above');
    expect(pine).toContain('flush_lookback_bars');
    expect(pine).toContain('LUKE RAW FLUSH');
    expect(pine).toContain('LUKE BLOCKED');
    expect(pine).not.toContain('string text =');
    expect(pine).toContain('indicator("Luke Level Reclaim Watch"');
    expect(pine).toContain('PAPER_CANDIDATE');
    expect(pine).toContain('WATCHLIST ONLY - not an order');
    expect(pine).not.toContain('strategy(');
    expect(pine).not.toMatch(/\bBUY\b|\bSELL\b/);
  });
});
