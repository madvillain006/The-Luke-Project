#!/usr/bin/env node
'use strict';

// ATM Machine Backtest CLI - Pass 2
//
// Wires candidates JSONL + session bar indexer into simulateAllCandidates,
// then emits JSON detail and a markdown comparison table.
//
// Offline only. Does not touch /entries, PM2, broker, or scheduler.

const fs   = require('fs');
const path = require('path');
const {
  simulateAllCandidates,
  STRATEGY_IDS,
  RESOLUTION_MODES,
  EXECUTION_POLICIES,
  APEX_START_BALANCE,
  APEX_TRAILING_DRAWDOWN,
} = require('../lib/backtest-data/atm-simulator');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  candidates:   path.join(ROOT, 'data/backtest/es-long-bracket/derived/long-candidates.jsonl'),
  sessionsRoot: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  outDir:       path.join(ROOT, 'data/backtest/es-long-bracket/reports'),
  strategies:   null, // null = all three
  modes:        null, // null = both modes
  executionPolicy: EXECUTION_POLICIES.EVERY_SIGNAL,
};

// ─── Data loaders ─────────────────────────────────────────────────────────────

function loadCandidates(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      try { return JSON.parse(line); }
      catch (e) { throw new Error(`candidates line ${i + 1}: ${e.message}`); }
    });
}

// Only loads sessions for dates that have candidates - avoids scanning all 50 files.
function loadBarsByDate(sessionsRoot, dates) {
  const barsByDate = {};
  for (const date of dates) {
    const filePath = path.join(path.resolve(sessionsRoot), `${date}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  [warn] No session file for ${date} - that date's trades will timeout`);
      barsByDate[date] = [];
      continue;
    }
    const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    barsByDate[date] = (session.bars && session.bars.es) || [];
  }
  return barsByDate;
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];

    if (flag === '--candidates') {
      args.candidates = next; i++;
    } else if (flag === '--sessions-root') {
      args.sessionsRoot = next; i++;
    } else if (flag === '--out') {
      args.outDir = next; i++;
    } else if (flag === '--mode' || flag === '--modes') {
      if (next === 'stop_first')   args.modes = [RESOLUTION_MODES.STOP_FIRST];
      else if (next === 'target_first') args.modes = [RESOLUTION_MODES.TARGET_FIRST];
      else if (next === 'both')    args.modes = null;
      else throw new Error(`Unknown --mode: ${next}. Use: stop_first | target_first | both`);
      i++;
    } else if (flag === '--strategies') {
      if (next === 'all') {
        args.strategies = null;
      } else {
        const valid = new Set(Object.values(STRATEGY_IDS));
        args.strategies = next.split(',').map(s => s.trim()).map(s => {
          if (!valid.has(s)) throw new Error(`Unknown strategy: ${s}. Valid: ${[...valid].join(', ')}`);
          return s;
        });
      }
      i++;
    } else if (flag === '--policy' || flag === '--execution-policy') {
      const valid = new Set(Object.values(EXECUTION_POLICIES));
      if (!valid.has(next)) {
        throw new Error(`Unknown execution policy: ${next}. Valid: ${[...valid].join(', ')}`);
      }
      args.executionPolicy = next;
      i++;
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/run-atm-backtest.js [options]',
    '',
    'Options:',
    '  --candidates <path>    JSONL candidate file',
    `                         (default: derived/long-candidates.jsonl)`,
    '  --sessions-root <dir>  Session JSON directory',
    `                         (default: sessions/)`,
    '  --out <dir>            Output directory',
    `                         (default: reports/)`,
    '  --mode stop_first|target_first|both',
    '                         Bar conflict resolution mode (default: both)',
    '  --strategies all|<comma-separated>',
    `                         Strategies to run (default: all)`,
    `                         Valid: ${Object.values(STRATEGY_IDS).join(', ')}`,
    '  --policy <policy>      Candidate execution policy',
    `                         Valid: ${Object.values(EXECUTION_POLICIES).join(', ')}`,
    `                         (default: ${EXECUTION_POLICIES.EVERY_SIGNAL})`,
    '',
    'Apex config: $50,000 start | $2,000 EOD trailing drawdown (Apex 50k EOD Trail)',
    '',
    'Examples:',
    '  node scripts/run-atm-backtest.js',
    '  node scripts/run-atm-backtest.js --mode stop_first',
    '  node scripts/run-atm-backtest.js --strategies atm_2pt_scalp,atm_3pt_scalp --mode both',
  ].join('\n');
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

// Short labels for the 6-run comparison table header
const RUN_LABELS = {
  [`${STRATEGY_IDS.STANDARD_3C}__${RESOLUTION_MODES.STOP_FIRST}`]:   '3c / stop',
  [`${STRATEGY_IDS.STANDARD_3C}__${RESOLUTION_MODES.TARGET_FIRST}`]: '3c / target',
  [`${STRATEGY_IDS.ATM_2PT}__${RESOLUTION_MODES.STOP_FIRST}`]:       '2pt / stop',
  [`${STRATEGY_IDS.ATM_2PT}__${RESOLUTION_MODES.TARGET_FIRST}`]:     '2pt / target',
  [`${STRATEGY_IDS.ATM_3PT}__${RESOLUTION_MODES.STOP_FIRST}`]:       '3pt / stop',
  [`${STRATEGY_IDS.ATM_3PT}__${RESOLUTION_MODES.TARGET_FIRST}`]:     '3pt / target',
};

