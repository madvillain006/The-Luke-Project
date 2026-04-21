'use strict';

module.exports = {
  CONFLUENCE: {
    ES_NQ_TOLERANCE:   10.0,   // point tolerance for ES/NQ cluster matching
    SPX_TOLERANCE:      2.0,   // point tolerance for SPX
    SPY_TOLERANCE:      2.0,   // point tolerance for SPY/QQQ
    ES_NQ_LEVEL_FLOOR: 3000,   // strike > this → ES or NQ instrument
    SPX_LEVEL_FLOOR:    500,   // strike >= this → SPX instrument
    SPY_LEVEL_FLOOR:    100,   // strike >= this → SPY/QQQ instrument
    HIGH_SCORE:           5,   // effective_score >= this → HIGH confidence
    MEDIUM_SCORE:         3,   // effective_score >= this → MEDIUM confidence
  },

  FRESHNESS: {
    RECENT_HOURS:    0.5,   // < 30 min → multiplier 1.0
    MODERATE_HOURS:  2.0,   // < 2 hr  → multiplier 0.7
    AGING_HOURS:     4.0,   // < 4 hr  → multiplier 0.4
    // > 4 hr → multiplier 0.2
    RECENT_MULT:     1.0,
    MODERATE_MULT:   0.7,
    AGING_MULT:      0.4,
    STALE_MULT:      0.2,
    AGING_THRESHOLD: 0.5,   // freshness < this → zone marked aging
  },

  MARKET_HOURS: {
    OPEN_MINS:       570,    // 9:30 AM ET
    CLOSE_MINS:      960,    // 4:00 PM ET
    LUNCH_START:     690,    // 11:30 AM ET
    LUNCH_END:       780,    // 1:00 PM ET
    LAST_10_MINS:    950,    // 3:50 PM ET — Ximes: no responsibility after 3:49
    MORNING_END:     660,    // 11:00 AM ET — edge window end
    AFTERNOON_START: 840,    // 2:00 PM ET — afternoon edge window start
    AFTERNOON_END:   950,    // 3:50 PM ET
  },

  EMOTIONAL: {
    MAX_LOSSES_HARD:          2,    // losses >= this → HARD block
    MAX_DRAWDOWN_PCT_HARD:    2,    // drawdown >= this % → HARD block
    MIN_MINS_AFTER_TRADE:     5,    // must wait this long after any trade
    COOLING_MINS_AFTER_LOSS: 15,    // must wait this long after a loss
    CAPITAL:                500,    // account size for drawdown % calc
  },

  THRESHOLDS: {
    APEX_CONSISTENCY_WARN:  0.45,   // daily_pnl/total >= this → HALT warning
    APEX_CONSISTENCY_VIOL:  0.50,   // daily_pnl/total >= this → VIOLATION
    PAPER_TRADES_TO_LIVE:     25,   // paper trades required before live mode
    MARKET_GATE_DRIFT_TICKS:   8,   // max ticks drift from staged entry
    MARKET_GATE_MAX_SPREAD:    3,   // max spread in ticks
    MARKET_GATE_MIN_RR:       1.5,  // minimum R:R at market gate
    MIN_RR_REJECT:            1.0,  // R:R below this → reject bracket
    MIN_RR_WARN:              1.5,  // R:R below this → warn bracket
  },

  TIMEOUTS: {
    RESEARCH_FETCH_MS:      10000,  // POST /research URL fetch timeout
    SHELL_DEFAULT_SECS:        30,  // default shell action timeout
    VISION_RATE_LIMIT_MS:   30000,  // min ms between Bobby vision calls
    ALERT_DEDUP_MS:         60000,  // duplicate alert suppression window
    ALERT_DEDUP_CLEANUP_MS: 300000, // remove dedup entries older than 5 min
    POPUP_AUTO_CLOSE_MS:    60000,  // trade popup auto-close timer
    PROTECTION_RETRY_DELAY:   500,  // ms between OCO retry attempts
  },

  LIMITS: {
    MAX_MESSAGE_BYTES:     10000,  // max paste length for parsers
    MAX_RESEARCH_CHARS:     5000,  // max HTML content chars to send to AI
    SESSION_MAX_LINES:        50,  // max session.jsonl lines before trim
    SESSION_KEEP_LINES:       50,
    MEM_CAP_BYTES:        204800,  // 200 KB memory.json cap
    DISCORD_48H_HOURS:        48,  // hours back for discord context
  },

  SIENNA: {
    RISK_OFF_MANAGEMENT_COUNT:  3,   // last N ximes all MANAGEMENT → RISK_OFF
    RISK_ON_MAX_TRADES:         3,
    NEUTRAL_MAX_TRADES:         2,
    RISK_OFF_MAX_TRADES:        1,
    SIGNALS_LOOKBACK:          50,   // recent signals to load for regime
  },

  LUKE: {
    OMEPRAZOLE_HOUR:    4,    // 4:00 AM ET
    OMEPRAZOLE_MIN:     0,
    MEDS_HOUR:          4,    // 4:30 AM ET
    MEDS_MIN:          30,
    LOG_WARNING_HOURS: 24,    // warn if no Luke log in this many hours
    LOG_FRESH_HOURS:   12,    // suppress nag if log is newer than this
  },

  FINNHUB: {
    MNQ_DRIFT_TICKS: 180,   // max entry drift for MNQ sanity check
    ES_DRIFT_TICKS:   45,   // max entry drift for ES
  },

  WEBSOCKET: {
    TOKEN_FILE: '.ws-token',
  },

  APEX: {
    TRAIL_AMOUNT: 2500,   // Apex 50k standard EOD trail distance
  },
};
