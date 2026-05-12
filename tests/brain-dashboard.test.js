'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.js');
const ELECTRON_FILE = path.join(ROOT, 'electron.js');
const DASHBOARD_FILE = path.join(ROOT, 'brain-dashboard.html');
const SHELL_FILE = path.join(ROOT, 'luke-shell.html');
const CHAT_FILE = path.join(ROOT, 'chat.html');
const DAILY_FILE = path.join(ROOT, 'daily-window.html');
const RADAR_FILE = path.join(ROOT, 'radar-dashboard.html');

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
    expect(index).toContain('app.get("/daily", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/daily-window.html")');
    expect(index).toContain('app.get("/radar", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/radar-dashboard.html")');
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
    expect(agent).toContain("router.get('/radar'");
    expect(agent).toContain('res.json(buildRadarSnapshot(paths));');
    expect(agent).toContain("router.get('/radar/item/:id'");
    expect(agent).toContain("router.get('/radar/brief'");
    expect(agent).toContain("router.post('/radar/ingest'");
    expect(agent).toContain("router.post('/radar/review'");
  });

  it('opens the executable to the Luke dashboard shell first', () => {
    const electron = fs.readFileSync(ELECTRON_FILE, 'utf8');

    expect(electron).toContain('const APP_BASE_URL = `http://${APP_HOST}:${APP_PORT}`');
    expect(electron).toContain('win.loadURL(`${APP_BASE_URL}/shell`)');
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
      'Brain Section Output',
      'Developer AI Stack Spine',
      'History-Career Search Spine',
      'Blockers',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('/agent/brain/status');
    expect(html).toContain('/agent/brain/brief');
    expect(html).toContain('/agent/brain/automation-business');
    expect(html).toContain('/agent/brain/automation-business/plan');
    expect(html).toContain('/agent/brain/developer-stack');
    expect(html).toContain('/agent/brain/developer-stack/plan');
    expect(html).toContain('/agent/brain/daily/brief?kind=morning');
    expect(html).toContain('/agent/brain/daily/brief?kind=afternoon');
    expect(html).toContain('/agent/brain/daily');
    expect(html).toContain('/agent/brain/history-career');
    expect(html).toContain('provider.lane');
    expect(html).toContain('developer.blockers');
    expect(html).toContain('daily.blockers');
    expect(html).toContain('async function fetchOptional(url, fallback)');
    expect(html).toContain("const snapshot = await fetchJson('/agent/brain/status')");
    expect(html).toContain('requestAnimationFrame(() => {');
    expect(html).toContain('function sectionText(kind, data)');
    expect(html).toContain('async function runSection(kind)');
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
    expect(buttonLabels).toContain('brain brief');
    expect(buttonLabels).toContain('morning brief');
    expect(buttonLabels).toContain('afternoon brief');
    expect(buttonLabels).toContain('automation plan');
    expect(buttonLabels).toContain('developer plan');
    expect(buttonLabels).toContain('history searches');
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
      'Operator:',
      'Trading (Analysis)',
      'AI Automation Business',
      'Developer Stack',
      'Daily Brief',
      'Radar',
      'History Career',
      'History Career fork',
      'Market microstructure analysis, order flow tracking, and strategy recommendations.',
      'Human-gated. Read-only. No autonomous execution controls.',
      'Trading (Analysis) / Trading Bot',
      'Luke System / General Chat',
      'Daily Brief / Schedule Window',
      'Radar / Inbox + Synthesis',
      'data-src="/trading?embed=1"',
      'data-src="/luke?embed=1"',
      'data-src="/daily?embed=1"',
      'data-src="/radar?embed=1"',
      'id="daily-expand"',
      'id="radar-line"',
      'id="operator-line"',
      'id="radar-module-meta"',
      'Calendar, jobs, and next actions',
      'Inbox, synthesis, review',
      'href="/luke"',
      'weather-emoji',
      'weatherEmoji(weather)',
      'formatWeatherForecast(weather)',
      'daily-brief-state',
      'daily-brief-note',
      'daily-brief-weather-summary',
      'daily-brief-weather-forecast',
      'TN + NC weather inside',
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
    expect(html).toContain('/agent/brain/radar');
    expect(html).toContain('/luke/operator-check');
    expect(html).toContain('/daily');
    expect(html).toContain('/radar');
    expect(html).toContain('/brain-dashboard#spine-automation');
    expect(html).toContain('/brain-dashboard#spine-developer');
    expect(html).toContain('/brain-dashboard#spine-history');
    expect(html).toContain('Show All');
    expect(html).toContain('Brain Status');
    expect(html).not.toContain('Agents (A)');
    expect(html).not.toContain('Menu =');
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
  });

  it('keeps every shell box backed by a direct route', () => {
    const html = fs.readFileSync(SHELL_FILE, 'utf8');
    const routes = Array.from(html.matchAll(/data-route="([^"]+)"/g)).map(match => match[1]);
    const hrefs = Array.from(html.matchAll(/href="(\/[^"]+)"/g)).map(match => match[1]);
    const routeCounts = routes.reduce((counts, route) => {
      counts[route] = (counts[route] || 0) + 1;
      return counts;
    }, {});
    const hrefCounts = hrefs.reduce((counts, href) => {
      counts[href] = (counts[href] || 0) + 1;
      return counts;
    }, {});

    for (const route of ['/trading', '/luke', '/daily', '/radar', '/brain-dashboard#spine-automation', '/brain-dashboard#spine-developer', '/brain-dashboard#spine-history']) {
      expect(routes).toContain(route);
      expect(routeCounts[route]).toBe(1);
    }
    for (const [href, count] of Object.entries(hrefCounts)) {
      expect(`${href}:${count}`).toBe(`${href}:1`);
    }
    expect(html).toContain('class="hero-card" id="trading-launch" data-route="/trading" href="/trading"');
    expect(html).not.toContain('<span>C 000</span><span class="name">Brain Core</span>');
    expect(html).not.toContain('class="view-module" data-route=');
    expect(html).not.toContain('id="trading-full-link"');
    expect(html).toContain('id="trading-panel"');
    expect(html).toContain('id="system-panel"');
    expect(html).toContain('id="daily-panel"');
    expect(html).toContain('id="radar-panel"');
    expect(html).toContain('openTradingPanel()');
    expect(html).toContain('openSystemPanel()');
    expect(html).toContain('openDailyPanel()');
    expect(html).toContain('openRadarPanel()');
    expect(html).not.toContain('<span>C 013</span><span class="name">History Career</span>');
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/trading?embed=1')");
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/luke?embed=1')");
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/daily?embed=1')");
    expect(html).toContain("frame.setAttribute('src', frame.dataset.src || '/radar?embed=1')");
    expect(html).toContain("document.querySelectorAll('[data-route]')");
    expect(html).toContain("if (route === '/luke')");
    expect(html).toContain("if (route === '/daily')");
    expect(html).toContain("if (route === '/radar')");
    expect(html).toContain('window.getSelection().toString().length > 0');
    expect(html).toContain('grid-template-columns: repeat(auto-fill, minmax(210px, 260px))');
    expect(html).toContain('height: clamp(780px, 82vh, 980px)');
    expect(html).toContain('height: 104px');
  });

  it('renders Radar as a front-facing clicked-in shell window', () => {
    const html = fs.readFileSync(RADAR_FILE, 'utf8');

    for (const label of [
      'Luke Radar',
      'DASHBOARD',
      'Status',
      'Source Health',
      'Capture',
      'Needs You',
      'Morning Intel',
      'Recent Inbox',
      '/agent/brain/radar',
      '/agent/brain/radar/brief',
      '/agent/brain/radar/ingest',
      '/agent/brain/radar/review',
      '/agent/brain/radar/item/',
      'capture-text',
      'source-type',
      'review-note',
      'review-next-action',
      'Evidence Detail',
      'data-detail-id',
      'recent-state-filter',
      'recent-source-filter',
      'freshness_status',
      'quality warming up',
      'data-review-state="accepted"',
      'data-review-state="contradicted"',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
  });

  it('keeps the trading surface as the prior chat interface ready for input', () => {
    const html = fs.readFileSync(CHAT_FILE, 'utf8');

    expect(html).toContain('<div id="messages">');
    expect(html).toContain('<input id="input" type="text"');
    expect(html).toContain('<button id="send"');
    expect(html).toContain('fetch(BASE + "/chat"');
    expect(html).toContain('const chatSurface = window.location.pathname === "/luke" ? "system" : "trading"');
    expect(html).toContain('surface: chatSurface');
    expect(html).toContain("if (!text.startsWith('/'))");
    expect(html).toContain('id="tb-bins-val"');
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

  it('renders Daily as its own clicked-in window', () => {
    const html = fs.readFileSync(DAILY_FILE, 'utf8');

    for (const label of [
      'Luke Daily',
      'I love Kat',
      '/agent/brain/daily/window',
      '/agent/brain/history-career',
      '/agent/brain/history-career/leads?limit=8',
      '/agent/brain/automation-business',
      'Knoxville, TN',
      'Wilmington, NC',
      'This Week',
      'History Jobs / Leads',
      'Move to Tennessee',
      'Gmail cleanup',
      'Radar watch',
      'Source quality',
      "Luke is Conor\\'s local companion system",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('checkin-form');
    expect(html).not.toContain('/agent/brain/daily/checkin');
  });

  it('adds a PNG proof command for the non-trading brain sections', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const script = fs.readFileSync(path.join(ROOT, 'scripts', 'prove-brain-sections.js'), 'utf8');

    expect(pkg.scripts['prove:brain-sections']).toBe('node scripts/prove-brain-sections.js');
    expect(script).toContain('/brain-dashboard?proof=brain-sections');
    expect(script).toContain('[data-section="daily-morning"]');
    expect(script).toContain('[data-section="developer-plan"]');
    expect(script).toContain('[data-artifact="context-file"]');
  });

  it('adds a focused proof command for the Radar to Daily loop', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const script = fs.readFileSync(path.join(ROOT, 'scripts', 'prove-radar-daily-loop.js'), 'utf8');

    expect(pkg.scripts['prove:radar-daily-loop']).toBe('node scripts/prove-radar-daily-loop.js');
    expect(script).toContain('Daily brief starts with Radar review');
    expect(script).toContain('snapshot omits raw text');
  });

  it('adds a repeatable Pine inventory command before flagship promotion', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const script = fs.readFileSync(path.join(ROOT, 'scripts', 'build-pine-inventory.js'), 'utf8');

    expect(pkg.scripts['tradingview:inventory']).toBe('node scripts/build-pine-inventory.js');
    expect(script).toContain('PINE_INVENTORY_GENERATED.md');
    expect(script).toContain('visual/watchlist/research only until compile and signoff');
    expect(script).toContain('not TradingView compile proof');
  });

  it('shows Radar review-state labels in the shell status line', () => {
    const html = fs.readFileSync(SHELL_FILE, 'utf8');

    expect(html).toContain('review_state_counts');
    expect(html).toContain('radarDecisionCount');
    expect(html).toContain('radarDecisionLabel');
    expect(html).toContain('radarRsc.accepted');
    expect(html).toContain('radarRsc.contradicted');
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
