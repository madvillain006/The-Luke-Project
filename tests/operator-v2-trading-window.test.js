'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('trading window read-only surface', () => {
  it('adds a dedicated trading window route and read-only UI labels', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'trading-window.html'), 'utf8');
    const operator = fs.readFileSync(path.join(ROOT, 'operator-v2.html'), 'utf8');

    expect(index).toContain('app.get("/trading-window"');
    expect(html).toContain('Luke Trading Window');
    expect(html).toContain('Read-only');
    expect(html).toContain('Replay/dev simulated');
    expect(html).toContain('No execution controls');
    expect(html).toContain('Not a live trade recommendation');
    expect(html).toContain('/api/trading/chart-data');
    expect(html).toContain('/api/trading/source-health');
    expect(operator).toContain('/trading-window');
  });

  it('keeps trading window controls non-execution and GET-only', () => {
    const html = fs.readFileSync(path.join(ROOT, 'trading-window.html'), 'utf8');
    const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
      .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase())
      .filter(Boolean);

    expect(buttonLabels).toEqual(['positive replay', 'negative replay', 'staged add replay', 'refresh']);
    expect(html).toContain("method: 'GET'");
    expect(html).not.toMatch(/method:\s*['"]POST['"]/i);
    expect(buttonLabels.some(label => /execute|broker/.test(label))).toBe(false);
  });

  it('adds chart-data and source-health as GET-only trading APIs', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

    expect(index).toContain('app.get("/api/trading/chart-data"');
    expect(index).toContain('app.get("/api/trading/source-health"');
    expect(index).not.toContain('app.post("/api/trading/chart-data"');
    expect(index).not.toContain('app.post("/api/trading/source-health"');
  });
});
