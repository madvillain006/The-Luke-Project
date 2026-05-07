#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseManualDiscordPaste } = require('../lib/kat-stage2/manual-paste');
const { parseSybilContexts } = require('../lib/kat-stage2/sybil');
const { ensureDir, sha256 } = require('../lib/kat-stage2/io');

const LUKE_ROOT = path.join(__dirname, '..');
const JARVIS_ROOT = process.env.JARVIS_ROOT || 'C:\\Users\\conor\\jarvis';
const OUT_DIR = path.join(LUKE_ROOT, 'data', 'research', 'sybil-katbot');

const TEXT_EXT = new Set(['.txt', '.json', '.jsonl', '.md', '.log']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'media']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.mp4', '.mov']);

const TAG_RULES = [
  ['entity_resolution', /\bambiguous|wrong symbol|exact ticker|exchange|company name|screenshot|link|clarif(?:y|ication)|corrected\b/i],
  ['first_pass_dd', /\bquick DD|first-pass|proper first-pass|what it is|actual take|bull case|bear case|bottom line\b/i],
  ['chart_tape', /\bchart|tape|trend|momentum|RSI|MACD|buy zone|sell zone|resistance zone|support zone\b/i],
  ['valuation', /\bmarket cap|P\/S|price\/sales|EV\/Revenue|forward P\/E|trailing P\/E|valuation|multiple\b/i],
  ['short_interest', /\bshort interest|short float|squeeze|squeeze-y|squeezier\b/i],
  ['spotgamma_options', /\bSpotGamma|Equity Hub|HIRO|Low Vol Point|High Vol Point|Options Impact|Call Gamma|Put Gamma|Hedge Wall|Call Wall|Put Wall|Key Gamma|Key Delta\b/i],
  ['event_stack', /\bevent stack|earnings|summit|binary events?|catalyst|Trump-Xi|FOMC|CPI|PPI|PCE\b/i],
  ['expression_map', /\bcalls?|puts?|straddle|strangle|spread|options expression|trade sheet|strike|expiry|expir(?:y|ation)\b/i],
  ['reconciliation', /\breconcil|what I agree with|where .* fits|both can be true|thesis|structure read\b/i],
  ['what_kills_it', /\bwhat kills it|fails?|invalid|muddle-through|bear case|breaks lower|loses support|stalls under\b/i],
  ['risk_on', /\brisk[-\s]?on|breadth expanding|rotation into growth|soft landing|liquidity\b/i],
  ['risk_off', /\brisk[-\s]?off|de[-\s]?risk|flight to safety|defensive|selloff|drawdown|hard landing\b/i],
  ['volatility', /\bvol(?:atility)?|VIX|IV|implied vol|realized vol|vol crush|vol expansion\b/i],
  ['gamma_gex', /\bgamma|GEX|dealer|charm|vanna|pinning|zero gamma|call wall|put wall\b/i],
  ['rates', /\brates?|yields?|treasury|TNX|Fed|FOMC|cuts?|hikes?|duration\b/i],
  ['inflation', /\bCPI|PPI|inflation|deflation|disinflation|PCE\b/i],
  ['oil_energy', /\boil|crude|WTI|Brent|energy\b/i],
  ['breadth', /\bbreadth|advance.?decline|participation|new highs|new lows\b/i],
  ['positioning', /\bpositioning|flows?|crowded|hedging|overhead supply|call supply|capping upside\b/i],
  ['ai_software', /\bAI|software|SaaS|cloud|semis?|chips?|NVDA|AMD|AVGO|MSFT|Figma|FIG\b/i],
  ['china', /\bBABA|FXI|ASHR|KWEB|China|Trump-Xi|onshore|ADR\b/i],
  ['katbot_confluence', /\bKatBot|Katbot|confluence|heatmap|king node|air pocket|Bobby\b/i],
  ['pine_futures', /\bPine|Luke Watch|LUKE WATCH|ES|NQ|MES|MNQ|futures|TradingView\b/i],
  ['autonomous_gating', /\bautonomous|02B|staged|paper trade|live order|execution gate|no execution|watchlist only\b/i],
];

