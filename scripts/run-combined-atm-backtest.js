#!/usr/bin/env node
'use strict';

// Combined Portfolio Backtest CLI
//
// Runs named portfolio configs (combinations of strategies + execution policies)
// and produces one chronological account-level equity curve per portfolio.
//
// Offline only. Does not touch /entries, PM2, broker, scheduler, or live routes.

const fs   = require('fs');
const path = require('path');
const {
  simulateCombinedPortfolios,
  PORTFOLIO_CONFIGS,
  RESOLUTION_MODES,
  APEX_START_BALANCE,
  APEX_TRAILING_DRAWDOWN,
} = require('../lib/backtest-data/atm-simulator');

const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  candidates:   path.join(ROOT, 'data/backtest/es-long-bracket/derived/long-candidates.jsonl'),
  sessionsRoot: path.join(ROOT, 'data/backtest/es-long-bracket/sessions'),
  outDir:       path.join(ROOT, 'data/backtest/es-long-bracket/reports'),
  portfolios:   null, // null = all
  modes:        null, // null = both
};

// ─── Data loaders ─────────────────────────────────────────────────────────────

function loadCandidates(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      try { return JSON.parse(line); }
      catch (e) { throw new Error(`candidates line ${i + 1}: ${e.message}`); }
    });
}

