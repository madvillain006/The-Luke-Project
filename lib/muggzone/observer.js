"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SNOWFLAKE = /^\d{16,20}$/;
const { validateSchedule } = require("./schedule");

function exactChannel(url, expected) {
  try {
    const value = new URL(url);
    const target = new URL(expected);
    return value.origin === "https://discord.com" && target.origin === value.origin && value.pathname === target.pathname;
  } catch { return false; }
}

function validateConfig(config) {
  if (!config || typeof config !== "object") throw new Error("Missing observer config");
  const target = new URL(config.channel_url);
  const match = target.pathname.match(/^\/channels\/(\d{16,20})\/(\d{16,20})$/);
  if (target.origin !== "https://discord.com" || !match || target.search || target.hash) throw new Error("channel_url must identify one exact Discord server channel");
  if (config.channel_id !== match[2]) throw new Error("channel_id does not match channel_url");
  if (!Array.isArray(config.author_ids) || !config.author_ids.length || config.author_ids.some(id => !SNOWFLAKE.test(id))) throw new Error("A nonempty author_ids allowlist of stable Discord IDs is required");
  const cdp = new URL(config.cdp_url || "http://127.0.0.1:9222");
  if (!["http:", "https:"].includes(cdp.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(cdp.hostname) || cdp.username || cdp.password || cdp.pathname !== "/" || cdp.search || cdp.hash) throw new Error("CDP must be a loopback-only endpoint");
  if (!path.isAbsolute(config.data_dir || "")) throw new Error("data_dir must be an absolute persistent path outside the repo");
  const max_scroll_steps = config.max_scroll_steps ?? 40;
  if (!Number.isInteger(max_scroll_steps) || max_scroll_steps < 1 || max_scroll_steps > 200) throw new Error("max_scroll_steps must be 1–200");
  return { ...config, cdp_url: cdp.href, max_scroll_steps, schedule: validateSchedule(config.schedule) };
}

function orderMessages(messages) {
  return [...messages].sort((a, b) => {
    const left = BigInt(a.message_id), right = BigInt(b.message_id);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function uniqueIds(messages) { return new Set(messages.map(message => message.message_id)); }
function overlaps(a, b) { return [...a].some(id => b.has(id)); }

function atomicJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.new`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filename);
}

class ObserverHalt extends Error {
  constructor(code, message) { super(message); this.name = "ObserverHalt"; this.code = code; }
}

/** Reads only the rendered UI; no Discord bot, tokens, HTTP endpoints or React state. */
class DiscordDomSurface {
  constructor(page, { channel_url, channel_id, settle_ms = 1000 }) {
    this.page = page; this.channelUrl = channel_url; this.channelId = channel_id; this.settleMs = settle_ms;
  }

  async inspect() {
    const url = this.page.url();
    const loginUrl = /^https:\/\/discord\.com\/(login|register)(?:[/?#]|$)/.test(url);
    if (loginUrl) return { state: "auth_required", messages: [] };
    if (!exactChannel(url, this.channelUrl)) return { state: "wrong_channel", messages: [] };
    const result = await this.page.evaluate(({ channelId }) => {
      const captcha = !!document.querySelector('iframe[src*="captcha"], iframe[src*="hcaptcha"], [data-testid*="captcha"]');
      const login = !!document.querySelector('input[type="password"], input[name="email"]');
      const rows = Array.from(document.querySelectorAll(`[id^="chat-messages-${channelId}-"], [data-list-item-id^="chat-messages___${channelId}-"]`));
      function findScroller(row) {
        for (let ancestor = row?.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const overflow = getComputedStyle(ancestor).overflowY;
          if (["auto", "scroll"].includes(overflow) && ancestor.clientHeight > 0) return ancestor;
        }
        return null;
      }
      const scroller = findScroller(rows[0]);
      const at_tail = !!scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 8;
      const messages = [];
      const problems = [];
      const seen = new Set();
      const stableId = value => /^\d{16,20}$/.test(value || "") ? value : null;
      function authorFrom(row) {
        const own = stableId(row.getAttribute("data-author-id"));
        if (own) return own;
        const attributed = Array.from(row.querySelectorAll('[data-author-id], [data-user-id]')).find(node => !node.closest('[class*="repliedMessage"], [class*="embed"], [id^="message-content-"]'));
        if (attributed) {
          const id = stableId(attributed.getAttribute("data-author-id") || attributed.getAttribute("data-user-id"));
          if (id) return id;
        }
        for (const avatar of row.querySelectorAll('img[class*="avatar"]')) {
          if (avatar.closest('[class*="repliedMessage"], [class*="embed"], [id^="message-content-"]')) continue;
          const match = (avatar.getAttribute("src") || "").match(/\/avatars\/(\d{16,20})\//);
          if (match) return match[1];
        }
        return null;
      }
      for (const row of rows) {
        const key = (row.id || row.getAttribute("data-list-item-id") || "").match(/(?:chat-messages-|chat-messages___)(\d{16,20})-(\d{16,20})$/);
        if (!key || seen.has(key[2])) continue;
        seen.add(key[2]);
        let author_id = authorFrom(row);
        // A reused username aria reference explicitly identifies a grouped message's header.
        // Never infer authors from adjacent text or matching display names.
        if (!author_id) {
          const labelled = [row, ...row.querySelectorAll('[aria-labelledby]')];
          for (const element of labelled) {
            const names = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(name => /^message-username-\d{16,20}$/.test(name));
            for (const name of names) {
              const header = document.getElementById(name);
              const owner = header?.closest('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]');
              if (owner) author_id = authorFrom(owner);
              if (author_id) break;
            }
            if (author_id) break;
          }
        }
        const content = document.getElementById(`message-content-${key[2]}`);
        const pieces = [];
        if (content?.innerText?.trim()) pieces.push(content.innerText.trim());
        const embeds = Array.from(row.querySelectorAll('[class*="embedFull"], [class*="embedDescription"], [class*="embedTitle"], [class*="embedField"]'));
        for (const node of embeds) {
          if (embeds.some(other => other !== node && other.contains(node))) continue;
          const value = node.innerText?.trim();
          if (value && !pieces.includes(value)) pieces.push(value);
        }
        const ownTime = Array.from(row.querySelectorAll('time[datetime]')).find(time => !time.closest('[class*="repliedMessage"], [class*="embed"], [id^="message-content-"]'));
        let timestamp_utc = ownTime?.getAttribute("datetime") || null;
        let timestamp_source = "dom";
        if (!timestamp_utc) {
          timestamp_utc = new Date(Number((BigInt(key[2]) >> 22n) + 1420070400000n)).toISOString();
          timestamp_source = "snowflake";
        }
        let reply_to_message_id = null;
        for (const link of row.querySelectorAll('[class*="repliedMessage"] a[href], [class*="repliedMessage"] [data-message-id]')) {
          const explicit = stableId(link.getAttribute("data-message-id"));
          const linked = (link.getAttribute("href") || "").match(new RegExp(`/channels/\\d{16,20}/${channelId}/(\\d{16,20})(?:[?#]|$)`));
          if (explicit || linked) { reply_to_message_id = explicit || linked[1]; break; }
        }
        const edited = Array.from(row.querySelectorAll('[data-edited-at], time[aria-label*="edited" i][datetime]')).find(node => !node.closest('[class*="repliedMessage"], [class*="embed"]'));
        const edited_at = edited?.getAttribute("data-edited-at") || edited?.getAttribute("datetime") || null;
        if (!author_id) problems.push(`author_unresolved:${key[2]}`);
        const raw_text = pieces.join("\n\n");
        if (!raw_text) problems.push(`text_unavailable:${key[2]}`);
        messages.push({ message_id: key[2], channel_id: key[1], author_id, raw_text, timestamp_utc, timestamp_source, reply_to_message_id, edited_at });
      }
      return { captcha, login, at_tail, messages, problems, has_scroller: !!scroller };
    }, { channelId: this.channelId });
    if (loginUrl || result.login) return { state: "auth_required", messages: [] };
    if (result.captcha) return { state: "captcha", messages: [] };
    if (!exactChannel(url, this.channelUrl)) return { state: "wrong_channel", messages: [] };
    if (!result.has_scroller || !result.messages.length) return { state: "content_unavailable", messages: [] };
    return { state: "ready", ...result };
  }

  async scroll(direction) {
    await this.page.evaluate(({ channelId, direction }) => {
      const row = document.querySelector(`[id^="chat-messages-${channelId}-"], [data-list-item-id^="chat-messages___${channelId}-"]`);
      let scroller = null;
      for (let ancestor = row?.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(ancestor).overflowY) && ancestor.clientHeight > 0) { scroller = ancestor; break; }
      }
      if (!scroller) throw new Error("Message scroller unavailable");
      if (direction === "tail") scroller.scrollTop = scroller.scrollHeight;
      else scroller.scrollTop = Math.max(0, scroller.scrollTop - Math.max(100, scroller.clientHeight * 0.65));
    }, { channelId: this.channelId, direction });
    await this.page.waitForTimeout(this.settleMs);
  }
  scrollToTail() { return this.scroll("tail"); }
  scrollBack() { return this.scroll("back"); }
}