function fmtDollar(n) {
  if (n === null || n === undefined) return '-';
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function fmtPct(n) {
  return n === null ? '-' : `${n.toFixed(2)}%`;
}

function fmtR(n) {
  return n === null || n === undefined ? '-' : n.toFixed(4);
}

function fmtBreach(breached) {
  return breached ? '**YES**' : 'no';
}

function buildMarkdown(result, args) {
  const { runs, candidateCount, eligibleCandidateCount, executionPolicy, apexConfig, generatedAt } = result;
  const runKeys = Object.keys(runs);
  const colLabels = runKeys.map(k => RUN_LABELS[k] || k);

  const lines = [];

  // ── Header ──
  lines.push(
    '# ATM Machine Backtest Report',
    '',
    `**Generated:** ${generatedAt}`,
    `**Candidates:** ${candidateCount}`,
    `**Eligible after policy:** ${eligibleCandidateCount}`,
    `**Execution policy:** \`${executionPolicy}\``,
    `**Sessions root:** \`${args.sessionsRoot}\``,
    `**Apex baseline:** $${apexConfig.startingBalance.toLocaleString()} start | ` +
      `$${apexConfig.trailingDrawdownLimit.toLocaleString()} EOD trailing drawdown (Apex 50k EOD Trail)`,
    '',
    '> **Simulation scope:** Each candidate is simulated independently. Multiple signals',
    '> can fire per cluster per day - daily P&L reflects every signal taken, not one-per-cluster.',
    '> Standard 3c exits all contracts at `targets[0]` (nearest mancini/saty level).',
    '> ATM scalp variants skipped when `riskRewardOk: false`.',
    '',
  );

  // ── Comparison table ──
  lines.push('## Strategy Comparison', '');
  lines.push(`| Metric | ${colLabels.join(' | ')} |`);
  lines.push(`|---|${runKeys.map(() => '---:').join('|')}|`);

  function row(label, fn) {
    const cells = runKeys.map(k => String(fn(runs[k].metrics, k)));
    lines.push(`| ${label} | ${cells.join(' | ')} |`);
  }

  row('Run candidates',      (_m, k) => runs[k].eligibleCandidateCount);
  row('Eligible trades',     m => m.totalTrades - m.noSetup);
  row('Settled',             m => m.settledTrades);
  row('Wins',                m => m.wins);
  row('Losses',              m => m.losses);
  row('Timeouts',            m => m.timeouts);
  row('Skipped (no-setup)',  m => m.noSetup);
  row('Win Rate',            m => fmtPct(m.winRate));
  row('Avg R-multiple',      m => fmtR(m.avgR));
  row('Total P&L',           m => fmtDollar(m.totalPnl));
  row('Max Drawdown',        m => fmtDollar(m.maxDrawdown));
  row('Apex EOD Breached',   m => fmtBreach(m.apexBreached));

  lines.push('');

  // ── Apex breach detail ──
  lines.push('## Apex EOD Breach Days', '');
  const breachedKeys = runKeys.filter(k => runs[k].metrics.apexBreached);

  if (breachedKeys.length === 0) {
    lines.push('_No Apex EOD trailing drawdown breaches across any run._', '');
  } else {
    lines.push(
      `> **Breach condition:** EOD equity fell below (trailing high - $${apexConfig.trailingDrawdownLimit.toLocaleString()})`,
      '',
    );
    for (const key of breachedKeys) {
      const { metrics } = runs[key];
      lines.push(`### ${RUN_LABELS[key] || key}`, '');
      lines.push('| Date | Day P&L | EOD Equity | Apex Floor | Deficit |');
      lines.push('|---|---:|---:|---:|---:|');
      for (const bd of metrics.apexBreachDays) {
        lines.push(
          `| **${bd.date}** | ${fmtDollar(bd.dayPnl)} | ${fmtDollar(bd.equity)} ` +
          `| ${fmtDollar(bd.apexFloor)} | **${fmtDollar(bd.deficit)}** |`
        );
      }
      lines.push('');
    }
  }

  // ── Daily P&L cross-tab ──
  lines.push('## Daily P&L by Date', '');
  lines.push('> BREACH = Apex EOD trailing drawdown breach on that run/day combination.', '');

  const allDates = [...new Set(
    runKeys.flatMap(k => runs[k].metrics.equityCurve.map(pt => pt.date))
  )].sort();

  if (allDates.length === 0) {
    lines.push('_No trade dates._', '');
  } else {
    lines.push(`| Date | ${colLabels.join(' | ')} |`);
    lines.push(`|---|${runKeys.map(() => '---:').join('|')}|`);
    for (const date of allDates) {
      const cells = runKeys.map(k => {
        const pt = runs[k].metrics.equityCurve.find(r => r.date === date);
        if (!pt) return '-';
        const breach = runs[k].metrics.apexBreachDays.some(b => b.date === date);
        const label  = fmtDollar(pt.dayPnl);
        return breach ? `**${label} BREACH**` : label;
      });
      lines.push(`| ${date} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  // ── EOD equity curves per run ──
  lines.push('## EOD Equity Curves', '');
  for (const key of runKeys) {
    const { metrics } = runs[key];
    if (metrics.equityCurve.length === 0) continue;
    lines.push(`### ${RUN_LABELS[key] || key}`, '');
    lines.push('| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const pt of metrics.equityCurve) {
      const breach   = metrics.apexBreachDays.some(b => b.date === pt.date);
      const dateLbl  = breach ? `**${pt.date} BREACH**` : pt.date;
      lines.push(
        `| ${dateLbl} | ${fmtDollar(pt.dayPnl)} | ${fmtDollar(pt.equity)} ` +
        `| ${fmtDollar(pt.trailingHigh)} | ${fmtDollar(pt.apexFloor)} | ${fmtDollar(pt.drawdown)} |`
      );
    }
    lines.push('');
  }

  lines.push(
    '---',
    '',
    '*Generated by `run-atm-backtest.js` - Luke project. Offline only.*',
    '',
  );

  return lines.join('\n');
}

// ─── Console summary table ────────────────────────────────────────────────────

function printSummary(result) {
  const { runs } = result;
  const runKeys  = Object.keys(runs);

  const COL = {
    label:  38,
    winPct: 7,
    avgR:   8,
    pnl:    12,
    maxDD:  11,
    breach: 8,
  };

  const pad = (s, n, right = false) => {
    const str = String(s);
    return right ? str.padStart(n) : str.padEnd(n);
  };

  const divider =
    `  ${'-'.repeat(COL.label)} ${'-'.repeat(COL.winPct)} ` +
    `${'-'.repeat(COL.avgR)} ${'-'.repeat(COL.pnl)} ${'-'.repeat(COL.maxDD)} ${'-'.repeat(COL.breach)}`;

  console.log(
    `\n  ${pad('Run', COL.label)} ` +
    `${pad('Win%', COL.winPct, true)} ` +
    `${pad('Avg R', COL.avgR, true)} ` +
    `${pad('Total P&L', COL.pnl, true)} ` +
    `${pad('Max DD', COL.maxDD, true)} ` +
    `Breach`
  );
  console.log(divider);

  for (const key of runKeys) {
    const { metrics } = runs[key];
    const label = RUN_LABELS[key] || key;
    console.log(
      `  ${pad(label, COL.label)}` +
      ` ${pad(metrics.winRate + '%', COL.winPct, true)}` +
      ` ${pad(metrics.avgR, COL.avgR, true)}` +
      ` ${pad(fmtDollar(metrics.totalPnl), COL.pnl, true)}` +
      ` ${pad(fmtDollar(metrics.maxDrawdown), COL.maxDD, true)}` +
      ` ${metrics.apexBreached ? 'YES' : 'no'}`
    );
  }
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  const t0 = Date.now();

  console.log('[atm-backtest] Loading candidates...');
  const candidates = loadCandidates(args.candidates);
  console.log(`  ${candidates.length} candidates from ${path.relative(ROOT, path.resolve(args.candidates))}`);

  const uniqueDates = [...new Set(candidates.map(c => c.date))].sort();
  console.log(`  Dates: ${uniqueDates.join(', ')}`);

  console.log('[atm-backtest] Loading session bars...');
  const barsByDate = loadBarsByDate(args.sessionsRoot, uniqueDates);
  for (const date of uniqueDates) {
    console.log(`  ${date}: ${(barsByDate[date] || []).length} bars`);
  }

  console.log('[atm-backtest] Running simulation...');
  const simOptions = {};
  if (args.strategies) simOptions.strategies = args.strategies;
  if (args.modes)      simOptions.modes      = args.modes;
  simOptions.executionPolicy = args.executionPolicy;

  const result = simulateAllCandidates(candidates, barsByDate, simOptions);

  printSummary(result);

  // Write outputs
  fs.mkdirSync(path.resolve(args.outDir), { recursive: true });
  const stamp   = new Date().toISOString().replace(/[:.]/g, '-');
  const base    = path.join(path.resolve(args.outDir), `atm-backtest-${args.executionPolicy}-${stamp}`);
  const jsonPath = `${base}.json`;
  const mdPath   = `${base}.md`;

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  fs.writeFileSync(mdPath, buildMarkdown(result, args), 'utf8');

  console.log(`[atm-backtest] Done in ${Date.now() - t0}ms`);
  console.log(`  JSON -> ${path.relative(ROOT, jsonPath)}`);
  console.log(`  MD   -> ${path.relative(ROOT, mdPath)}`);
}

if (require.main === module) main();

module.exports = { parseArgs, loadCandidates, loadBarsByDate, buildMarkdown };
