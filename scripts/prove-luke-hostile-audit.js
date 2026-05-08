#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { normalizeMarketSymbol, _internal: marketDataInternal } = require('../lib/market-data');
const { buildLukeOperatorCheck } = require('../lib/luke-operator-check');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'luke-hostile-audit');
const OUT_FILE = path.join(OUT_DIR, 'luke-hostile-audit-proof.json');

const TEXT_FILES = [
  'README.md',
  'docs/CURRENT_STATUS.md',
  'docs/LUKE_COMPANION_MEMORY.md',
  'docs/ARCHITECTURE_CURRENT.md',
  'docs/LUKE_90_DAY_NOW_ROADMAP.md',
  'lib/companion-memory.js',
  'lib/parse-bobby.js',
  'lib/slash-commands.js',
  'lib/operator/decision-adapter.js',
  'lib/operator/confluence-adapter.js',
  'tests/companion-memory.test.js',
  'tests/market-data.test.js',
  'tests/operator-api-adapters.test.js',
  'scripts/prove-companion-memory-loop.js',
];

const FORBIDDEN = [
  { id: 'old-split-memory-copy', pattern: /System chat and Trading chat share one companion memory bin/i },
  { id: 'system-chat-blocks-trading', pattern: /system chat still blocking trading commands/i },
  { id: 'luke-outside-trading-context', pattern: /outside the trading context/i },
  { id: 'saty-missing-input', pattern: /missing\s+\/saty|Saty MISSING|run\s+\/saty|load\s+\/saty/i },
  { id: 'live-price-null-failure-copy', pattern: /getLivePrice\(\).*returns null on failure/i },
  { id: 'operator-price-unavailable-copy', pattern: /market price unavailable|price unavailable/i },
  { id: 'live-price-unavailable-copy', pattern: /live price (?:is )?unavailable/i },
];

const CORE_MARKET_SYMBOLS = ['ES', 'NQ', 'SPX', 'SPY', 'QQQ'];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function auditForbiddenText() {
  const findings = [];
  for (const file of TEXT_FILES) {
    const text = read(file);
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) findings.push({ file, rule: rule.id });
    }
  }
  return findings;
}

function auditMarketProviderLadders() {
  const ladders = {};
  for (const symbol of CORE_MARKET_SYMBOLS) {
    ladders[symbol] = marketDataInternal.providerListFor(normalizeMarketSymbol(symbol));
  }
  const weak = Object.entries(ladders)
    .filter(([, providers]) => providers.length < 2)
    .map(([symbol, providers]) => ({ symbol, providers }));
  return { ladders, weak };
}

function auditShellRoutes() {
  const shell = read('luke-shell.html');
  const routes = Array.from(shell.matchAll(/data-route="([^"]+)"/g)).map(match => match[1]);
  const exactDuplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
  return {
    routes,
    exactDuplicates,
    hasOperatorMainRoute: routes.includes('/operator-v2'),
    hasAgentsTab: /Agents \(A\)/.test(shell),
    hasBackDashboardAsMain: /backend dashboard|back dashboard/i.test(shell),
  };
}

function auditOperatorCheck() {
  const check = buildLukeOperatorCheck({
    health: { ok: true, port: 3000 },
    memoryOptions: {
      loadMemoryFn: () => ({
        luke_companion_memory: {
          entries: [
            {
              id: 'proof_memory',
              kind: 'preference',
              text: 'Use Luke first for daily ops.',
              updated_at: new Date('2026-05-08T13:00:00.000Z').toISOString(),
              active: true,
            },
          ],
        },
      }),
    },
  });
  return {
    ok: check.ok,
    verdict: check.verdict,
    market_data: check.market_data,
    check_ids: check.checks.map(item => item.id),
  };
}

function main() {
  const forbiddenText = auditForbiddenText();
  const market = auditMarketProviderLadders();
  const shell = auditShellRoutes();
  const operator = auditOperatorCheck();

  assert.deepEqual(forbiddenText, [], 'forbidden stale spec text found');
  assert.deepEqual(market.weak, [], 'market-data provider ladder weaker than two hooks');
  assert.deepEqual(shell.exactDuplicates, [], 'duplicate shell data-route destinations found');
  assert.equal(shell.hasOperatorMainRoute, false, 'operator-v2 must remain a drilldown, not a main shell route');
  assert.equal(shell.hasAgentsTab, false, 'Agents tab should not return to the front shell');
  assert.equal(shell.hasBackDashboardAsMain, false, 'back-dashboard language should not define the front shell');
  assert.equal(operator.market_data.minimum_hookups_ok, true, 'operator check must expose market-data hookup readiness');
  assert.ok(operator.check_ids.includes('market-data'), 'operator check must include market-data');

  const proof = {
    ok: true,
    generated_at: new Date().toISOString(),
    forbidden_text_checked: TEXT_FILES,
    market_provider_ladders: market.ladders,
    shell_routes: shell.routes,
    operator,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(proof, null, 2), 'utf8');
  console.log('luke-hostile-audit proof ok: true');
  console.log(`artifact: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
}

main();
