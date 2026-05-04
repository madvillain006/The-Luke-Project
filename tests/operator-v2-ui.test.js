'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.js');
const OPERATOR_FILE = path.join(ROOT, 'operator-v2.html');
const CHAT_FILE = path.join(ROOT, 'chat.html');

describe('/operator-v2 read-only console shell', () => {
  it('adds /operator-v2 while preserving the trading chat route', () => {
    const index = fs.readFileSync(INDEX_FILE, 'utf8');

    expect(fs.existsSync(CHAT_FILE)).toBe(true);
    expect(fs.existsSync(OPERATOR_FILE)).toBe(true);
    expect(index).toContain('app.get("/", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/chat.html")');
    expect(index).toContain('app.get("/trading", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/chat.html")');
    expect(index).toContain('app.get("/operator-v2", (req, res) => {');
    expect(index).toContain('res.sendFile(__dirname + "/operator-v2.html")');
  });

  it('consumes only read-only operator/autonomous GET endpoints', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');

    expect(html).toContain('/api/operator/status');
    expect(html).toContain('/api/operator/readiness');
    expect(html).toContain('/api/decision?instrument=ES&mode=manual');
    expect(html).toContain('/api/confluence?instrument=ES');
    expect(html).toContain('/agent/autonomous/status');
    expect(html).toContain("method: 'GET'");
    expect(html).not.toMatch(/method:\s*['"]POST['"]/i);
    expect(html).not.toContain('/agent/autonomous/execute');
    expect(html).not.toContain('/agent/autonomous/confirm');
    expect(html).not.toContain('/agent/autonomous/start');
    expect(html).not.toContain('/agent/autonomous/set-mode');
  });

  it('renders required panels and keeps PASS visually non-actionable', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');

    for (const label of [
      'Luke Operator V2 - Read Only',
      'Read-only mirror. No execution controls. Existing chat shell remains the fallback.',
      'Top Status Band',
      'Decision',
      'Confluence',
      'Ingestion Status',
      'Autonomous',
      'Evidence / Logs',
    ]) {
      expect(html).toContain(label);
    }

    expect(html).toContain('Confluence-only');
    expect(html).toContain('No actionable trade');
    expect(html).toContain("action === 'PASS'");
    expect(html).toContain('tradeBlock = decisionResponse?.actionable');
    expect(html).toContain('not actionable');
    expect(html).toContain('Autonomous can only publish a recommendation');
  });

  it('does not add execution buttons to the operator shell', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');
    const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
      .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase());

    expect(buttonLabels).toEqual(['refresh']);
  });
});
