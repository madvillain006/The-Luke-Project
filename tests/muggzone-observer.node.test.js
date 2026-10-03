"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MuggzoneObserver, DiscordDomSurface, validateConfig } = require("../lib/muggzone/observer");
const { scheduleState, validateSchedule } = require("../lib/muggzone/schedule");

const CHANNEL = "123456789012345678";
const AUTHOR = "223456789012345678";
const SERVER = "323456789012345678";
const id = value => String(1400000000000000000n + BigInt(value));
const message = value => ({ message_id: id(value), channel_id: CHANNEL, author_id: AUTHOR, raw_text: `post ${value}`, timestamp_utc: "2026-10-02T14:00:00.000Z" });
const makeMessages = values => values.map(message);
function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "muggzone-observer-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = { channel_url: `https://discord.com/channels/${SERVER}/${CHANNEL}`, channel_id: CHANNEL, author_ids: [AUTHOR], data_dir: dir, max_scroll_steps: 10, ...options.config };
  const ledger = options.ledger || new FakeLedger();
  const surface = options.surface || new FakeSurface([makeMessages([1, 2, 3])]);
  const observer = new MuggzoneObserver({ surface, ledger, config, now: () => new Date("2026-10-02T15:00:00Z") });
  return { observer, ledger, surface, config, dir };
}

class FakeLedger {
  constructor() { this.initialized = false; this.health = { status: "ready" }; this.snapshots = []; this.seen = new Set(); this.forceReview = false; }
  status() { return { initialized: this.initialized, health: this.health }; }
  ingestSnapshot(snapshot) {
    this.snapshots.push(snapshot);
    const baseline = !this.initialized;
    if (snapshot.history_complete) this.initialized = true;
    else this.health = { status: "halted", reason: "continuity_gap" };
    let duplicates = 0, accepted = 0;
    for (const item of snapshot.messages) {
      if (this.seen.has(item.message_id)) duplicates += 1;
      else if (!baseline && snapshot.history_complete) accepted += 1;
      this.seen.add(item.message_id);
    }
    return { status: this.forceReview || !snapshot.history_complete ? "review" : baseline ? "baseline" : "ok", accepted, duplicates, review: this.forceReview ? 1 : 0, ignored: 0, health: this.health };
  }
}
class FakeSurface {
  constructor(windows) { this.windows = windows; this.index = 0; this.state = "ready"; this.scrolls = 0; this.tailCalls = 0; this.problems = []; }
  async inspect() { return { state: this.state, messages: this.windows[this.index], at_tail: this.index === 0, problems: this.problems }; }
  async scrollToTail() { this.index = 0; this.scrolls += 1; this.tailCalls += 1; if (this.onTail) this.onTail(this); }
  async scrollBack() { this.index = Math.min(this.index + 1, this.windows.length - 1); this.scrolls += 1; }
}

test("configuration binds an exact channel and author IDs; CDP stays loopback", t => {
  const { config } = fixture(t);
  assert.equal(validateConfig(config).schedule.poll_interval_ms, 240000);
  assert.throws(() => validateConfig({ ...config, channel_id: AUTHOR }), /does not match/);
  assert.throws(() => validateConfig({ ...config, author_ids: ["MuggZone"] }), /allowlist/);
  assert.throws(() => validateConfig({ ...config, cdp_url: "http://0.0.0.0:9222" }), /loopback/);
  assert.throws(() => validateConfig({ ...config, channel_url: `${config.channel_url}?other=1` }), /exact/);
});

test("schedule follows New York DST, weekday closure, and exclusive end", () => {
  assert.equal(scheduleState("2026-07-06T11:59:00Z").active, false);
  assert.equal(scheduleState("2026-07-06T12:00:00Z").active, true);
  assert.equal(scheduleState("2026-12-07T12:59:00Z").active, false);
  assert.equal(scheduleState("2026-12-07T13:00:00Z").active, true);
  assert.equal(scheduleState("2026-07-06T21:00:00Z").active, false);
  assert.equal(scheduleState("2026-10-03T14:00:00Z").reason, "outside_weekdays");
  assert.equal(scheduleState("2026-07-06T14:00:00Z", { closed_dates: ["2026-07-06"] }).reason, "explicit_closed_date");
  assert.throws(() => validateSchedule({ poll_interval_ms: 1000 }), /3–5/);
});

test("first snapshot establishes a baseline and persists stable ID anchors", async t => {
  const { observer, ledger, dir } = fixture(t);
  const result = await observer.poll();
  assert.equal(result.status, "baseline");
  assert.equal(result.accepted, 0);
  assert.equal(ledger.snapshots[0].history_complete, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "observer-checkpoint.json"))).anchor_ids, [id(1), id(2), id(3)]);
});

test("repeated visible messages are deduplicated by IDs and newly arrived messages reach ledger once", async t => {
  const { observer, ledger, surface } = fixture(t);
  await observer.poll();
  const replay = await observer.poll();
  assert.equal(replay.duplicates, 3);
  assert.equal(replay.accepted, 0);
  surface.windows = [makeMessages([2, 3, 4])];
  const newPost = await observer.poll();
  assert.equal(newPost.accepted, 1);
  assert.equal(ledger.snapshots.at(-1).messages.at(-1).message_id, id(4));
});