const SYMBOL_RE = /\$?\b(SPX|SPY|SPXW|ES|MES|QQQ|NDX|NQ|MNQ|VIX|FIG|FIGS|BABA|FXI|ASHR|KWEB|ADBE|TEAM|MDB|SNOW|NVDA|AMD|AVGO|MSFT|JPM|GS|UBS|AAPL|TSLA|META|COIN)\b/g;

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walkFiles(base) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SKIP_EXT.has(ext)) continue;
        if (TEXT_EXT.has(ext)) out.push(full);
      }
    }
  }
  if (fs.existsSync(base)) walk(base);
  return out;
}

function candidateFiles(root) {
  const dirs = [
    path.join(root, 'discord-exports'),
    path.join(root, 'state', 'events'),
  ];
  const files = [];
  for (const dir of dirs) files.push(...walkFiles(dir));
  for (const name of ['discord-history.jsonl', 'jarvis-log.jsonl', 'luke-log.jsonl']) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) files.push(file);
  }
  return [...new Set(files)].filter(file => {
    const lower = file.toLowerCase();
    return lower.includes('discord') ||
      lower.includes('sybil') ||
      lower.includes('bobby') ||
      lower.includes('ximes') ||
      lower.includes('dubz') ||
      lower.includes('kat') ||
      lower.includes('history') ||
      lower.includes('log');
  });
}

function tagsFor(text) {
  return TAG_RULES.filter(([, re]) => re.test(text)).map(([tag]) => tag);
}

function symbolsFor(text) {
  const out = new Set();
  for (const match of String(text || '').matchAll(SYMBOL_RE)) out.add(match[1].toUpperCase().replace('SPXW', 'SPX'));
  return [...out].slice(0, 30);
}

function compact(text, max = 360) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  return source.length <= max ? source : source.slice(0, max - 3).trimEnd() + '...';
}

function addCounts(target, values) {
  for (const value of values || []) target[value] = (target[value] || 0) + 1;
}

function parseDiscordJson(file, json) {
  if (json && Array.isArray(json.messages)) {
    const channel = json.channel?.name || json.channelName || null;
    const guild = json.guild?.name || null;
    return (json.messages || []).map(message => ({
      timestamp_utc: message.timestamp ? new Date(message.timestamp).toISOString() : null,
      channel_name: channel,
      guild,
      author_name: message.author?.name || message.author?.nickname || null,
      raw_text: String(message.content || ''),
      attachment_count: Array.isArray(message.attachments) ? message.attachments.length : 0,
    }));
  }
  if (json && Array.isArray(json.attachments)) {
    return [{
      timestamp_utc: null,
      channel_name: 'media-manifest',
      author_name: null,
      raw_text: `media manifest attachments=${json.attachments.length}`,
      attachment_count: json.attachments.length,
    }];
  }
  return [];
}

function parseJsonlLines(file, text) {
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const base = {
      timestamp_utc: row.timestamp || row.date || row.ts || null,
      channel_name: row.channel || row.channel_name || null,
      author_name: row.author || row.username || row.user || null,
    };
    const textFields = [
      row.content,
      row.raw,
      row.text,
      row.message,
      row.insights,
      row.reply,
    ].filter(Boolean);
    if (Array.isArray(row.results)) {
      for (const result of row.results) {
        const raw = [result.raw, result.content, result.insights, result.text, result.signal_type]
          .filter(Boolean)
          .join('\n');
        if (raw) rows.push({ ...base, raw_text: raw, attachment_count: 0 });
      }
    }
    if (textFields.length) rows.push({ ...base, raw_text: textFields.join('\n'), attachment_count: 0 });
    if (!textFields.length && !Array.isArray(row.results)) {
      rows.push({ ...base, raw_text: compact(JSON.stringify(row), 500), attachment_count: 0, line: index + 1 });
    }
  }
  return rows;
}

