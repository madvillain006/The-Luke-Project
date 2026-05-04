'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'artifacts', 'OPERATOR_SURFACE_COMPARISON_LATEST.md');
const DEFAULT_BASE_URL = process.env.LUKE_OPERATOR_BASE_URL || 'http://127.0.0.1:3000';
const TIMEOUT_MS = Number(process.env.LUKE_OPERATOR_COMPARE_TIMEOUT_MS || 15000);

const OLD_COMMANDS = {
  status: '/status',
  entries: '/entries ES',
  verdict: '/verdict ES',
};

const NEW_ENDPOINTS = {
  operatorStatus: '/api/operator/status',
  operatorReadiness: '/api/operator/readiness',
  decision: '/api/decision?instrument=ES&mode=manual',
  confluence: '/api/confluence?instrument=ES',
};

const AUTONOMOUS_ENDPOINTS = {
  preflight: '/agent/autonomous/preflight',
};

function withTimeout(ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

function retryDelayMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 65000);
  return 1500;
}

async function fetchJson(baseUrl, endpoint, options = {}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { controller, done } = withTimeout();
    try {
      const response = await fetch(new URL(endpoint, baseUrl), {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
      if (response.status === 429 && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs(response)));
        continue;
      }
      return {
        ok: response.ok,
        status: response.status,
        endpoint,
        body,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      if (attempt === 2) {
        return {
          ok: false,
          status: null,
          endpoint,
          body: null,
          error: err.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : err.message,
        };
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      done();
    }
  }
}

async function postReadOnlySlash(baseUrl, command) {
  return fetchJson(baseUrl, '/chat', {
    method: 'POST',
    body: JSON.stringify({ message: command, history: [] }),
  });
}

async function collectSurfaces(baseUrl = DEFAULT_BASE_URL) {
  const results = {
    baseUrl,
    collected_at: new Date().toISOString(),
    old: {},
    new: {},
    autonomous: {},
    errors: [],
    limitations: [
      'Old slash-command surfaces are collected through POST /chat with read-only commands only.',
      'If /chat is unavailable, old surface fields are marked missing and compared against adapter/API data where possible.',
      'The script writes only artifacts/OPERATOR_SURFACE_COMPARISON_LATEST.md and does not call execution or parser ingestion routes.',
    ],
  };

  for (const [key, command] of Object.entries(OLD_COMMANDS)) {
    const response = await postReadOnlySlash(baseUrl, command);
    results.old[key] = { command, response };
    if (!response.ok) results.errors.push(`old ${command}: ${response.error}`);
  }

  for (const [key, endpoint] of Object.entries(AUTONOMOUS_ENDPOINTS)) {
    const response = await fetchJson(baseUrl, endpoint, { method: 'GET' });
    results.autonomous[key] = { endpoint, response };
    if (!response.ok) results.errors.push(`autonomous ${endpoint}: ${response.error}`);
  }

  for (const [key, endpoint] of Object.entries(NEW_ENDPOINTS)) {
    const response = await fetchJson(baseUrl, endpoint, { method: 'GET' });
    results.new[key] = { endpoint, response };
    if (!response.ok) results.errors.push(`new ${endpoint}: ${response.error}`);
  }

  return results;
}

function replyText(surface) {
  return surface?.response?.body?.reply || surface?.response?.body?.raw || '';
}

function parseFreshnessText(text) {
  const line = String(text || '').split('\n').find(row => /^Freshness:/i.test(row.trim()));
  if (!line) return null;
  const read = label => {
    const match = line.match(new RegExp(`${label}\\s+(OK|MISSING)(?:\\s*\\((\\d+)\\))?`, 'i'));
    if (!match) return null;
    return { loaded: match[1].toUpperCase() === 'OK', count: match[2] ? Number(match[2]) : null };
  };
  return {
    saty: read('Saty'),
    dubz: read('Dubz'),
    bobby: read('Bobby'),
  };
}

function parseStatusReply(text) {
  const reply = String(text || '');
  return {
    freshness: parseFreshnessText(reply),
    recommendation_only: /recommendation-only/i.test(reply),
    staged_only: /staged-only|recommendation-only/i.test(reply),
    risk_blockers: [
      ...reply.split('\n').filter(line => /Apex|kill|blocked|floor|pending|open position/i.test(line)),
    ],
  };
}

function numberFrom(pattern, text) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseEntriesReply(text) {
  const reply = String(text || '');
  const recommendation = reply.split('\n').find(line => /^Recommendation:/i.test(line)) || '';
  const anchorLine = reply.split('\n').find(line => /^Anchor:/i.test(line)) || '';
  const planLine = reply.split('\n').find(line => /^(Plan|Reference only):/i.test(line)) || '';
  const vetoLine = reply.split('\n').find(line => /^Vetoes:/i.test(line)) || '';

  let action = null;
  if (/No fresh entries|Recommendation:\s*PASS|SKIP CHASE|WAIT/i.test(reply)) action = 'PASS';
  const actionMatch = recommendation.match(/\|\s*(LONG|SHORT)\s+/i) || recommendation.match(/Recommendation:\s*(LONG|SHORT)\s+/i);
  if (actionMatch && !/SKIP CHASE|WAIT/i.test(recommendation)) action = actionMatch[1].toUpperCase();
  if (!action && /(LONG|SHORT)/i.test(anchorLine)) {
    const sideMatch = anchorLine.match(/side\s+(LONG|SHORT)/i);
    action = sideMatch ? sideMatch[1].toUpperCase() : null;
  }

  const sideMatch = anchorLine.match(/side\s+(LONG|SHORT)/i);
  const anchorMatch = anchorLine.match(/Anchor:\s+\S+\s+([\d.]+)/i);
  const vetoText = vetoLine ? vetoLine.replace(/^Vetoes:\s*/i, '').trim() : null;

  return {
    freshness: parseFreshnessText(reply),
    action,
    anchor: anchorMatch ? Number(anchorMatch[1]) : null,
    side: sideMatch ? sideMatch[1].toUpperCase() : null,
    entry: numberFrom(/\bentry\s+([\d.]+)/i, planLine),
    acceptable_entry: numberFrom(/\bok\s+([\d.]+)/i, planLine),
    stop: numberFrom(/\bstop\s+([\d.]+)/i, planLine),
    target: numberFrom(/\btarget\s+([\d.]+)/i, planLine),
    sizing: (anchorLine.match(/\|\s*(full|half|quarter|pass)\s+size/i) || [])[1] || null,
    vetoes: vetoText ? [vetoText] : null,
    raw_recommendation: recommendation || null,
  };
}

function parseVerdictReply(text) {
  const rows = String(text || '').split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- **') || /^-\s+(ES|SPX|SPY|NQ|QQQ)\b/i.test(line));
  return {
    row_count: rows.length,
    top_rows: rows.slice(0, 5).map(normalizeMarkdownRow),
  };
}

function normalizeMarkdownRow(row) {
  return String(row || '').replace(/\*\*/g, '').replace(/→/g, '->').replace(/\s+/g, ' ').trim();
}

function freshnessFromApi(value) {
  const freshness = value?.freshness || value?.decision?.freshness;
  if (!freshness) return null;
  return {
    saty: freshness.saty ? { loaded: Boolean(freshness.saty.loaded), count: freshness.saty.count ?? null } : null,
    dubz: freshness.dubz ? { loaded: Boolean(freshness.dubz.loaded), count: freshness.dubz.count ?? null } : null,
    bobby: freshness.bobby ? { loaded: Boolean(freshness.bobby.loaded), count: freshness.bobby.count ?? null } : null,
  };
}

function normalizeDecisionApi(value) {
  const decision = value?.decision || value?.summary || value;
  if (!decision) return {};
  return {
    freshness: freshnessFromApi(value),
    action: decision.action || null,
    anchor: decision.confluence?.anchor ?? decision.anchor ?? null,
    side: decision.action === 'LONG' || decision.action === 'SHORT' ? decision.action : (decision.side || null),
    entry: decision.entry ?? null,
    acceptable_entry: decision.acceptable_entry ?? null,
    stop: decision.stop ?? null,
    target: decision.target ?? null,
    sizing: decision.sizing ?? null,
    vetoes: Array.isArray(decision.vetoes) && decision.vetoes.length
      ? decision.vetoes.map(v => v.type || JSON.stringify(v))
      : ['none active'],
  };
}

function normalizeConfluenceApi(value) {
  const rows = Array.isArray(value?.rows) ? value.rows.map(row => normalizeMarkdownRow(row.markdown || row.raw || row)) : [];
  return {
    row_count: rows.length,
    top_rows: rows.slice(0, 5),
  };
}

function normalizeOperatorStatus(value) {
  const recommendationOnly = value?.autonomous?.recommendation_only ?? value?.risk_status?.recommendation_only ?? null;
  return {
    freshness: freshnessFromApi(value),
    risk_blockers: value?.blockers || value?.risk_status?.blockers || null,
    recommendation_only: recommendationOnly,
    staged_only: value?.autonomous?.staged_only ?? value?.risk_status?.staged_only ?? null,
  };
}

function normalizePreflight(value) {
  const recommendationOnly = value?.recommendation_only ?? value?.risk_status?.recommendation_only ?? null;
  return {
    freshness: freshnessFromApi(value),
    risk_blockers: value?.blockers || null,
    recommendation_only: recommendationOnly,
    staged_only: value?.staged_only ?? value?.risk_status?.staged_only ?? null,
    action: value?.decision?.action || null,
    anchor: value?.decision?.confluence?.anchor ?? null,
    side: value?.decision?.action === 'LONG' || value?.decision?.action === 'SHORT' ? value.decision.action : null,
    entry: value?.decision?.entry ?? null,
    acceptable_entry: value?.decision?.acceptable_entry ?? null,
    stop: value?.decision?.stop ?? null,
    target: value?.decision?.target ?? null,
    sizing: value?.decision?.sizing ?? null,
    vetoes: Array.isArray(value?.decision?.vetoes) && value.decision.vetoes.length
      ? value.decision.vetoes.map(v => v.type || JSON.stringify(v))
      : ['none active'],
  };
}

function isMissing(value) {
  return value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0);
}