test("bounded backward scrolling joins overlapping windows to the previous anchor", async t => {
  const { observer, surface, ledger } = fixture(t, { surface: new FakeSurface([makeMessages([1, 2, 3, 4, 5])]) });
  await observer.poll();
  surface.windows = [makeMessages([8, 9, 10]), makeMessages([6, 7, 8]), makeMessages([4, 5, 6])];
  const result = await observer.poll();
  assert.equal(result.history_complete, true);
  assert.deepEqual(ledger.snapshots.at(-1).messages.map(item => item.message_id), [4, 5, 6, 7, 8, 9, 10].map(id));
  assert.equal(result.accepted, 5);
});

test("a nonoverlapping scroll window halts for review and preserves the previous checkpoint", async t => {
  const { observer, surface, dir } = fixture(t);
  await observer.poll();
  const before = fs.readFileSync(path.join(dir, "observer-checkpoint.json"), "utf8");
  surface.windows = [makeMessages([9, 10]), makeMessages([2, 3])];
  const result = await observer.poll();
  assert.equal(result.history_complete, false);
  assert.ok(result.observer_problems.includes("scroll_window_gap"));
  assert.equal(result.accepted, 0);
  assert.equal(fs.readFileSync(path.join(dir, "observer-checkpoint.json"), "utf8"), before);
  await assert.rejects(observer.poll(), { code: "ledger_review" });
});

test("a missing anchor at the bounded scroll limit never silently becomes complete", async t => {
  const { observer, surface } = fixture(t, { config: { max_scroll_steps: 1 } });
  await observer.poll();
  surface.windows = [makeMessages([8, 9]), makeMessages([7, 8]), makeMessages([6, 7]), makeMessages([2, 3, 6])];
  const result = await observer.poll();
  assert.equal(result.history_complete, false);
  assert.ok(result.observer_problems.includes("history_anchor_not_reached"));
});

test("tail arrivals without overlap during catchup force review", async t => {
  const { observer, surface } = fixture(t);
  await observer.poll();
  surface.tailCalls = 0;
  surface.onTail = value => { if (value.tailCalls === 2) value.windows = [makeMessages([100, 101])]; };
  const result = await observer.poll();
  assert.equal(result.history_complete, false);
  assert.ok(result.observer_problems.includes("tail_changed_without_overlap"));
});

test("wrong channel, login and captcha halt before scrolling or ledger ingestion", async t => {
  for (const state of ["wrong_channel", "auth_required", "captcha", "content_unavailable"]) {
    const { observer, surface, ledger } = fixture(t);
    surface.state = state;
    await assert.rejects(observer.poll(), { code: state });
    assert.equal(surface.scrolls, 0);
    assert.equal(ledger.snapshots.length, 0);
  }
});

test("an invalid message channel cannot pass through a surface with a correct channel URL", async t => {
  const { observer, surface, ledger } = fixture(t);
  surface.windows = [[{ ...message(1), channel_id: AUTHOR }]];
  await assert.rejects(observer.poll(), { code: "invalid_message" });
  assert.equal(ledger.snapshots.length, 0);
});

test("unresolved author identity forces review even at first baseline", async t => {
  const { observer, surface } = fixture(t);
  surface.windows = [[{ ...message(1), author_id: null }]];
  const result = await observer.poll();
  assert.equal(result.history_complete, false);
  assert.equal(result.health.status, "halted");
  assert.equal(observer.checkpoint, null);
});

test("restart refuses mismatched ledger/checkpoint pairs", async t => {
  const { observer, ledger, surface, config, dir } = fixture(t);
  await observer.poll();
  fs.unlinkSync(path.join(dir, "observer-checkpoint.json"));
  assert.throws(() => new MuggzoneObserver({ surface, ledger, config }), { code: "checkpoint_missing" });
  fs.writeFileSync(path.join(dir, "observer-checkpoint.json"), JSON.stringify({ channel_id: CHANNEL, anchor_ids: [id(1)] }));
  assert.throws(() => new MuggzoneObserver({ surface, ledger: new FakeLedger(), config }), { code: "ledger_missing" });
});

test("parser review with ready ledger health advances the continuity checkpoint", async t => {
  const { observer, ledger, surface } = fixture(t);
  await observer.poll();
  ledger.forceReview = true;
  surface.windows = [makeMessages([2, 3, 4])];
  const result = await observer.poll();
  assert.equal(result.status, "review");
  assert.equal(result.health.status, "ready");
  assert.ok(observer.checkpoint.anchor_ids.includes(id(4)));
});

