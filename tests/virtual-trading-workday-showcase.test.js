'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'run-virtual-trading-workday-showcase.js');

describe('virtual trading workday showcase harness', () => {
  it('drives the real shell/trading chat while backing up and restoring runtime state', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');
    const pkg = require('../package.json');

    expect(pkg.scripts['showcase:trading-workday']).toBe('node scripts/run-virtual-trading-workday-showcase.js');
    expect(source).toContain("await page.goto(`${BASE_URL}/shell`");
    expect(source).toContain("page.locator('[data-route=\"/trading\"]')");
    expect(source).toContain("page.frameLocator('#trading-frame')");
    expect(source).toContain("await input.fill");
    expect(source).toContain("state', 'runtime', 'test-heatmap.png'");
    expect(source).toContain("new ClipboardEvent('paste'");
    expect(source).toContain("driveImagePaste(frame, browserFrame, item, heatmapImage)");
    expect(source).toContain("heatmapVisionParsed(commandResults)");
    expect(source).toContain('/trade LONG ES 7248 7265 WIN');
    expect(source).toContain('/trade SHORT ES 7297 7287 WIN');
    expect(source).toContain('/trade LONG ES 7300 7294 LOSS');
    expect(source).toContain("command: '/review'");
    expect(source).toContain('const backups = backupFiles(DATA_FILES)');
    expect(source).toContain('prepareShowcaseState()');
    expect(source).toContain('restoreFiles(backups)');
    expect(source).not.toContain('Bobby virtual heatmap notes');
  });

  it('keeps the showcase out of live execution and autonomous control routes', () => {
    const source = fs.readFileSync(SCRIPT, 'utf8');

    expect(source).not.toContain('/agent/autonomous/execute-staged');
    expect(source).not.toContain('/agent/autonomous/start');
    expect(source).not.toContain('/agent/autonomous/stop');
    expect(source).not.toContain('/agent/autonomous/launch');
    expect(source).not.toContain('/agent/autonomous/set-mode');
  });
});
