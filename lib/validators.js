'use strict';

const VALID_TICKERS    = new Set(['SPY', 'SPX', 'QQQ', 'ES', 'NQ', 'MES', 'MNQ']);
const VALID_DIRECTIONS = new Set(['LONG', 'SHORT']);
const VALID_RESULTS    = new Set(['WIN', 'LOSS', 'SCRATCH']);
const MAX_TEXT_BYTES   = 10000;
const MAX_URL_LENGTH   = 2048;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function err(msg) { return { valid: false, error: msg }; }
function ok(data) { return { valid: true, data: data || {} }; }

function validateTradeRequest(body) {
  if (!body) return err('Missing request body');
  const { direction, ticker, entry, exit: exitPrice, result } = body;

  if (!direction || !VALID_DIRECTIONS.has(String(direction).toUpperCase())) {
    return err('direction must be LONG or SHORT');
  }
  if (!ticker || !VALID_TICKERS.has(String(ticker).toUpperCase())) {
    return err('ticker must be one of: ' + [...VALID_TICKERS].join(', '));
  }
  const entryNum = parseFloat(entry);
  const exitNum  = parseFloat(exitPrice);
  if (!isFinite(entryNum) || entryNum <= 0) return err('entry must be a positive number');
  if (!isFinite(exitNum)  || exitNum  <= 0) return err('exit must be a positive number');
  if (!result || !VALID_RESULTS.has(String(result).toUpperCase())) {
    return err('result must be WIN, LOSS, or SCRATCH');
  }
  return ok({ direction: direction.toUpperCase(), ticker: ticker.toUpperCase(), entry: entryNum, exit: exitNum, result: result.toUpperCase() });
}

function validateAlertRequest(body) {
  if (!body) return err('Missing request body');
  const { message } = body;
  if (!message || typeof message !== 'string') return err('message must be a string');
  if (message.trim().length === 0) return err('message is empty');
  if (Buffer.byteLength(message, 'utf8') > MAX_TEXT_BYTES) {
    return err('message exceeds 10KB limit');
  }
  return ok({ message: message.trim() });
}

function validateLevelsRequest(body) {
  if (!body) return err('Missing request body');
  const { message } = body;
  if (!message || typeof message !== 'string') return err('message must be a string');
  if (message.trim().length === 0) return err('message is empty');
  if (Buffer.byteLength(message, 'utf8') > MAX_TEXT_BYTES) {
    return err('message exceeds 10KB limit');
  }
  return ok({ message: message.trim() });
}

function validateTimestamp(ts) {
  if (!ts) return true; // optional
  const ms = new Date(ts).getTime();
  if (isNaN(ms)) return false;
  return Math.abs(Date.now() - ms) <= TWENTY_FOUR_HOURS;
}

function validateSignalStrike(strike) {
  if (strike === null || strike === undefined) return true; // optional
  const n = parseFloat(strike);
  return isFinite(n) && n > 0 && n < 1000000;
}

function validateMemoryKey(key) {
  if (!key || typeof key !== 'string') return false;
  // block writes to safety-critical keys
  const BLOCKED_KEYS = ['luke_last_log', 'current_state', 'apex', '_schema_version', '_written_by'];
  if (BLOCKED_KEYS.includes(key)) return false;
  // only alphanumeric + underscore keys
  return /^[a-zA-Z0-9_]{1,64}$/.test(key);
}

module.exports = {
  validateTradeRequest,
  validateAlertRequest,
  validateLevelsRequest,
  validateTimestamp,
  validateSignalStrike,
  validateMemoryKey,
  VALID_TICKERS,
  MAX_TEXT_BYTES,
  MAX_URL_LENGTH,
};