function parseTextExport(file, text) {
  const pastedRows = parseManualDiscordPaste(text, {
    baseDate: '2026-05-07',
    channelName: path.basename(file, path.extname(file)),
    provenanceNote: 'bulk discord log scan',
    idPrefix: 'bulk_discord',
  });
  if (pastedRows.length > 1) {
    return pastedRows.map(row => ({
      timestamp_utc: row.timestamp_utc,
      channel_name: row.channel_name,
      author_name: row.author_name,
      raw_text: row.raw_text,
      attachment_count: 0,
    }));
  }

  const chunks = text.split(/\n\s*\n+/).map(chunk => chunk.trim()).filter(Boolean);
  if (chunks.length > 1) {
    return chunks.map(chunk => ({
      timestamp_utc: null,
      channel_name: path.basename(file, path.extname(file)),
      author_name: null,
      raw_text: chunk,
      attachment_count: 0,
    }));
  }
  return [{
    timestamp_utc: null,
    channel_name: path.basename(file, path.extname(file)),
    author_name: null,
    raw_text: text,
    attachment_count: 0,
  }];
}

function loadFileRecords(file) {
  const ext = path.extname(file).toLowerCase();
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (err) {
    return { error: err.message, records: [] };
  }
  if (ext === '.json') {
    try {
      const json = JSON.parse(text);
      return { records: parseDiscordJson(file, json) };
    } catch {
      return { records: parseTextExport(file, text) };
    }
  }
  if (ext === '.jsonl' || ext === '.log') return { records: parseJsonlLines(file, text) };
  return { records: parseTextExport(file, text) };
}

function repoLabel(root) {
  return path.basename(root).toLowerCase() === 'jarvis' ? 'jarvis' : 'luke';
}

function sourceFamily(file, record) {
  const source = [file, record.channel_name, record.author_name].filter(Boolean).join(' ').toLowerCase();
  if (source.includes('sybil') || source.includes('sibyl')) return 'sybil';
  if (source.includes('bobby')) return 'bobby';
  if (source.includes('ximes') || source.includes('dubz') || source.includes('richy')) return 'ximes_dubz';
  if (source.includes('kat')) return 'katbot';
  if (source.includes('direct messages')) return 'dm_export';
  if (source.includes('processed')) return 'processed_export';
  return 'discord_log';
}

function analyzeRepo(root) {
  const files = candidateFiles(root);
  const repo = repoLabel(root);
  const inventory = [];
  const relevant = [];
  const totals = {
    files: 0,
    records: 0,
    attachments: 0,
    source_families: {},
    tags: {},
    symbols: {},
  };

  for (const file of files) {
    const loaded = loadFileRecords(file);
    const stat = fs.statSync(file);
    const fileSummary = {
      repo,
      path: file,
      relative_path: rel(root, file),
      bytes: stat.size,
      records: loaded.records.length,
      attachments: 0,
      source_families: {},
      tags: {},
      symbols: {},
      error: loaded.error || null,
    };
    totals.files += 1;
    totals.records += loaded.records.length;
    for (const record of loaded.records) {
      const raw = String(record.raw_text || '');
      const tags = tagsFor(raw);
      const symbols = symbolsFor(raw);
      const family = sourceFamily(file, record);
      const attachments = record.attachment_count || 0;
      fileSummary.attachments += attachments;
      totals.attachments += attachments;
      addCounts(fileSummary.source_families, [family]);
      addCounts(totals.source_families, [family]);
      addCounts(fileSummary.tags, tags);
      addCounts(totals.tags, tags);
      addCounts(fileSummary.symbols, symbols);
      addCounts(totals.symbols, symbols);
      if (tags.length || symbols.length || /sybil|sibyl|katbot/i.test(raw)) {
        relevant.push({
          record_id: sha256([repo, file, record.timestamp_utc, raw].join('|')).slice(0, 20),
          repo,
          path: file,
          relative_path: fileSummary.relative_path,
          source_family: family,
          timestamp_utc: record.timestamp_utc || null,
          channel_name: record.channel_name || null,
          author_name: record.author_name || null,
          tags,
          symbols,
          attachment_count: attachments,
          preview: compact(raw),
        });
      }
    }
    inventory.push(fileSummary);
  }
  return { repo, root, totals, inventory, relevant };
}

