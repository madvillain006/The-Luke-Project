'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.js');
const ELECTRON_FILE = path.join(ROOT, 'electron.js');
const DASHBOARD_FILE = path.join(ROOT, 'brain-dashboard.html');
const SHELL_FILE = path.join(ROOT, 'luke-shell.html');
const CHAT_FILE = path.join(ROOT, 'chat.html');

describe('/brain dashboard shell', () => {
  it('adds brain dashboard routes under the Luke shell', () => {
    const index = fs.readFileSync(INDEX_FILE, 'utf8');

    expect(fs.existsSync(DASHBOARD_FILE)).toBe(true);
    expect(fs.existsSync(SHELL_FILE)).toBe(true);
    expect(index).toContain('app.get("/", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/luke-shell.html")');
    expect(index).toContain('app.get("/shell", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/luke-shell.html")');
    expect(index).toContain('app.get("/trading", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/chat.html")');
    expect(index).toContain('app.get("/luke", (req, res) => {');
    expect(index).toContain('app.get("/brain", (req, res) => {');
    expect(index).toContain('app.get("/brain-dashboard", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/brain-dashboard.html")');
    expect(index).toContain('app.use("/agent/brain",    rl(240))');
    expect(index).toContain('if (req.path.startsWith("/brain")) return next();');
    expect(index).toContain('app.use(rl(600)); // global fallback for local dashboard/static route smoke checks');
  });

  it('exposes telemetry for the dashboard status panel', () => {
    const agent = fs.readFileSync(path.join(ROOT, 'agents', 'agent-00-brain.js'), 'utf8');

    expect(agent).toContain("router.get('/telemetry'");
    expect(agent).toContain('process.memoryUsage()');
    expect(agent).toContain('os.totalmem()');
  });

  it('opens the executable to the Luke dashboard shell first', () => {
    const electron = fs.readFileSync(ELECTRON_FILE, 'utf8');

    expect(electron).toContain("win.loadURL('http://localhost:3000/shell')");
    expect(electron).not.toContain("win.loadURL('http://localhost:3000')");
    expect(electron).not.toContain('alwaysOnTop: true');
  });

  it('renders the fork map and consumes the brain spine APIs', () => {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');

    for (const label of [
      'Luke Brain',
      'Local control plane with reporting spines',
      'Dashboard',
      'Luke Chat',
      'spine-trading',
      'spine-automation',
      'spine-developer',
      'spine-daily',
      'spine-history',
      'AI Automation Business Spine',
      'Developer AI Stack Spine',
      'History-Career Search Spine',
      'Blockers',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('/agent/brain/status');
    expect(html).toContain('/agent/brain/automation-business');
    expect(html).toContain('/agent/brain/developer-stack');
    expect(html).toContain('/agent/brain/daily');
    expect(html).toContain('/agent/brain/history-career');
    expect(html).toContain('provider.lane');
    expect(html).toContain('developer.blockers');
    expect(html).toContain('daily.blockers');
    expect(html).toContain('async function fetchOptional(url, fallback)');
    expect(html).toContain("const snapshot = await fetchJson('/agent/brain/status')");
    expect(html).toContain('requestAnimationFrame(() => {');
    expect(html).toContain("'42.8864'");
    expect(html).toContain("'-78.8784'");
  });

  it('does not expose trading execution controls', () => {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');
    const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
      .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase());

    expect(buttonLabels).toContain('refresh');
    expect(buttonLabels).toContain('context file');
    expect(buttonLabels).toContain('mcp workflow');
    expect(buttonLabels).toContain('schedule');
    expect(buttonLabels).toContain('outreach');
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
    expect(html).not.toContain('/agent/autonomous/start');
    expect(html).not.toContain('/agent/autonomous/set-mode');
  });

  it('renders the outer Luke fork shell around the trading surface', () => {
    const html = fs.readFileSync(SHELL_FILE, 'utf8');

    for (const label of [
      'In memory of my best friend',
      'LUKE',
      'Status 0',
      'Luke System',
      'Blockers:',
      'Trading (Analysis)',
      'AI Automation Business',
      'Developer Stack',
      'Daily Brief',
      'History Career',
      'History Career fork',
      'Market microstructure analysis, order flow tracking, and strategy recommendations.',
      'Human-gated. Read-only. No autonomous execution controls.',
      'Trading (Analysis) / Luke Chat',
      'Luke System / General Chat',
      'data-src="/trading?embed=1"',
      'data-src="/luke?embed=1"',
      'href="/luke"',
      'weather-emoji',
      'weatherEmoji(weather)',
      'formatWeatherForecast(weather)',
      'daily-brief-state',
      'daily-brief-note',
      'daily-brief-weather-summary',
      'daily-brief-weather-forecast',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).not.toContain('Daily Weather');
    expect(html).not.toContain('aria-label="Daily weather status"');

    expect(html).toContain('/trading');
    expect(html).toContain('/luke');
    expect(html).toContain('/brain-dashboard');
    expect(html).toContain('/agent/brain/status');
    expect(html).toContain('/agent/brain/telemetry');
    expect(html).toContain('/brain-dashboard#spine-daily');
    expect(html).toContain('/brain-dashboard#spine-automation');
    expect(html).toContain('/brain-dashboard#spine-developer');
    expect(html).toContain('/brain-dashboard#spine-history');
    expect(html).toContain('Show All');
    expect(html).toContain('Brain Status');
    expect(html).toContain('Agents (A)');
    expect(html).not.toContain('Menu =');
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
  });

  it('keeps every shell box backed by a direct route', () => {
    const html = fs.readFileSync(SHELL_FILE, 'utf8');
    const routes = Array.from(html.matchAll(/data-route="([^"]+)"/g)).map(match => match[1]);

    for (const route of ['/trading', '/luke']) {
      expect(routes).toContain(route);
    }
    expect(html).toContain('class="hero-card" id="trading-launch" data-route="/trading" href="/trading"');
    expect(html).toContain('id="trading-panel"');
    expect(html).toContain('id="system-panel"');
    expect(html).toContain('openTradingPanel()');
    expect(html).toContain('openSystemPanel()');
    expect(html).not.toContain('<span>C 013</span><span class="name">History Career</span>');
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/trading?embed=1')");
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/luke?embed=1')");
    expect(html).toContain("document.querySelectorAll('[data-route]')");
    expect(html).toContain("if (route === '/luke')");
    expect(html).toContain('window.getSelection().toString().length > 0');
    expect(html).toContain('grid-template-columns: repeat(5, minmax(120px, 1fr))');
    expect(html).toContain('height: 104px');
  });

  it('keeps the trading surface as the prior chat interface ready for input', () => {
    const html = fs.readFileSync(CHAT_FILE, 'utf8');

    expect(html).toContain('<div id="messages">');
    expect(html).toContain('<input id="input" type="text"');
    expect(html).toContain('<button id="send"');
    expect(html).toContain('fetch(BASE + "/chat"');
    expect(html).toContain('const chatSurface = window.location.pathname === "/luke" ? "system" : "trading"');
    expect(html).toContain('surface: chatSurface');
    expect(html).toContain('chatSurface !== "system" && !text.startsWith');
    expect(html).toContain('body.system-chat #quick-btns');
    expect(html).toContain('href="/shell"');
    expect(html).toContain('grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))');
    expect(html).toContain('overflow-wrap: anywhere');
  });

  it('keeps dense brain module cards from overflowing their grid cells', () => {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');

    expect(html).toContain('grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))');
    expect(html).toContain('.node-top > div');
    expect(html).toContain('align-items: flex-start');
    expect(html).toContain('grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))');
    expect(html).toContain('overflow-wrap: anywhere');
  });

  it('renders Katbot websocket events as structured DOM text, not raw HTML blocks', () => {
    const html = fs.readFileSync(CHAT_FILE, 'utf8');

    expect(html).toContain('function addKatEventMessage(data)');
    expect(html).toContain('bubble.textContent = lines.join("\\n")');
    expect(html).toContain('data.type === "kat_signal" || data.type === "kat_chart_pending" || data.type === "kat_confluence"');
    expect(html).toContain("data.type === 'kat_vision'");
    expect(html).toContain('img.alt = "Kat analyst chart evidence"');
  });
});
