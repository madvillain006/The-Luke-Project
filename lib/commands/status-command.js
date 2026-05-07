'use strict';

const { renderStatus } = require('../renderers/status-renderer');

async function handleStatusCommand(message, res, deps) {
  void message;
  const {
    fs,
    TRADES_JSONL,
    LAST_SIGNAL_FILE,
    isMarketOpen,
    isGoodTradingTime,
    minsUntilOpen,
    getPhase2WorkflowLoadStatus,
    loadSatyLevels,
    loadApexState,
    getMorningPrepLine,
    loadTodayContext,
    checkEmotionalState,
    getKatbotRegime,
    formatKatSummaryLine,
    getKatContextSummary,
  } = deps;

  const today = new Date().toISOString().split('T')[0];
  const statusLines = [];
  statusLines.push('LUKE ONLINE');
  statusLines.push('');

  const _mkt = isMarketOpen();
  const _tt = isGoodTradingTime();
  let _cd = null;
  if (_mkt.open) {
    statusLines.push(`Market: OPEN - ${_tt.message}`);
  } else {
    const _mins = minsUntilOpen();
    const _h = Math.floor(_mins / 60);
    const _m = _mins % 60;
    _cd = _h > 0 ? `${_h}h ${_m}m` : `${_m}m`;
    statusLines.push(`Market: CLOSED - Opens in ${_cd}`);
  }

  const workflowStatus = getPhase2WorkflowLoadStatus();
  const satyStatus = loadSatyLevels();
  const apexStatus = loadApexState();
  if (workflowStatus.dubzLoaded || workflowStatus.bobbyLoaded) {
    statusLines.push(`Levels: loaded (${workflowStatus.dubzCount} Dubz, ${workflowStatus.bobbyCount} Bobby mentions)`);
  } else {
    statusLines.push('Levels: not loaded');
  }
  statusLines.push(`Saty: ${satyStatus ? 'loaded' : 'missing'}`);
  statusLines.push(`Freshness: ${formatLoadedFlag(workflowStatus.dubzLoaded, 'Dubz', workflowStatus.dubzCount)} | ${formatLoadedFlag(workflowStatus.bobbyLoaded, 'Bobby', workflowStatus.bobbyCount)} | ${formatLoadedFlag(Boolean(satyStatus), 'Saty')}`);
  statusLines.push('Autonomous: recommendation-only; no autonomous staging or execution');
  const prepLine = getMorningPrepLine(apexStatus, satyStatus, workflowStatus);
  if (prepLine) statusLines.push(`Next: ${prepLine}`);

  let statusTrades = [];
  try {
    statusTrades = fs.readFileSync(TRADES_JSONL, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(t => t && ((t.date || '').startsWith(today) || (t.timestamp || '').startsWith(today)))
      .filter(t => t.result === 'WIN' || t.result === 'LOSS' || t.result === 'SCRATCH');
  } catch {}
  const stWins = statusTrades.filter(t => t.result === 'WIN').length;
  const stLosses = statusTrades.filter(t => t.result === 'LOSS').length;
  const stNet = statusTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  statusLines.push(`Trades: ${statusTrades.length} trades, ${stWins}W ${stLosses}L, net ${stNet >= 0 ? '+' : ''}${stNet.toFixed(2)} pts`);

  if (!_mkt.open) {
    statusLines.push(`State: CLOSED - Market opens in ${_cd}`);
  } else {
    const stTradeCtx = loadTodayContext();
    const stWarnings = checkEmotionalState(stTradeCtx);
    const stHard = stWarnings.find(w => w.type === 'HARD');
    const stSoft = stWarnings.filter(w => w.type === 'SOFT');
    if (stHard) {
      statusLines.push(`State: RED - ${stHard.message}`);
    } else if (stSoft.length > 0) {
      statusLines.push(`State: YELLOW - ${stSoft.map(w => w.message).join(' | ')}`);
    } else {
      statusLines.push('State: GREEN');
    }
  }

  try {
    const regime = getKatbotRegime();
    statusLines.push(`Regime: ${regime.regime} - ${regime.reason}`);
  } catch {}
  statusLines.push('Luke chat: active for trading ops (/status /ready /entries ES /heatmap /balance /saty)');
  try {
    const katParts = [];
    const katSpx = formatKatSummaryLine(getKatContextSummary('SPX'), 'Kat SPX/ES');
    const katNq = formatKatSummaryLine(getKatContextSummary('ES_NQ'), 'Kat NQ');
    const katSpy = formatKatSummaryLine(getKatContextSummary('SPY_QQQ'), 'Kat SPY/QQQ');
    if (katSpx) katParts.push(katSpx);
    if (katNq) katParts.push(katNq);
    if (katSpy) katParts.push(katSpy);
    statusLines.push(katParts.length ? `Kat: ${katParts.join(' | ')}` : 'Kat: no recent context');
  } catch {
    statusLines.push('Kat: unavailable');
  }

  try {
    if (fs.existsSync(LAST_SIGNAL_FILE)) {
      const sig = JSON.parse(fs.readFileSync(LAST_SIGNAL_FILE, 'utf8'));
      if (sig.date === today) {
        statusLines.push(`Last signal: ${sig.time} ${sig.ticker} - ${sig.verdict}`);
      } else {
        statusLines.push('Last signal: none today');
      }
    } else {
      statusLines.push('Last signal: none today');
    }
  } catch { statusLines.push('Last signal: none today'); }

  return res.json({ reply: renderStatus(statusLines) });
}

function formatLoadedFlag(loaded, label, count = null) {
  if (loaded) {
    return count === null ? `${label} OK` : `${label} OK (${count})`;
  }
  return `${label} MISSING`;
}

module.exports = { handleStatusCommand };