class MuggzoneObserver {
  constructor({ surface, ledger, config, checkpointPath, now = () => new Date() }) {
    this.surface = surface; this.ledger = ledger; this.config = validateConfig(config); this.now = now;
    this.checkpointPath = checkpointPath || path.join(this.config.data_dir, "observer-checkpoint.json");
    this.checkpoint = null;
    if (fs.existsSync(this.checkpointPath)) {
      this.checkpoint = JSON.parse(fs.readFileSync(this.checkpointPath, "utf8"));
      if (this.checkpoint.channel_id !== this.config.channel_id || !Array.isArray(this.checkpoint.anchor_ids) || !this.checkpoint.anchor_ids.length || this.checkpoint.anchor_ids.some(id => !SNOWFLAKE.test(id))) throw new Error("Invalid observer checkpoint; preserve it for review");
    }
    const initialized = this.ledger.status().initialized;
    if (initialized && !this.checkpoint) throw new ObserverHalt("checkpoint_missing", "Ledger exists without its observer checkpoint; reconcile history before continuing");
    if (!initialized && this.checkpoint) throw new ObserverHalt("ledger_missing", "Observer checkpoint exists without its ledger; restore the matching ledger before continuing");
  }

  async read() {
    const view = await this.surface.inspect();
    if (view.state !== "ready") throw new ObserverHalt(view.state, `Observer halted: ${view.state}; manual browser action is required`);
    view.problems = [...(view.problems || [])];
    for (const message of view.messages) {
      if (typeof message.message_id !== "string" || !SNOWFLAKE.test(message.message_id) || message.channel_id !== this.config.channel_id || !Number.isFinite(Date.parse(message.timestamp_utc))) throw new ObserverHalt("invalid_message", "Message identity, channel, or timestamp could not be verified");
      if (typeof message.author_id !== "string" || !SNOWFLAKE.test(message.author_id)) view.problems.push(`author_unresolved:${message.message_id}`);
      if (typeof message.raw_text !== "string" || !message.raw_text.trim()) view.problems.push(`text_unavailable:${message.message_id}`);
    }
    return view;
  }

