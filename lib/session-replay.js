'use strict';
const fs   = require('fs');
const path = require('path');

const REPLAY_FILE = path.join(__dirname, '../data/session-replay.jsonl');

// Ensure data dir exists at module load
const _dataDir = path.dirname(REPLAY_FILE);
if (!fs.existsSync(_dataDir)) {
  try { fs.mkdirSync(_dataDir, { recursive: true }); } catch {}
}

function appendReplay(entry) {
  try {
    fs.appendFileSync(REPLAY_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    console.error('[replay] write error:', e.message);
  }
}

function logSignalReplay({
  raw_input,
  analyst,
  signal_type,
  parsed,
  verdict,
  skip_reason,
  confluence_score,
  top_zone,
  rr,
  risk_dollars,
  apex_floor_headroom,
  regime,
  runner_active,
  ms_elapsed
}) {
  const now = new Date();
  appendReplay({
    ts:                  now.toISOString(),
    session_date:        now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
    raw_input:           raw_input   || null,
    analyst:             analyst     || 'manual',
    signal_type:         signal_type || null,
    parsed:              parsed      || null,
    verdict:             verdict     || 'UNKNOWN',
    skip_reason:         skip_reason || null,
    confluence_score:    confluence_score != null ? confluence_score : null,
    top_zone:            top_zone    || null,
    rr:                  rr          || null,
    risk_dollars:        risk_dollars != null ? risk_dollars : null,
    apex_floor_headroom: apex_floor_headroom != null ? apex_floor_headroom : null,
    regime:              regime      || null,
    runner_active:       runner_active || false,
    ms_elapsed:          ms_elapsed  || null
  });
}

function todaySummary() {
  if (!fs.existsSync(REPLAY_FILE)) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const lines  = fs.readFileSync(REPLAY_FILE, 'utf8').split('\n').filter(l => l.trim());
  const entries = lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(e => e && e.session_date === today);

  if (!entries.length) return null;

  const setups = entries.filter(e => e.verdict === 'SETUP').length;
  const weak   = entries.filter(e => e.verdict === 'WEAK').length;
  const skips  = entries.filter(e => e.verdict === 'SKIP').length;
  const blocks = entries.filter(e => e.verdict === 'BLOCK').length;
  const total  = entries.length;

  const skipReasons = {};
  entries.filter(e => e.skip_reason).forEach(e => {
    skipReasons[e.skip_reason] = (skipReasons[e.skip_reason] || 0) + 1;
  });
  const topSkipReason = Object.entries(skipReasons).sort((a, b) => b[1] - a[1])[0];

  const confEntries = entries.filter(e => e.confluence_score != null);
  const avgConf = confEntries.length
    ? (confEntries.reduce((s, e) => s + e.confluence_score, 0) / confEntries.length).toFixed(1)
    : null;

  return {
    total, setups, weak, skips, blocks,
    setup_rate:      total ? ((setups / total) * 100).toFixed(0) + '%' : '0%',
    avg_confluence:  avgConf,
    top_skip_reason: topSkipReason ? topSkipReason[0] : null,
    entries
  };
}

module.exports = { logSignalReplay, todaySummary };