function stable(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(stable).sort());
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'count' && value.loaded === false && (value[key] === null || value[key] === undefined)) {
        out[key] = 0;
      } else {
        out[key] = stable(value[key]);
      }
    }
    return out;
  }
  return value;
}

function compareField(oldValue, newValue) {
  const oldMissing = isMissing(oldValue);
  const newMissing = isMissing(newValue);
  if (oldMissing && newMissing) return 'NOT_APPLICABLE';
  if (oldMissing) return 'MISSING_OLD';
  if (newMissing) return 'MISSING_NEW';
  return JSON.stringify(stable(oldValue)) === JSON.stringify(stable(newValue)) ? 'MATCH' : 'MISMATCH';
}

function buildComparison(collected) {
  const oldStatus = parseStatusReply(replyText(collected.old.status));
  const oldEntries = parseEntriesReply(replyText(collected.old.entries));
  const oldVerdict = parseVerdictReply(replyText(collected.old.verdict));
  const oldPreflight = normalizePreflight(collected.autonomous.preflight?.response?.body);

  const newStatus = normalizeOperatorStatus(collected.new.operatorStatus?.response?.body);
  const newReadiness = normalizePreflight(collected.new.operatorReadiness?.response?.body);
  const newDecision = normalizeDecisionApi(collected.new.decision?.response?.body);
  const newConfluence = normalizeConfluenceApi(collected.new.confluence?.response?.body);

  const rows = [
    ['freshness', oldEntries.freshness || oldStatus.freshness || oldPreflight.freshness, newDecision.freshness || newStatus.freshness || newReadiness.freshness],
    ['action', oldEntries.action || oldPreflight.action, newDecision.action || newReadiness.action],
    ['anchor', oldEntries.anchor || oldPreflight.anchor, newDecision.anchor || newReadiness.anchor],
    ['side', oldEntries.side || oldPreflight.side, newDecision.side || newReadiness.side],
    ['entry', oldEntries.entry || oldPreflight.entry, newDecision.entry || newReadiness.entry],
    ['acceptable entry', oldEntries.acceptable_entry || oldPreflight.acceptable_entry, newDecision.acceptable_entry || newReadiness.acceptable_entry],
    ['stop', oldEntries.stop || oldPreflight.stop, newDecision.stop || newReadiness.stop],
    ['target', oldEntries.target || oldPreflight.target, newDecision.target || newReadiness.target],
    ['sizing', oldEntries.sizing || oldPreflight.sizing, newDecision.sizing || newReadiness.sizing],
    ['vetoes', oldEntries.vetoes || oldPreflight.vetoes, newDecision.vetoes || newReadiness.vetoes],
    ['risk blockers', oldStatus.risk_blockers || oldPreflight.risk_blockers, newStatus.risk_blockers || newReadiness.risk_blockers],
    ['autonomous recommendation-only state', oldStatus.recommendation_only || oldPreflight.recommendation_only, newStatus.recommendation_only || newReadiness.recommendation_only],
    ['confluence row count', oldVerdict.row_count, newConfluence.row_count],
    ['confluence top rows', oldVerdict.top_rows, newConfluence.top_rows],
  ].map(([field, oldValue, newValue]) => ({
    field,
    oldValue,
    newValue,
    status: compareField(oldValue, newValue),
  }));

  return {
    old: { status: oldStatus, entries: oldEntries, verdict: oldVerdict, preflight: oldPreflight },
    new: { status: newStatus, readiness: newReadiness, decision: newDecision, confluence: newConfluence },
    rows,
  };
}