function loadBarsByDate(sessionsRoot, dates) {
  const barsByDate = {};
  for (const date of dates) {
    const fp = path.join(path.resolve(sessionsRoot), `${date}.json`);
    if (!fs.existsSync(fp)) {
      console.warn(`  [warn] No session file for ${date} - trades on this date will timeout`);
      barsByDate[date] = [];
      continue;
    }
    const session = JSON.parse(fs.readFileSync(fp, 'utf8'));
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
    } else if (flag === '--portfolios' || flag === '--portfolio') {
      if (next === 'all') {
        args.portfolios = null;
      } else {
        const valid = new Set(Object.keys(PORTFOLIO_CONFIGS));
        args.portfolios = next.split(',').map(s => s.trim()).map(s => {
          if (!valid.has(s)) throw new Error(`Unknown portfolio: "${s}". Valid: ${[...valid].join(', ')}`);
          return s;
        });
      }
      i++;
    } else if (flag === '--mode' || flag === '--modes') {
      if (next === 'stop_first')   args.modes = [RESOLUTION_MODES.STOP_FIRST];
      else if (next === 'target_first') args.modes = [RESOLUTION_MODES.TARGET_FIRST];
      else if (next === 'both')    args.modes = null;
      else throw new Error(`Unknown --mode: "${next}". Use: stop_first | target_first | both`);
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
    '  node scripts/run-combined-atm-backtest.js [options]',
    '',
    'Options:',
    '  --candidates <path>    JSONL candidate file',
    `                         (default: derived/long-candidates.jsonl)`,
    '  --sessions-root <dir>  Session JSON directory',
    `                         (default: sessions/)`,
    '  --out <dir>            Output directory',
    `                         (default: reports/)`,
    '  --portfolios all|<comma-separated>',
    `                         Portfolio configs to run (default: all)`,
    `                         Valid: ${Object.keys(PORTFOLIO_CONFIGS).join(', ')}`,
    '  --mode stop_first|target_first|both',
    '                         Bar conflict resolution mode (default: both)',
    '',
    `Apex config: $${APEX_START_BALANCE.toLocaleString()} start | $${APEX_TRAILING_DRAWDOWN.toLocaleString()} EOD trailing drawdown`,
    '',
    'Examples:',
    '  node scripts/run-combined-atm-backtest.js',
    '  node scripts/run-combined-atm-backtest.js --portfolios standard_3c_plus_atm_3pt --mode target_first',
    '  node scripts/run-combined-atm-backtest.js --portfolios standard_3c_only,atm_3pt_only',
  ].join('\n');
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtDollar(n) {
  if (n === null || n === undefined) return '-';
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function fmtPct(n) {
  return n === null ? '-' : `${n.toFixed(2)}%`;
}

function fmtR(n) {
  return (n === null || n === undefined) ? '-' : n.toFixed(4);
}

function fmtBreach(breached) {
  return breached ? '**YES**' : 'no';
}

function laneLabel(lane) {
  return `\`${lane.strategyId}\` | \`${lane.executionPolicy}\``;
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

function buildMarkdown(result, args) {
  const { runs, candidateCount, apexConfig, generatedAt } = result;
  const runKeys = Object.keys(runs);

  const lines = [];

  // ── Header ──
  lines.push(
    '# Combined Portfolio Backtest Report',
    '',
    `**Generated:** ${generatedAt}`,
    `**Candidates:** ${candidateCount}`,
    `**Sessions root:** \`${args.sessionsRoot}\``,
    `**Apex baseline:** $${apexConfig.startingBalance.toLocaleString()} start | ` +
      `$${apexConfig.trailingDrawdownLimit.toLocaleString()} EOD trailing drawdown (Apex 50k EOD Trail)`,
    '',
    '> Each portfolio combines multiple strategy lanes into one chronological equity curve.',
    '> Trades are deduplicated by candidateId+strategyId - same candidate/strategy cannot appear twice.',
    '> Standard 3c takes all 3 contracts at `targets[0]` (first mancini/saty level).',
    '> ATM scalp variants skipped when `riskRewardOk: false`.',
    '',
  );

  // ── Portfolio summary table ──
  lines.push('## Portfolio Summary', '');
  lines.push('| Portfolio | Mode | Trades | Eligible | Win% | Avg R | Total P&L | Max DD | Apex Breach |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---|');

  for (const key of runKeys) {
    const { lanes, mode, tradeCount, metrics } = runs[key];
    const portfolioName = key.replace(`__${mode}`, '');
    const eligible = tradeCount - metrics.noSetup;
    lines.push(
      `| ${portfolioName} | ${mode} | ${tradeCount} | ${eligible} | ` +
      `${fmtPct(metrics.winRate)} | ${fmtR(metrics.avgR)} | ` +
      `${fmtDollar(metrics.totalPnl)} | ${fmtDollar(metrics.maxDrawdown)} | ` +
      `${fmtBreach(metrics.apexBreached)} |`
    );
  }
  lines.push('');

  // ── Apex breach summary ──
  lines.push('## Apex EOD Breach Days', '');
  const breachedKeys = runKeys.filter(k => runs[k].metrics.apexBreached);

  if (breachedKeys.length === 0) {
    lines.push('_No Apex EOD trailing drawdown breaches across any portfolio run._', '');
  } else {
    lines.push(
      `> **Breach condition:** EOD equity fell below (trailing high - $${apexConfig.trailingDrawdownLimit.toLocaleString()})`,
      '',
    );
    for (const key of breachedKeys) {
      const { metrics } = runs[key];
      lines.push(`### ${key}`, '');
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

  // ── Per-portfolio detail ──
  lines.push('## Portfolio Detail', '');

  // Group run keys by portfolio name
  const portfolioNames = [...new Set(runKeys.map(k => {
    const parts = k.split('__');
    // mode is the last part; portfolio name may contain underscores
    return parts.slice(0, -1).join('__');
  }))];

  for (const portfolioName of portfolioNames) {
    const portfolioKeys = runKeys.filter(k => k.startsWith(`${portfolioName}__`));
    const firstKey = portfolioKeys[0];

    lines.push(`### Portfolio: \`${portfolioName}\``, '');

    // Lane config
    const { lanes } = runs[firstKey];
    lines.push('**Lanes:**', '');
    for (const lane of lanes) {
      lines.push(`- ${laneLabel(lane)}`);
    }
    lines.push('');

    // Cross-date daily P&L table for this portfolio (stop vs target)
    const allDates = [...new Set(
      portfolioKeys.flatMap(k => runs[k].metrics.equityCurve.map(pt => pt.date))
    )].sort();

    if (allDates.length > 0) {
      const modeLabels = portfolioKeys.map(k => k.replace(`${portfolioName}__`, ''));
      lines.push('**Daily P&L**', '');
      lines.push(`| Date | ${modeLabels.join(' | ')} |`);
      lines.push(`|---|${portfolioKeys.map(() => '---:').join('|')}|`);
      for (const date of allDates) {
        const cells = portfolioKeys.map(k => {
          const pt     = runs[k].metrics.equityCurve.find(r => r.date === date);
          if (!pt) return '-';
          const breach = runs[k].metrics.apexBreachDays.some(b => b.date === date);
          const label  = fmtDollar(pt.dayPnl);
          return breach ? `**${label} BREACH**` : label;
        });
        lines.push(`| ${date} | ${cells.join(' | ')} |`);
      }
      lines.push('');
    }

    // EOD equity curve per mode
    for (const key of portfolioKeys) {
      const mode = key.replace(`${portfolioName}__`, '');
      const { metrics } = runs[key];
      if (metrics.equityCurve.length === 0) continue;

      lines.push(`**EOD Equity Curve - ${mode}**`, '');
      lines.push('| Date | Day P&L | EOD Equity | Trailing High | Apex Floor | Drawdown |');
      lines.push('|---|---:|---:|---:|---:|---:|');
      for (const pt of metrics.equityCurve) {
        const breach  = metrics.apexBreachDays.some(b => b.date === pt.date);
        const dateLbl = breach ? `**${pt.date} BREACH**` : pt.date;
        lines.push(
          `| ${dateLbl} | ${fmtDollar(pt.dayPnl)} | ${fmtDollar(pt.equity)} ` +
          `| ${fmtDollar(pt.trailingHigh)} | ${fmtDollar(pt.apexFloor)} | ${fmtDollar(pt.drawdown)} |`
        );
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    '',
    '*Generated by `run-combined-atm-backtest.js` - Luke project. Offline only.*',
    '',
  );

  return lines.join('\n');
}

// ─── Console summary table ────────────────────────────────────────────────────

function printSummary(result) {
  const { runs } = result;
  const runKeys  = Object.keys(runs);

  const COL = { label: 44, winPct: 7, avgR: 8, pnl: 12, maxDD: 11, breach: 7 };

  const pad = (s, n, right = false) => {
    const str = String(s);
    return right ? str.padStart(n) : str.padEnd(n);
  };

  const divider =
    `  ${'-'.repeat(COL.label)} ${'-'.repeat(COL.winPct)} ` +
    `${'-'.repeat(COL.avgR)} ${'-'.repeat(COL.pnl)} ${'-'.repeat(COL.maxDD)} ${'-'.repeat(COL.breach)}`;

  console.log(
    `\n  ${pad('Portfolio / Mode', COL.label)} ` +
    `${pad('Win%', COL.winPct, true)} ` +
    `${pad('Avg R', COL.avgR, true)} ` +
    `${pad('Total P&L', COL.pnl, true)} ` +
    `${pad('Max DD', COL.maxDD, true)} ` +
    `Breach`
  );
  console.log(divider);

  for (const key of runKeys) {
    const { metrics } = runs[key];
    console.log(
      `  ${pad(key, COL.label)}` +
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

  console.log('[combined-portfolio] Loading candidates...');
  const candidates = loadCandidates(args.candidates);
  console.log(`  ${candidates.length} candidates from ${path.relative(ROOT, path.resolve(args.candidates))}`);

  const uniqueDates = [...new Set(candidates.map(c => c.date))].sort();
  console.log(`  Dates: ${uniqueDates.join(', ')}`);

  console.log('[combined-portfolio] Loading session bars...');
  const barsByDate = loadBarsByDate(args.sessionsRoot, uniqueDates);
  for (const date of uniqueDates) {
    console.log(`  ${date}: ${(barsByDate[date] || []).length} bars`);
  }

  const portfolioNames = args.portfolios || Object.keys(PORTFOLIO_CONFIGS);
  console.log(`[combined-portfolio] Running portfolios: ${portfolioNames.join(', ')}`);

  const simOptions = { portfolios: args.portfolios };
  if (args.modes) simOptions.modes = args.modes;

  const result = simulateCombinedPortfolios(candidates, barsByDate, simOptions);

  printSummary(result);

  // Write outputs
  fs.mkdirSync(path.resolve(args.outDir), { recursive: true });
  const stamp    = new Date().toISOString().replace(/[:.]/g, '-');
  const base     = path.join(path.resolve(args.outDir), `combined-portfolio-${stamp}`);
  const jsonPath = `${base}.json`;
  const mdPath   = `${base}.md`;

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  fs.writeFileSync(mdPath,   buildMarkdown(result, args), 'utf8');

  console.log(`[combined-portfolio] Done in ${Date.now() - t0}ms`);
  console.log(`  JSON -> ${path.relative(ROOT, jsonPath)}`);
  console.log(`  MD   -> ${path.relative(ROOT, mdPath)}`);
}

if (require.main === module) main();

module.exports = { parseArgs, loadCandidates, loadBarsByDate, buildMarkdown };
