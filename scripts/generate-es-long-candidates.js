'use strict';

// Offline ES long candidate generation report.
// Reads session JSON files and writes auditable candidates. Does not run live
// /entries, broker execution, PM2, or the bracket simulator.

const fs = require('fs');
const path = require('path');
const { generateLongCandidates } = require('../lib/backtest-data/long-candidate-generator');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = {
  sessions: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  out: path.join(ROOT, 'data/backtest/es-long-bracket/derived'),
  maxRiskPts: 3,
  minSources: 2,
  atmTapThreshold: 3,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--sessions') { args.sessions = next; i++; }
    else if (flag === '--out') { args.out = next; i++; }
    else if (flag === '--max-risk-pts') { args.maxRiskPts = Number(next); i++; }
    else if (flag === '--min-sources') { args.minSources = Number(next); i++; }
    else if (flag === '--atm-tap-threshold') { args.atmTapThreshold = Number(next); i++; }
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readSessions(dir) {
  return fs.readdirSync(dir)
    .filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

function summarize(candidates, sessions) {
  const byDate = {};
  const byTrigger = {};
  const bySourceCombo = {};
  const atmByDate = {};
  const atmClusters = new Set();
  const atmScalpVariantCounts = {};
  for (const candidate of candidates) {
    byDate[candidate.date] = (byDate[candidate.date] || 0) + 1;
    byTrigger[candidate.triggerType] = (byTrigger[candidate.triggerType] || 0) + 1;
    const combo = candidate.confluenceSources.join('+');
    bySourceCombo[combo] = (bySourceCombo[combo] || 0) + 1;
    if (candidate.atmMachine) {
      atmByDate[candidate.date] = (atmByDate[candidate.date] || 0) + 1;
      atmClusters.add(`${candidate.date}|${candidate.cluster.anchor}`);
      for (const variant of candidate.scalpVariants || []) {
        if (!atmScalpVariantCounts[variant.id]) {
          atmScalpVariantCounts[variant.id] = { total: 0, riskRewardOk: 0 };
        }
        atmScalpVariantCounts[variant.id].total++;
        if (variant.riskRewardOk) atmScalpVariantCounts[variant.id].riskRewardOk++;
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    sessionsScanned: sessions.length,
    usableSessionsScanned: sessions.filter(s => s.usable).length,
    totalCandidates: candidates.length,
    sessionsWithCandidates: Object.keys(byDate).length,
    atmMachineCandidates: candidates.filter(candidate => candidate.atmMachine).length,
    atmMachineClusters: atmClusters.size,
    sessionsWithAtmMachineCandidates: Object.keys(atmByDate).length,
    byDate,
    byTrigger,
    bySourceCombo,
    atmByDate,
    atmScalpVariantCounts,
  };
}

function markdownReport(summary, args) {
  const lines = [
    '# ES Long Candidate Report',
    '',
    `**Generated:** ${summary.generatedAt}`,
    '**Mode:** Offline candidate generation only. No live routes, /entries, PM2, scheduler, or broker execution touched.',
    '',
    '| Field | Value |',
    '|---|---:|',
    `| Sessions scanned | ${summary.sessionsScanned} |`,
    `| Usable sessions scanned | ${summary.usableSessionsScanned} |`,
    `| Total candidates | ${summary.totalCandidates} |`,
    `| Sessions with candidates | ${summary.sessionsWithCandidates} |`,
    `| ATM-machine candidates | ${summary.atmMachineCandidates} |`,
    `| ATM-machine clusters | ${summary.atmMachineClusters} |`,
    `| Sessions with ATM-machine candidates | ${summary.sessionsWithAtmMachineCandidates} |`,
    `| Max 3-contract risk points | ${args.maxRiskPts} |`,
    `| Minimum confluence sources | ${args.minSources} |`,
    `| ATM tap threshold | ${args.atmTapThreshold} |`,
    '',
    '## By Trigger',
    '',
    '| Trigger | Count |',
    '|---|---:|',
  ];
  for (const [trigger, count] of Object.entries(summary.byTrigger)) {
    lines.push(`| ${trigger} | ${count} |`);
  }
  lines.push('', '## By Source Combo', '', '| Sources | Count |', '|---|---:|');
  for (const [combo, count] of Object.entries(summary.bySourceCombo)) {
    lines.push(`| ${combo} | ${count} |`);
  }
  lines.push('', '## ATM Scalp Variants', '', '| Variant | Total | Risk/Reward OK |', '|---|---:|---:|');
  for (const [variant, counts] of Object.entries(summary.atmScalpVariantCounts)) {
    lines.push(`| ${variant} | ${counts.total} | ${counts.riskRewardOk} |`);
  }
  lines.push('', '## ATM Machine By Date', '', '| Date | ATM Candidates |', '|---|---:|');
  for (const [date, count] of Object.entries(summary.atmByDate).sort(([a], [b]) => a < b ? -1 : 1)) {
    lines.push(`| ${date} | ${count} |`);
  }
  lines.push('', '## By Date', '', '| Date | Candidates |', '|---|---:|');
  for (const [date, count] of Object.entries(summary.byDate).sort(([a], [b]) => a < b ? -1 : 1)) {
    lines.push(`| ${date} | ${count} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  ensureDir(args.out);
  const sessions = readSessions(args.sessions);
  const candidates = sessions.flatMap(session => generateLongCandidates(session, {
    maxThreeContractRiskPts: args.maxRiskPts,
    minSources: args.minSources,
    atmTapThreshold: args.atmTapThreshold,
  }));

  const summary = summarize(candidates, sessions);
  writeJsonl(path.join(args.out, 'long-candidates.jsonl'), candidates);
  fs.writeFileSync(path.join(args.out, 'long-candidate-report.json'), JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(path.join(args.out, 'long-candidate-report.md'), markdownReport(summary, args), 'utf8');

  console.log('[long-candidates] Done');
  console.log(`  Sessions scanned: ${summary.sessionsScanned}`);
  console.log(`  Usable sessions:  ${summary.usableSessionsScanned}`);
  console.log(`  Candidates:       ${summary.totalCandidates}`);
  console.log(`  ATM candidates:   ${summary.atmMachineCandidates}`);
  console.log(`  Output dir:       ${args.out}`);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  readSessions,
  summarize,
  markdownReport,
};