function formatValue(value) {
  if (isMissing(value)) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `\`${JSON.stringify(value).replace(/`/g, '\\`')}\``;
}

function endpointStatusLine(label, item) {
  const response = item?.response;
  if (!response) return `- ${label}: not collected`;
  return `- ${label}: ${response.ok ? 'OK' : 'ERROR'}${response.status ? ` HTTP ${response.status}` : ''}${response.error ? ` - ${response.error}` : ''}`;
}

function renderReport(collected, comparison) {
  const lines = [];
  lines.push('# Operator Surface Comparison - Latest');
  lines.push('');
  lines.push(`Generated: ${collected.collected_at}`);
  lines.push(`Base URL: ${collected.baseUrl}`);
  lines.push('');
  lines.push('## Collection Status');
  lines.push('');
  lines.push(endpointStatusLine('/status via /chat', collected.old.status));
  lines.push(endpointStatusLine('/entries ES via /chat', collected.old.entries));
  lines.push(endpointStatusLine('/verdict ES via /chat', collected.old.verdict));
  lines.push(endpointStatusLine('/agent/autonomous/preflight', collected.autonomous.preflight));
  lines.push(endpointStatusLine('/api/operator/status', collected.new.operatorStatus));
  lines.push(endpointStatusLine('/api/operator/readiness', collected.new.operatorReadiness));
  lines.push(endpointStatusLine('/api/decision?instrument=ES&mode=manual', collected.new.decision));
  lines.push(endpointStatusLine('/api/confluence?instrument=ES', collected.new.confluence));
  lines.push('');

  if (collected.errors.length > 0) {
    lines.push('## Collection Errors');
    lines.push('');
    for (const error of collected.errors) lines.push(`- ${error}`);
    lines.push('');
  }

  lines.push('## Limitations');
  lines.push('');
  for (const limitation of collected.limitations) lines.push(`- ${limitation}`);
  lines.push('');
  lines.push('## Comparison');
  lines.push('');
  lines.push('| Field | Status | Old Surface | Operator V2/API |');
  lines.push('| --- | --- | --- | --- |');
  for (const row of comparison.rows) {
    lines.push(`| ${row.field} | ${row.status} | ${formatValue(row.oldValue)} | ${formatValue(row.newValue)} |`);
  }
  lines.push('');
  lines.push('## Raw Parsed Old Surface Summary');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(comparison.old, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Raw Parsed Operator/API Summary');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(comparison.new, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Safety Notes');
  lines.push('');
  lines.push('- This script does not call execution endpoints.');
  lines.push('- This script does not call parser ingestion endpoints.');
  lines.push('- This script does not write trading state.');
  lines.push('- The only file written by this script is this markdown report.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  const collected = await collectSurfaces(baseUrl);
  const comparison = buildComparison(collected);
  const report = renderReport(collected, comparison);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report, 'utf8');
  console.log(`Wrote ${OUT_FILE}`);
  if (collected.errors.length > 0) {
    console.log(`Completed with ${collected.errors.length} collection error(s). See report.`);
  }
}

if (require.main === module) {
  main().catch(err => {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, [
      '# Operator Surface Comparison - Latest',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Fatal Error',
      '',
      err.stack || err.message,
      '',
    ].join('\n'), 'utf8');
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  OLD_COMMANDS,
  NEW_ENDPOINTS,
  AUTONOMOUS_ENDPOINTS,
  parseFreshnessText,
  parseStatusReply,
  parseEntriesReply,
  parseVerdictReply,
  normalizeDecisionApi,
  normalizeConfluenceApi,
  normalizeOperatorStatus,
  normalizePreflight,
  compareField,
  buildComparison,
  renderReport,
  collectSurfaces,
};
