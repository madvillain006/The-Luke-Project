'use strict';

const path = require('path');
const { buildKatOwnerProofPack } = require('../lib/kat-owner-proof-pack');

function main() {
  const rootDir = path.join(__dirname, '..');
  const outDir = path.join(rootDir, 'reports', 'katbot-owner-proof');
  const result = buildKatOwnerProofPack({ rootDir, outDir });
  console.log('Kat owner proof pack written:');
  for (const file of Object.values(result.files)) {
    console.log('- ' + file);
  }
  console.log('Recommendation: ' + result.pack.readiness.recommendation.status);
}

if (require.main === module) {
  main();
}

module.exports = { main };
