'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { normalizeMessage } = require('./normalize');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const active = trade => ['OPEN', 'PARTIAL'].includes(trade.state);
const time = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const matches = (contract, selector) => !selector || Object.entries(selector).every(([key, value]) => value == null || contract[key] === value);

class ShadowLedger {
  constructor({ dbPath, channelId, authorIds, normalize = normalizeMessage, accountConcept = 300 }) {
    if (!dbPath || !channelId || !Array.isArray(authorIds) || !authorIds.length || authorIds.some(id => !id)) throw new Error('dbPath, exact channelId and nonempty authorIds are required');
    if (!Number.isFinite(accountConcept) || accountConcept <= 0) throw new Error('accountConcept must be a positive finite number');
    this.channelId = String(channelId);
    this.authorIds = new Set(authorIds.map(String));
    this.normalize = normalize;
    this.accountConcept = accountConcept;
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(dbPath);
    if (dbPath !== ':memory:') fs.chmodSync(dbPath, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, observed_at TEXT NOT NULL, status TEXT NOT NULL, receipt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (channel_id TEXT NOT NULL, message_id TEXT NOT NULL, content_hash TEXT NOT NULL, author_id TEXT, published_at TEXT, observed_at TEXT NOT NULL, disposition TEXT NOT NULL, reason TEXT, body TEXT, PRIMARY KEY(channel_id,message_id,content_hash));
      CREATE TABLE IF NOT EXISTS trades (trade_id TEXT PRIMARY KEY, opening_message_id TEXT NOT NULL, author_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS instructions (instruction_id TEXT PRIMARY KEY, message_id TEXT NOT NULL, trade_id TEXT, disposition TEXT NOT NULL, data TEXT NOT NULL);`);
    const binding = JSON.stringify({ channelId: this.channelId, authorIds: [...this.authorIds].sort() });
    const existing = this.meta('binding');
    if (existing && existing !== binding) { this.db.close(); throw new Error('Database source binding differs; use its original channel/author allowlist'); }
    if (!existing) this.setMeta('binding', binding);
  }

  meta(key) { return this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)?.value; }
  setMeta(key, value) { this.db.prepare('INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  trades() { return this.db.prepare('SELECT data FROM trades ORDER BY trade_id').all().map(row => JSON.parse(row.data)); }
  saveTrade(trade) { this.db.prepare('INSERT INTO trades VALUES (?,?,?,?) ON CONFLICT(trade_id) DO UPDATE SET data=excluded.data').run(trade.trade_id, trade.opening_message_id, trade.author_id, JSON.stringify(trade)); }
  beforeBaseline(message) {
    const cutoff = this.meta('baseline_cutoff');
    if (!cutoff) return false;
    const row = JSON.parse(cutoff);
    if (/^\d+$/.test(String(message.message_id)) && /^\d+$/.test(row.message_id)) return BigInt(message.message_id) <= BigInt(row.message_id);
    return Date.parse(message.timestamp_utc) <= Date.parse(row.published_at);
  }

  resolve(message, instruction, trades) {
    let candidates = trades.filter(trade => trade.channel_id === this.channelId && trade.author_id === String(message.author_id) && active(trade) && Date.parse(trade.opened_at) <= Date.parse(message.timestamp_utc));
    if (instruction.symbol) candidates = candidates.filter(trade => trade.contract.underlying === instruction.symbol);
    candidates = candidates.filter(trade => matches(trade.contract, instruction.contract) && matches(trade.contract, instruction.contract_hint));
    const reply = instruction.reply_to_message_id || message.reply_to_message_id;
    if (reply) {
      const ids = new Set(this.db.prepare("SELECT trade_id FROM instructions WHERE message_id=? AND disposition='applied' AND trade_id IS NOT NULL").all(String(reply)).map(row => row.trade_id));
      candidates = candidates.filter(trade => trade.opening_message_id === String(reply) || ids.has(trade.trade_id));
    }
    if (candidates.length !== 1) throw new Error(candidates.length ? 'ambiguous_trade_link' : 'no_matching_active_trade');
    const trade = candidates[0];
    if (Date.parse(message.timestamp_utc) < Date.parse(trade.last_source_at)) throw new Error('out_of_order_trade_update');
    return trade;
  }

  apply(message, instructions, contentHash) {
    if (!instructions.length) throw new Error('empty_instruction_bundle');
    const trades = this.trades();
    const events = [];
    for (let index = 0; index < instructions.length; index++) {
      const instruction = instructions[index];
      let trade;
      if (instruction.action === 'OPEN') {
        const contract = instruction.contract;
        if (!contract || !contract.underlying || !contract.expiration_date || !(contract.strike > 0) || !['CALL','PUT'].includes(contract.option_side)) throw new Error('incomplete_open_contract');
        if (trades.some(row => row.author_id === String(message.author_id) && (active(row) || row.state === 'REVIEW') && matches(row.contract, contract))) throw new Error('duplicate_active_contract_requires_review');
        const premium = instruction.premium;
        trade = {
          trade_id: 'mugg_' + hash(this.channelId + ':' + message.message_id).slice(0,24),
          opening_message_id: String(message.message_id), channel_id: this.channelId, author_id: String(message.author_id),
          contract, state: 'OPEN', opened_at: message.timestamp_utc, last_source_at: message.timestamp_utc,
          first_observed_at: message.observed_at, entry_premium: premium ?? null,
          stop_premium: instruction.stop ?? null, stop_kind: instruction.stop == null ? 'unspecified' : 'premium',
          target_plan: instruction.targets || [], targets_hit: [], trims: [], adds: [],
          account_concept_usd: this.accountConcept,
          one_standard_contract_gross_usd: Number.isFinite(premium) ? Math.round(premium * 10000) / 100 : null,
          affordability: !Number.isFinite(premium) ? 'unknown_premium' : premium * 100 > this.accountConcept ? 'exceeds_account_concept_before_fees' : 'gross_cost_within_concept_fees_and_buying_power_unverified',
          execution: 'shadow_source_state_only', fills: [],
        };
        trades.push(trade);
      } else {
        trade = this.resolve(message, instruction, trades);
        switch (instruction.action) {
          case 'TARGET_HIT':
            if (![1,2,3].includes(instruction.target_number)) throw new Error('unknown_target_number');
            if (!trade.targets_hit.includes(instruction.target_number)) trade.targets_hit.push(instruction.target_number);
            break;
          case 'TRIM':
            if (instruction.fraction != null && (!(instruction.fraction > 0) || instruction.fraction > 1)) throw new Error('invalid_trim_fraction');
            trade.state = instruction.fraction === 1 ? 'CLOSED' : 'PARTIAL';
            if (instruction.fraction === 1) trade.closed_at = message.timestamp_utc;
            trade.trims.push({ fraction: instruction.fraction ?? null, premium: instruction.premium ?? null, message_id: String(message.message_id) });
            break;
          case 'BREAKEVEN': trade.stop_kind = 'breakeven'; trade.stop_premium = trade.entry_premium; break;
          case 'MOVE_STOP':
            if (!(instruction.stop > 0)) throw new Error('unknown_stop_premium');
            trade.stop_kind = 'premium'; trade.stop_premium = instruction.stop; break;
          case 'ADD': trade.adds.push({ premium: instruction.premium ?? null, message_id: String(message.message_id) }); break;
          case 'STOP_HIT': trade.state = 'STOPPED'; trade.closed_at = message.timestamp_utc; break;
          case 'CLOSE': trade.state = 'CLOSED'; trade.closed_at = message.timestamp_utc; break;
          case 'CANCEL': trade.state = 'CANCELLED'; trade.closed_at = message.timestamp_utc; break;
          default: throw new Error('unsupported_instruction');
        }
      }
      trade.last_source_at = message.timestamp_utc;
      trade.last_observed_at = message.observed_at;
      events.push({ instruction_id: hash(`${this.channelId}:${message.message_id}:${contentHash}:${index}`), message_id: String(message.message_id), source_content_hash: contentHash, trade_id: trade.trade_id, instruction, source_at: message.timestamp_utc, observed_at: message.observed_at, acquisition_lag_ms: Date.parse(message.observed_at) - Date.parse(message.timestamp_utc), execution: 'shadow_source_state_only' });
    }
    // Mutations reach SQLite only after the entire compound message validates.
    for (const trade of trades) this.saveTrade(trade);
    for (const event of events) this.db.prepare('INSERT INTO instructions VALUES (?,?,?,?,?)').run(event.instruction_id, event.message_id, event.trade_id, 'applied', JSON.stringify(event));
    return events;
  }

  freezeEdited(messageId) {
    const ids = new Set(this.db.prepare('SELECT trade_id FROM instructions WHERE message_id=? AND trade_id IS NOT NULL').all(String(messageId)).map(row => row.trade_id));
    for (const trade of this.trades()) if (ids.has(trade.trade_id)) {
      trade.state_before_review = trade.state; trade.state = 'REVIEW'; trade.review_reason = 'source_message_edited'; this.saveTrade(trade);
      this.setMeta('review_hold:'+trade.author_id,JSON.stringify({message_id:String(messageId),reason:'source_message_edited'}));
    }
  }

  ingestSnapshot(snapshot) {
    if (String(snapshot.channel_id) !== this.channelId) throw new Error('wrong_channel');
    if (!time(snapshot.observed_at) || !Array.isArray(snapshot.messages)) throw new Error('invalid_snapshot');
    const receipt = { observed_at: snapshot.observed_at, status: 'ok', accepted: 0, duplicates: 0, review: 0, ignored: 0, baseline: 0, instructions: [], reasons: [] };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const isBaseline = this.meta('initialized') !== 'true';
      if (snapshot.at_tail !== true) { this.setMeta('halted', 'tail_not_proven'); receipt.reasons.push('tail_not_proven'); }
      if (snapshot.history_complete !== true) { this.setMeta('halted', isBaseline ? 'initial_snapshot_incomplete' : 'continuity_gap'); receipt.reasons.push(this.meta('halted')); }
      if (snapshot.messages.some(row => !row.message_id || String(row.channel_id) !== this.channelId || typeof row.raw_text !== 'string')) {
        this.setMeta('halted','invalid_message_envelope'); receipt.reasons.push('invalid_message_envelope');
      }
      const halted = this.meta('halted');
      const messages = [...snapshot.messages].sort((a,b) => Date.parse(a.timestamp_utc) - Date.parse(b.timestamp_utc) || String(a.message_id).localeCompare(String(b.message_id), 'en', { numeric: true }));
      for (const raw of messages) {
        const message = { ...raw, observed_at: snapshot.observed_at };
        if (!message.message_id || String(message.channel_id) !== this.channelId || typeof message.raw_text !== 'string') { receipt.review++; receipt.reasons.push('invalid_message_envelope'); this.setMeta('halted','invalid_message_envelope'); continue; }
        const contentHash = hash(JSON.stringify([message.raw_text, message.author_id ?? null, message.timestamp_utc ?? null, message.reply_to_message_id ?? null, message.edited_at ?? null]));
        if (this.db.prepare('SELECT 1 FROM messages WHERE channel_id=? AND message_id=? AND content_hash=?').get(this.channelId,String(message.message_id),contentHash)) { receipt.duplicates++; continue; }
        const previous = this.db.prepare('SELECT 1 FROM messages WHERE channel_id=? AND message_id=?').get(this.channelId,String(message.message_id));
        let disposition, reason;
        if (previous) { disposition='review'; reason='source_message_edited'; this.freezeEdited(message.message_id); }
        else if (!this.authorIds.has(String(message.author_id))) { disposition='ignored'; reason='author_not_allowed'; }
        else if (!time(message.timestamp_utc) || Date.parse(message.timestamp_utc) > Date.parse(snapshot.observed_at)) { disposition='review'; reason='invalid_or_future_publication_time'; }
        else if (isBaseline) { disposition='baseline'; reason='historical_bootstrap_no_replay'; }
        else if (this.beforeBaseline(message)) { disposition='baseline'; reason='pre_bootstrap_catchup_no_replay'; }
        else if (halted || this.meta('halted')) { disposition='review'; reason=this.meta('halted'); }
        else if (this.meta('review_hold:'+String(message.author_id))) { disposition='review'; reason='source_review_hold'; }
        else {
          const normalized = this.normalize(message);
          if (normalized.status !== 'normalized') { disposition=normalized.status==='ignored'?'ignored':'review'; reason=normalized.reason || 'normalization_requires_review'; }
          else {
            try { const events=this.apply(message,normalized.instructions,contentHash); disposition='accepted'; receipt.instructions.push(...events); }
            catch (error) { disposition='review'; reason=error.message; }
          }
        }
        receipt[disposition]++;
        if (reason && disposition==='review') receipt.reasons.push({message_id:String(message.message_id),reason});
        if (disposition==='review' && this.authorIds.has(String(message.author_id)) && !this.meta('review_hold:'+String(message.author_id))) this.setMeta('review_hold:'+String(message.author_id),JSON.stringify({message_id:String(message.message_id),reason}));
        this.db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?)').run(this.channelId,String(message.message_id),contentHash,message.author_id == null ? null:String(message.author_id),message.timestamp_utc || null,snapshot.observed_at,disposition,reason || null,disposition==='ignored'?null:message.raw_text);
      }
      if (isBaseline && snapshot.at_tail === true && snapshot.history_complete === true && !this.meta('halted')) {
        const newest = messages.filter(row => time(row.timestamp_utc) && Date.parse(row.timestamp_utc) <= Date.parse(snapshot.observed_at)).at(-1);
        if (newest) this.setMeta('baseline_cutoff',JSON.stringify({message_id:String(newest.message_id),published_at:newest.timestamp_utc}));
        this.setMeta('initialized','true');
      }
      receipt.status = this.meta('halted') || receipt.review ? 'review' : isBaseline ? 'baseline' : 'ok';
      receipt.health = this.meta('halted') ? {status:'halted',reason:this.meta('halted')} : {status:'ready'};
      receipt.review_required = this.db.prepare("SELECT 1 FROM metadata WHERE key LIKE 'review_hold:%' LIMIT 1").get() != null;
      this.db.prepare('INSERT INTO snapshots(observed_at,status,receipt) VALUES (?,?,?)').run(snapshot.observed_at,receipt.status,JSON.stringify(receipt));
      this.db.exec('COMMIT');
      return receipt;
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }

  status() {
    const latest=this.db.prepare('SELECT observed_at,status FROM snapshots ORDER BY id DESC LIMIT 1').get();
    const holds=this.db.prepare("SELECT key,value FROM metadata WHERE key LIKE 'review_hold:%'").all().map(row=>({author_id:row.key.slice('review_hold:'.length),...JSON.parse(row.value)}));
    return {mode:'shadow',channel_id:this.channelId,initialized:this.meta('initialized')==='true',health:this.meta('halted')?{status:'halted',reason:this.meta('halted')}:{status:'ready'},review_required:holds.length>0,source_holds:holds,latest_snapshot:latest || null,trades:this.trades(),message_dispositions:this.db.prepare('SELECT disposition,count(*) AS count FROM messages GROUP BY disposition').all(),instruction_count:this.db.prepare('SELECT count(*) AS count FROM instructions').get().count};
  }
  close() { this.db.close(); }
}

module.exports = { ShadowLedger };
