'use strict';

const fs = require('fs');
const path = require('path');
const { resolveProofPort } = require('../scripts/proof-runtime');

const ROOT = path.join(__dirname, '..');

describe('Windows runtime child processes', () => {
  it('runs desktop helpers without shell-string execution', () => {
    const workflows = fs.readFileSync(path.join(ROOT, 'agents', 'agent-13-workflows.js'), 'utf8');
    const actions = fs.readFileSync(path.join(ROOT, 'lib', 'actions.js'), 'utf8');

    expect(workflows).toContain('execFileSync("python", ["scripts\\\\desktop.py", ...argv]');
    expect(workflows).toContain('windowsHide: true');
    expect(workflows).toContain('}, 1000);');
    expect(workflows).not.toContain('execSync("python desktop.py ');
    expect(actions).toContain('execFileSync("python", ["scripts\\\\desktop.py", ...argv]');
    expect(actions).toContain('windowsHide: true');
    expect(actions).not.toContain('execSync("python scripts\\\\desktop.py ');
  });

  it('does not choose the live Luke port as a proof fallback', async () => {
    const checks = [];
    const port = await resolveProofPort({
      baseUrl: 'http://127.0.0.1:3000',
      proofPort: 3000,
      checkRuntimeHealth: async ({ port: checkedPort }) => {
        checks.push(checkedPort);
        return { status: checkedPort === 3000 ? 'current Luke' : 'free' };
      },
      portAvailable: async availablePort => availablePort === 3001,
    });

    expect(port).toBe(3001);
    expect(checks).toEqual([3000]);
  });
});
