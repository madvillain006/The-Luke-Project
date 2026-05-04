'use strict';

const fs = require('fs');
const path = require('path');
const { buildKatInsights, buildKatHandoffMarkdown } = require('../lib/kat-insights');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'data', 'kat', 'derived');
fs.mkdirSync(outDir, { recursive: true });

const insights = buildKatInsights({ rootDir });
const markdown = buildKatHandoffMarkdown(insights);
const outFile = path.join(outDir, 'katbot-handoff.md');
fs.writeFileSync(outFile, markdown, 'utf8');
console.log('Katbot handoff written: ' + path.relative(rootDir, outFile));
