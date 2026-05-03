const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const replay = require('../scripts/run-historical-operator-replay');

describe('historical operator replay harness', () => {
  it('builds operator-pasteable Saty and Bobby commands from historical fixtures', () => {
    const session = require('../data/backtest/es-long-bracket/sessions/2026-04-23.json');
    const parses = fs.readFileSync(path.join(ROOT, 'data/backtest/es-long-bracket/derived/bobby-image-parses.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .map(JSON.parse);

    const saty = replay.satyCommand(session);
    const bobby = replay.bobbyCommand(session, parses, '2026-04-23T12:13:00-04:00');

    expect(saty).toMatch(/^\/saty /);
    expect(saty.match(/\d+(?:\.\d+)?/g)).toHaveLength(13);
    expect(bobby).toContain('/heatmap');
    expect(bobby).toContain('SPX king nodes');
    expect(replay.flattenCommand(bobby)).not.toContain('\n');
  });

  it('reports stop/target outcomes from a decision plan without calling execution routes', () => {
    const bars = [
      { timestamp: '2026-04-23T12:14:00-04:00', high: 7132, low: 7130 },
      { timestamp: '2026-04-23T12:15:00-04:00', high: 7137, low: 7131 },
    ];
    const outcome = replay.outcomeFromPlan({
      decision: {
        action: 'LONG',
        entry: 7131,
        stop: 7128,
        target: 7136,
      },
    }, bars, '2026-04-23T12:13:00-04:00');

    expect(outcome.status).toBe('TARGET_FIRST');

    const source = fs.readFileSync(path.join(ROOT, 'scripts/run-historical-operator-replay.js'), 'utf8');
    expect(source).not.toContain('/agent/autonomous/execute-staged');
    expect(source).not.toContain('/agent/autonomous/start');
    expect(source).not.toContain('/agent/autonomous/stop');
    expect(source).not.toContain('/agent/autonomous/launch');
  });

  it('renders skip-chase and wait counts as first-class replay findings', () => {
    const report = replay.renderReport({
      app: { result: 'test app' },
      dates: ['2026-03-24'],
      commandLog: [{ timestampLabel: '2026-04-23 09:44 ET', command: '/heatmap test', ok: true }],
      blocked: [],
      dom: { header: true, readOnly: true, noExecuteButton: true, panelCount: 6 },
      shellDom: { title: true, tradingBox: true, tradingRoute: true, tradingEmbedded: true, tradingFrameReady: true },
      minuteScans: [{
        date: '2026-04-23',
        barsScanned: 390,
        actionable: 0,
        pass: 390,
        spinePlans: 22,
        waits: 10,
        skipChase: 12,
        chopVetoes: 0,
        samples: [],
      }],
      decisions: [
        {
          date: '2026-04-23',
          time: '2026-04-23T12:13:00-04:00',
          triggerType: 'support_hold',
          generatorEntry: 7131.75,
          generatorAnchor: 7129.5,
          price: 7131.75,
          spineAction: 'LONG',
          action: 'PASS',
          anchor: 7129.5,
          entry: 7130.5,
          acceptable_entry: 7131.5,
          stop: 7127.5,
          target: 7140,
          sizing: 'quarter',
          vetoes: [],
          reason: 'SKIP CHASE - above 7131.5 | LONG ES 7129.5 C grade quarter size.',
          outcome: { status: 'NOT_ACTIONABLE' },
        },
      ],
    });

    expect(report.counts.skipChase).toBe(1);
    expect(report.counts.minute.barsScanned).toBe(390);
    expect(report.markdown).toContain('SKIP CHASE');
    expect(report.markdown).toContain('Dates: 2026-03-24');
    expect(report.markdown).toContain('Shell dashboard opens first and embeds Trading chat in place: yes');
    expect(report.markdown).toContain('Full-Minute Session Scan');
    expect(report.markdown).toContain('Historical candidate generator and Luke decision spine are not the same authority');
  });

  it('accepts explicit dry-run date selection', () => {
    expect(replay.parseArgs(['--dates', '2026-03-24,2026-03-25'])).toEqual({
      dates: ['2026-03-24', '2026-03-25'],
    });
  });

  it('clicks the current full-surface trading tile into the embedded chat smoke path', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts/run-historical-operator-replay.js'), 'utf8');

    expect(source).toContain("page.locator('[data-route=\"/trading\"]')");
    expect(source).toContain("page.locator('#trading-panel.is-open')");
    expect(source).toContain("page.frameLocator('#trading-frame').locator('#input')");
    expect(source).toContain('embedded `/trading` chat iframe');
    expect(source).not.toContain(".agent-tile[data-route=\"/trading\"]");
    expect(source).not.toContain("page.waitForURL('**/trading'");
  });
});
