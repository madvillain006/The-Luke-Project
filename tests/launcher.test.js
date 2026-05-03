'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LAUNCHER_FILE = path.join(ROOT, 'Launch Luke.cmd');
const README_FILE = path.join(ROOT, 'README.md');

describe('root launcher', () => {
  it('provides a visible Windows launcher in the repo root', () => {
    const launcher = fs.readFileSync(LAUNCHER_FILE, 'utf8');

    expect(fs.existsSync(LAUNCHER_FILE)).toBe(true);
    expect(launcher).toContain('title Luke Launcher');
    expect(launcher).toContain('set "ROOT=%~dp0"');
    expect(launcher).toContain('cd /d "%ROOT%"');
    expect(launcher).toContain('package.json');
    expect(launcher).toContain('electron.js');
    expect(launcher).toContain('node_modules\\.bin\\electron.cmd');
    expect(launcher).toContain('http://localhost:3000/shell');
    expect(launcher).toContain('call "%ROOT%node_modules\\.bin\\electron.cmd" "%ROOT%electron.js"');
  });

  it('documents the root launch path in the README', () => {
    const readme = fs.readFileSync(README_FILE, 'utf8');

    expect(readme).toContain('## Launch');
    expect(readme).toContain('Double-click `Launch Luke.cmd`');
    expect(readme).toContain('http://localhost:3000/shell');
    expect(readme).toContain('npm start');
  });
});
