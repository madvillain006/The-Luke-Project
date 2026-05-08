'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

describe('Luke hostile audit proof', () => {
  it('keeps the repeatable hostile audit script wired and passing', () => {
    const script = path.join(ROOT, 'scripts', 'prove-luke-hostile-audit.js');
    const result = spawnSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('luke-hostile-audit proof ok: true');

    const artifact = path.join(ROOT, 'artifacts', 'proof', 'luke-hostile-audit', 'luke-hostile-audit-proof.json');
    expect(fs.existsSync(artifact)).toBe(true);
    const proof = JSON.parse(fs.readFileSync(artifact, 'utf8'));
    expect(proof.ok).toBe(true);
    expect(proof.operator.check_ids).toContain('market-data');
    expect(proof.market_provider_ladders.ES.length).toBeGreaterThanOrEqual(2);
  });
});
