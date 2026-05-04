'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Kat agent live surface', () => {
  it('pushes index analyst signals and chart posts into Luke broadcasts with provenance', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("type: 'kat_signal'");
    expect(source).toContain("type: 'kat_chart_pending'");
    expect(source).toContain("type: 'kat_watchlist_signal'");
    expect(source).toContain('appendKatVisionRecord');
    expect(source).toContain("type: 'kat_vision'");
    expect(source).toContain('../lib/kat-vision-store');
    expect(source).toContain('option_context:');
    expect(source).toContain('equity_context:');
    expect(source).toContain('broadcastKatCapture(entry, signal)');
    expect(source).toContain('broadcastKatCapture(entry, null)');
    expect(source).toContain('message_id: entry.message_id');
    expect(source).toContain("source: 'katbot-discord'");
    expect(source).toContain('human_gate_required: true');
  });

  it('exposes a welcome/help surface that matches current capabilities', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain('function getKatWelcomeMessage()');
    expect(source).toContain('Kat pushes monitored SPX/SPY/ES/QQQ/NDX/NQ analyst signals and chart posts into Luke as they arrive.');
    expect(source).toContain('Confluence messages require analyst agreement plus current levels loaded.');
    expect(source).toContain('Kat also tracks repeated equity/options tickers as a shadow watchlist');
    expect(source).toContain('`!kat watchlist`');
    expect(source).toContain('`!kat equity TSLA`');
    expect(source).toContain('Kat replies suppress Discord mentions by default');
    expect(source).toContain("router.get('/welcome'");
    expect(source).toContain('No autonomous execution');
  });

  it('suppresses Discord pings and pushes confluence into Luke with level context', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("const SAFE_ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false })");
    expect(source).toContain('discordOutputAllowed');
    expect(source).toContain('Discord reply suppressed by output gate');
    expect(source).toContain('Discord channel post suppressed by output gate');
    expect(source).toContain('recordKatOutputBin');
    expect(source).toContain('function safeReply(message, payload)');
    expect(source).toContain('function safeSend(channel, payload)');
    expect(source).toContain('levelContextForKatInstrument(instrument)');
    expect(source).toContain("type: 'kat_confluence'");
    expect(source).toContain('human_gate_required: true');
  });

  it('exposes equity/options shadow profile routes without adding execution surfaces', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("router.get('/equity-options'");
    expect(source).toContain("router.get('/equity-options/:ticker'");
    expect(source).toContain('buildKatEquityOptionsProfile(ticker)');
    expect(source).not.toContain('/execute');
  });

  it('exposes Kat readiness without enabling Discord output by default', () => {
    const source = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(source).toContain("router.get('/readiness'");
    expect(source).toContain("router.get('/readiness.md'");
    expect(source).toContain('discord_responses_enabled: false');
    expect(source).toContain('discord_posts_enabled: false');
  });
});