  async poll() {
    const state = this.ledger.status();
    if (state.health?.status === "halted") throw new ObserverHalt("ledger_review", "Ledger is halted for review");
    if (state.initialized && !this.checkpoint) throw new ObserverHalt("checkpoint_missing", "Ledger exists without its observer checkpoint");
    if (!state.initialized && this.checkpoint) throw new ObserverHalt("ledger_missing", "Observer checkpoint exists without its ledger");
    await this.read(); // Check authentication and the exact channel before scrolling.
    await this.surface.scrollToTail();
    const tail = await this.read();
    if (!tail.at_tail) throw new ObserverHalt("tail_unverified", "Newest-message position could not be verified");
    const byId = new Map(tail.messages.map(message => [message.message_id, message]));
    const problems = new Set(tail.problems || []);
    let complete = !this.checkpoint;
    let previousIds = uniqueIds(tail.messages);
    const anchorIds = new Set(this.checkpoint?.anchor_ids || []);
    if (this.checkpoint) complete = overlaps(previousIds, anchorIds);
    for (let step = 0; !complete && step < this.config.max_scroll_steps; step += 1) {
      await this.surface.scrollBack();
      const older = await this.read();
      const ids = uniqueIds(older.messages);
      for (const message of older.messages) if (!byId.has(message.message_id)) byId.set(message.message_id, message);
      for (const problem of older.problems || []) problems.add(problem);
      if (!overlaps(previousIds, ids)) { problems.add("scroll_window_gap"); break; }
      if (overlaps(ids, anchorIds)) { complete = true; break; }
      if ([...ids].every(id => previousIds.has(id))) { problems.add("history_anchor_not_reached"); break; }
      previousIds = ids;
    }
    if (!complete) problems.add("history_anchor_not_reached");
    // New messages can arrive while catching up. Prove the final tail overlaps the first tail.
    await this.surface.scrollToTail();
    const finalTail = await this.read();
    if (!finalTail.at_tail) throw new ObserverHalt("tail_unverified", "Final newest-message position could not be verified");
    if (!overlaps(uniqueIds(tail.messages), uniqueIds(finalTail.messages))) { complete = false; problems.add("tail_changed_without_overlap"); }
    for (const message of finalTail.messages) byId.set(message.message_id, message);
    for (const problem of finalTail.problems || []) problems.add(problem);
    if (problems.size) complete = false;
    const observed_at = this.now().toISOString();
    const snapshot = { channel_id: this.config.channel_id, observed_at, at_tail: true, history_complete: complete,
      messages: orderMessages([...byId.values()]).map(message => ({ ...message, observed_at })),
      observer_problems: [...problems],
    };
    const receipt = await this.ledger.ingestSnapshot(snapshot);
    if (complete && receipt.health?.status === "ready") {
      this.checkpoint = { channel_id: this.config.channel_id, observed_at, anchor_ids: orderMessages(finalTail.messages).slice(-32).map(message => message.message_id) };
      atomicJson(this.checkpointPath, this.checkpoint);
    }
    return { ...receipt, history_complete: complete, observer_problems: [...problems], observed_at };
  }
}

module.exports = { MuggzoneObserver, DiscordDomSurface, ObserverHalt, validateConfig, exactChannel, atomicJson };