function topEntries(obj, limit = 20) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function buildMarkdown(results) {
  const lines = [];
  lines.push('# All Discord Log Sybil/KatBot Scan');
  lines.push('');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('');
  lines.push('Scope: readable text/JSON/JSONL Discord logs and exports in Luke and Jarvis. Binary media and image files were skipped.');
  lines.push('');
  for (const result of results) {
    lines.push(`## ${result.repo}`);
    lines.push('');
    lines.push(`- Files scanned: ${result.totals.files}`);
    lines.push(`- Records/messages/chunks scanned: ${result.totals.records}`);
    lines.push(`- Attachment metadata counted: ${result.totals.attachments}`);
    lines.push(`- Relevant tagged records: ${result.relevant.length}`);
    lines.push('');
    lines.push('Top source families:');
    for (const [family, count] of topEntries(result.totals.source_families, 12)) lines.push(`- ${family}: ${count}`);
    lines.push('');
    lines.push('Top tags:');
    for (const [tag, count] of topEntries(result.totals.tags, 20)) lines.push(`- ${tag}: ${count}`);
    lines.push('');
    lines.push('Top symbols:');
    for (const [symbol, count] of topEntries(result.totals.symbols, 20)) lines.push(`- ${symbol}: ${count}`);
    lines.push('');
    lines.push('| File | Records | Top tags | Top symbols |');
    lines.push('|---|---:|---|---|');
    for (const file of result.inventory.sort((a, b) => b.records - a.records).slice(0, 30)) {
      const tags = topEntries(file.tags, 5).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a';
      const symbols = topEntries(file.symbols, 5).map(([k, v]) => `${k}=${v}`).join(', ') || 'n/a';
      lines.push(`| \`${file.relative_path}\` | ${file.records} | ${tags} | ${symbols} |`);
    }
    lines.push('');
  }
  lines.push('## Operator Takeaways');
  lines.push('');
  lines.push('- Sybil-style behavior is broader than a feed: it combines entity resolution, DD templates, market structure, external research reconciliation, and expression selection.');
  lines.push('- KatBot regime behavior should treat this as selectivity and context, not trigger logic.');
  lines.push('- The new manual paste adapter should be the front door for user-pasted server/Sybil text in trading chat.');
  lines.push('- Keep these records out of trade-call counts unless another explicit parser proves ticker, direction, entry, stop, and target.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  ensureDir(OUT_DIR);
  const roots = [LUKE_ROOT];
  if (fs.existsSync(JARVIS_ROOT)) roots.push(JARVIS_ROOT);
  const results = roots.map(analyzeRepo);
  const inventory = results.flatMap(result => result.inventory);
  const relevant = results.flatMap(result => result.relevant);

  const inventoryPath = path.join(OUT_DIR, 'all-discord-log-inventory.json');
  const recordsPath = path.join(OUT_DIR, 'all-discord-theme-records.jsonl');
  const reportPath = path.join(OUT_DIR, 'all-discord-log-themes.md');
  fs.writeFileSync(inventoryPath, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2), 'utf8');
  fs.writeFileSync(recordsPath, relevant.map(row => JSON.stringify(row)).join('\n') + (relevant.length ? '\n' : ''), 'utf8');
  fs.writeFileSync(reportPath, buildMarkdown(results), 'utf8');
  console.log(JSON.stringify({
    ok: true,
    roots: roots.length,
    files: inventory.length,
    relevant_records: relevant.length,
    outputs: {
      inventory: inventoryPath,
      records: recordsPath,
      report: reportPath,
    },
  }, null, 2));
}

main();
