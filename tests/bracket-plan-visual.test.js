'use strict';

const fs = require('fs');
const path = require('path');

const OPERATOR_FILE = path.join(__dirname, '..', 'operator-v2.html');

describe('bracket plan visual', () => {
  it('renders bracket lines from simulated candidate data', () => {
    const html = fs.readFileSync(OPERATOR_FILE, 'utf8');

    expect(html).toContain('Bracket Plan Visual');
    expect(html).toContain('Simulated bracket order plan only');
    expect(html).toContain('candidate.bracket.entry');
    expect(html).toContain('candidate.bracket.stop');
    expect(html).toContain('candidate.bracket.tp1');
    expect(html).toContain('candidate.bracket.tp2');
    expect(html).toContain('.bracket-line.entry');
    expect(html).toContain('.bracket-line.stop');
  });
});
