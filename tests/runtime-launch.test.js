'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('Luke launch hardening', () => {
  it('exits cleanly instead of crash-looping when the app port is already taken', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

    expect(index).toContain('server.on("error"');
    expect(index).toContain('EADDRINUSE');
    expect(index).toContain('not starting a duplicate server');
    expect(index).toContain('process.exit(0)');
  });

  it('tells PM2 not to autorestart clean duplicate-server exits', () => {
    const ecosystem = require('../ecosystem.config');

    for (const app of ecosystem.apps) {
      expect(app.stop_exit_codes).toEqual([0]);
    }
  });
});
