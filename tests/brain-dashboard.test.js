'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.js');
const DASHBOARD_FILE = path.join(ROOT, 'brain-dashboard.html');
const SHELL_FILE = path.join(ROOT, 'luke-shell.html');

describe('/brain dashboard shell', () => {
  it('adds brain dashboard routes under the Luke shell', () => {
    const index = fs.readFileSync(INDEX_FILE, 'utf8');

    expect(fs.existsSync(DASHBOARD_FILE)).toBe(true);
    expect(fs.existsSync(SHELL_FILE)).toBe(true);
    expect(index).toContain('app.get("/", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/chat.html")');
    expect(index).toContain('app.get("/shell", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/luke-shell.html")');
    expect(index).toContain('app.get("/trading", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/chat.html")');
    expect(index).toContain('app.get("/brain", (req, res) => {');
    expect(index).toContain('app.get("/brain-dashboard", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/brain-dashboard.html")');
  });

  it('renders the fork map and consumes the brain spine APIs', () => {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');

    for (const label of [
      'Luke Brain',
      'Local control plane with reporting spines',
      'spine-trading',
      'spine-automation',
      'spine-developer',
      'spine-daily',
      'spine-history',
      'AI Automation Business Spine',
      'Developer AI Stack Spine',
      'History-Career Search Spine',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('/agent/brain/status');
    expect(html).toContain('/agent/brain/automation-business');
    expect(html).toContain('/agent/brain/developer-stack');
    expect(html).toContain('/agent/brain/daily');
    expect(html).toContain('/agent/brain/history-career');
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
      'LUKE',
      'Brain',
      'Trading',
      'AI Automation Business',
      'Developer AI Stack',
      'Daily',
      'History Career',
      'Large business-building sub-agent',
      'Claude first, Gemini second, local Ollama fallback',
      'Existing Luke trading bot lives here',
      'Naming rule: do not move trading internals',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('/trading');
    expect(html).toContain('/brain-dashboard');
    expect(html).toContain('/agent/brain/status');
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
  });
});
