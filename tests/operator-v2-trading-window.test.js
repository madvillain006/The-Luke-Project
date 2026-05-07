'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('trading window read-only surface', () => {
  it('adds a dedicated trading window route and read-only UI labels', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'trading-window.html'), 'utf8');
    const chat = fs.readFileSync(path.join(ROOT, 'chat.html'), 'utf8');
    const operator = fs.readFileSync(path.join(ROOT, 'operator-v2.html'), 'utf8');
    const shell = fs.readFileSync(path.join(ROOT, 'luke-shell.html'), 'utf8');

    expect(index).toContain('app.get("/trading-window"');
    expect(html).toContain('Trading Bot Window');
    expect(html).toContain('Read-only');
    expect(html).toContain('Replay/dev simulated');
    expect(html).toContain('No execution controls');
    expect(html).toContain('Not a live trade recommendation');
    expect(html).toContain('/api/trading/chart-data');
    expect(html).toContain('/api/trading/source-health');
    expect(operator).toContain('/trading-window');
    expect(operator).toContain('operator-price-chart');
    expect(operator).toContain('Replay Trading Window Embedded In Dashboard');
    expect(operator).toContain('/api/operator/heatmap-proof');
    expect(operator).toContain('Katbot / Heatmap Input Proof');
    expect(operator).toContain('Client Demo Replay Trade Plan');
    expect(operator).toContain('Dashboard Trade Window Preview');
    expect(operator).toContain('Katbot/heatmap input, and Pine watch script');
    expect(operator).toContain('demo-trade-popover');
    expect(operator).toContain('demo-trade-window-chart');
    expect(operator).toContain('Luke Level Reclaim Watch Script');
    expect(operator).toContain('Hypothetical replay/paper plan only');
    expect(operator).toContain('tradingview/luke-level-reclaim-watch.pine');
    expect(shell).toContain('Trading (Analysis) / Trading Bot');
    expect(shell).toContain('data-src="/trading?embed=1"');
    expect(shell).toContain("setTradingPanelMode('window')");
    expect(shell).toContain('/trading-window?embed=shell&mode=replay&example=positive');
    expect(shell).toContain('title="Trading bot chat"');
    expect(shell).toContain('Show the replay trading window in this panel');
    expect(shell).toContain('height: clamp(780px, 82vh, 980px)');
    expect(shell).toContain('repeat(auto-fill, minmax(210px, 260px))');
    expect(shell).not.toContain('Luke Trading Companion - Dashboard Demo');
    expect(html).toContain('Katbot / SPX Heatmap Feed');
    expect(html).toContain('/api/operator/heatmap-proof');
    expect(html).toContain('Luke Watch Pine Script');
    expect(html).toContain('tradingview/luke-level-reclaim-watch.pine');
    expect(chat).not.toContain('data-cmd="/alert "');
    expect(chat).not.toMatch(/\bXimes\b/i);
    expect(chat).toContain('Katbot/SPX heatmap');
    expect(chat).toContain('PINE CODE ALGO / BRACKET');
  });

  it('keeps trading window controls non-execution and GET-only', () => {
    const html = fs.readFileSync(path.join(ROOT, 'trading-window.html'), 'utf8');
    const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
      .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase())
      .filter(Boolean);

    expect(buttonLabels).toEqual(['positive replay', 'negative replay', 'staged add replay', 'tight chart', 'mid chart', 'all levels', 'refresh', 'copy webhook url', 'refresh tunnel url']);
    expect(html).toContain("method: 'GET'");
    const postRoutes = Array.from(html.matchAll(/fetch\(\s*['"]([^'"]+)['"][\s\S]{0,90}?method:\s*['"]POST['"]/gi))
      .map(match => match[1]);
    expect(postRoutes).toEqual(['/api/ninjatrader/tunnel-watchdog/refresh']);
    expect(buttonLabels.some(label => /execute|broker/.test(label))).toBe(false);
  });

  it('adds chart-data and source-health as GET-only trading APIs', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

    expect(index).toContain('app.get("/api/trading/chart-data"');
    expect(index).toContain('app.get("/api/trading/source-health"');
    expect(index).toContain('app.get("/api/operator/heatmap-proof"');
    expect(index).not.toContain('app.post("/api/trading/chart-data"');
    expect(index).not.toContain('app.post("/api/trading/source-health"');
  });
});
