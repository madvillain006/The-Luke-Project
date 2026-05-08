'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('chat companion integration', () => {
  it('wires shared memory and command recovery into the chat route', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

    expect(index).toContain('handleCompanionMemoryTurn');
    expect(index).toContain('buildCompanionContext');
    expect(index).toContain('recoverLukeCommand');
    expect(index).toContain('app.get("/luke/memory"');
    expect(index).toContain('app.get("/luke/memory/context"');
    expect(index).toContain('I read that as /');
    expect(index).toMatch(/alert\|backtest\|balance[\s\S]*status[\s\S]*verdict/);
  });

  it('shows shared memory as one front-facing chat affordance', () => {
    const html = fs.readFileSync(path.join(ROOT, 'chat.html'), 'utf8');

    expect(html).toContain('id="tb-memory-val"');
    expect(html).toContain('SHARED');
    expect(html).toContain('Send message to Luke');
    expect(html).not.toContain('Send message to the trading bot sub-agent');
  });
});
