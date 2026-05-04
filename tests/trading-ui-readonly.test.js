'use strict';

const fs = require('fs');
const path = require('path');

const OPERATOR_FILE = path.join(__dirname, '..', 'operator-v2.html');

describe('trading UI read-only level-state surface', () => {
  it('shows required read-only labels and panels', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');

    for (const label of [
      'Live Level State',
      'Trade Candidates',
      'Bracket Plan Visual',
      'Trading Alerts',
      'Data Health',
      'Read-only',
      'No execution controls',
      'Research/Paper Candidate only',
      'Not a live trade recommendation',
    ]) {
      expect(html).toContain(label);
    }
  });

  it('uses only GET fetches and has no execution buttons', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');
    const buttonLabels = Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/gis))
      .map(match => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase());

    expect(html).toContain('/api/trading/level-state?instrument=ES');
    expect(html).toContain('/api/trading/trade-candidates?instrument=ES');
    expect(html).toContain('/api/trading/alerts?instrument=ES');
    expect(html).toContain("method: 'GET'");
    expect(html).not.toMatch(/method:\s*['"]POST['"]/i);
    expect(buttonLabels).toEqual(['refresh']);
  });
});