function node(attrs = {}, selectors = {}, parents = {}) {
  return { id: attrs.id || "", innerText: attrs.text || "", getAttribute: key => attrs[key] ?? null,
    querySelectorAll: selector => selectors[selector] || [], querySelector: selector => (selectors[selector] || [])[0] || null,
    closest: selector => parents[selector] || null, contains: other => selectors.children?.includes(other) || false };
}
test("DOM reader preserves message identity, grouped aria author, embeds, reply IDs, and own timestamp", async () => {
  const scroller = { scrollHeight: 600, scrollTop: 100, clientHeight: 500 };
  const rowSelector = '[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]';
  const excluded = '[class*="repliedMessage"], [class*="embed"], [id^="message-content-"]';
  const authorExcluded = '[class*="repliedMessage"], [class*="embed"], [id^="message-content-"]';
  const ownTime = node({ datetime: "2026-10-02T14:00:00.000Z" });
  const replyTime = node({ datetime: "2020-01-01T00:00:00.000Z" }, {}, { [excluded]: {} });
  const replyAvatar = node({ src: `https://cdn.discordapp.com/avatars/999999999999999999/avatar.webp` }, {}, { [authorExcluded]: {} });
  const avatar = node({ src: `https://cdn.discordapp.com/avatars/${AUTHOR}/avatar.webp` });
  const embed = node({ text: "TP1 1.60" });
  const reply = node({ href: `/channels/${SERVER}/${CHANNEL}/${id(1)}` });
  const row1 = node({ id: `chat-messages-${CHANNEL}-${id(2)}` }, {
    'img[class*="avatar"]': [replyAvatar, avatar], 'time[datetime]': [replyTime, ownTime],
    '[class*="embedFull"], [class*="embedDescription"], [class*="embedTitle"], [class*="embedField"]': [embed],
    '[class*="repliedMessage"] a[href], [class*="repliedMessage"] [data-message-id]': [reply],
  }, { '[class*="scroller"]': scroller });
  const row2 = node({ id: `chat-messages-${CHANNEL}-${id(3)}`, 'aria-labelledby': `message-username-${id(2)}` }, { 'time[datetime]': [ownTime] }, { '[class*="scroller"]': scroller });
  const inner = { parentElement: scroller, clientHeight: 600, scrollHeight: 600, scrollTop: 0, overflow: "visible" };
  scroller.overflow = "auto";
  row1.parentElement = inner; row2.parentElement = inner;
  const header = node({}, {}, { [rowSelector]: row1 });
  const doc = {
    querySelector: () => null,
    querySelectorAll: () => [row1, row2],
    getElementById: key => key === `message-content-${id(2)}` ? node({ text: "SPY 600C 10/02 @ 1.20" }) : key === `message-content-${id(3)}` ? node({ text: "trim half" }) : key === `message-username-${id(2)}` ? header : null,
  };
  const page = { url: () => `https://discord.com/channels/${SERVER}/${CHANNEL}`, evaluate: async (callback, args) => {
    const original = global.document, originalStyle = global.getComputedStyle;
    global.document = doc; global.getComputedStyle = element => ({ overflowY: element.overflow || "visible" });
    try { return callback(args); } finally { global.document = original; global.getComputedStyle = originalStyle; }
  } };
  const result = await new DiscordDomSurface(page, { channel_url: page.url(), channel_id: CHANNEL }).inspect();
  assert.equal(result.state, "ready");
  assert.equal(result.messages[0].author_id, AUTHOR);
  assert.equal(result.messages[1].author_id, AUTHOR);
  assert.equal(result.messages[0].timestamp_utc, "2026-10-02T14:00:00.000Z");
  assert.equal(result.messages[0].raw_text, "SPY 600C 10/02 @ 1.20\n\nTP1 1.60");
  assert.equal(result.messages[0].reply_to_message_id, id(1));
  assert.equal(result.at_tail, true);
  assert.deepEqual(result.problems, []);
});

test("scrolling and tail proof use the overflow viewport rather than a scrollerInner wrapper", async () => {
  const viewport = { clientHeight: 200, scrollHeight: 1000, scrollTop: 0, overflow: "auto" };
  const inner = { clientHeight: 1000, scrollHeight: 1000, scrollTop: 0, parentElement: viewport, overflow: "visible" };
  const row = node({ id: `chat-messages-${CHANNEL}-${id(2)}`, "data-author-id": AUTHOR }, { 'time[datetime]': [node({ datetime: "2026-10-02T14:00:00Z" })] });
  row.parentElement = inner;
  const doc = { querySelector: selector => selector.startsWith('[id^="chat-messages-') ? row : null, querySelectorAll: () => [row], getElementById: () => node({ text: "SPY 600C 10/02 @ 1.20" }) };
  const page = { url: () => `https://discord.com/channels/${SERVER}/${CHANNEL}`, waitForTimeout: async () => {}, evaluate: async (callback, args) => {
    const original = global.document, originalStyle = global.getComputedStyle;
    global.document = doc; global.getComputedStyle = element => ({ overflowY: element.overflow || "visible" });
    try { return callback(args); } finally { global.document = original; global.getComputedStyle = originalStyle; }
  } };
  const surface = new DiscordDomSurface(page, { channel_url: page.url(), channel_id: CHANNEL });
  assert.equal((await surface.inspect()).at_tail, false);
  await surface.scrollToTail();
  assert.equal(viewport.scrollTop, 1000);
  assert.equal(inner.scrollTop, 0);
  assert.equal((await surface.inspect()).at_tail, true);
  await surface.scrollBack();
  assert.equal(viewport.scrollTop, 870);
});
