'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  captureManualSybilPaste,
  looksLikeManualSybilPaste,
} = require('../lib/kat-stage2/manual-paste-capture');
const {
  captureManualAnalystPaste,
  looksLikeManualAnalystPaste,
} = require('../lib/kat-stage2/manual-analyst-capture');
const { defaultStage2Config } = require('../lib/kat-stage2/config');
const { ingestStage2Messages } = require('../lib/kat-stage2/ingest');
const { parseManualDiscordPaste, splitPasteBlocks } = require('../lib/kat-stage2/manual-paste');
const { parseStage2Messages } = require('../lib/kat-stage2/parser');
const { parseSybilContexts } = require('../lib/kat-stage2/sybil');

const SAMPLE = `[7:16 PM] podcaste [V S], : @Sybil
[7:16 PM]
APP
 Sybil: I can, but FIG is ambiguous / probably not a live common-stock ticker in the usual U.S. sense.

So if you want real DD, send me exact ticker + exchange, company name, or a screenshot / link.
[7:17 PM] podcaste [V S], : its $FIGS @Sybil
[7:17 PM]
APP
 Sybil: FIGS quick DD

Trend: bullish
Momentum: weakening
Last close: 15.40
RSI: 52.8
Buy zone: 14.12-15.39
Sell / resistance zone: 16.94-17.94
[8:01 PM]
APP
 Sybil: FIG (Figma) - proper first-pass analysis

Trend: mixed
Momentum: improving
Last close: 18.74
RSI: 44.7
Buy zone: 16.60-18.10
Sell / resistance zone: 21.65-23.15
[3:21 PM] podcaste [V S], : @Sybil please look up baba flow on spotgamma
[3:21 PM]
APP
 Sybil: BABA SpotGamma flow

Low Vol Point: $132
High Vol Point: $165
Call Gamma: -26M
Put Gamma: 16M
HIRO: +18M
Key Gamma / Key Delta / Call Wall: 150
[3:26 PM]
APP
 Sybil: BABA calls = best directional upside
FXI straddle = best pure event-vol expression
ASHR calls = best clean onshore China beta`;

const ANALYST_SAMPLE = `[6:14 AM] KapriK0rn3, : buying spx 0DTE 7300c @ 1.25 stop .80 target 2.50
[6:16 AM] KapriK0rn3, : trim 50% at 1.80 runner
[6:20 AM] El Jefe, : SPX heatmap king node 7310 support 7280`;

describe('Kat Stage 2 manual Sybil paste adapter', () => {
  it('splits Discord-style pasted transcript blocks', () => {
    const blocks = splitPasteBlocks(SAMPLE);

    expect(blocks.length).toBe(8);
    expect(blocks[0].clock).toBe('7:16 PM');
    expect(blocks[0].rest).toContain('@Sybil');
  });

  it('normalizes manual paste lines into Sybil context message rows', () => {
    const rows = parseManualDiscordPaste(SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      channelName: 'manual-sybil-paste',
      provenanceNote: 'user pasted FIG/BABA Sybil transcript',
      pastedAtUtc: '2026-05-07T23:00:00.000Z',
    });

    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual(expect.objectContaining({
      author_name: 'podcaste',
      source_type: 'manual_paste',
      source_collection: 'sybil',
      channel_name: 'manual-sybil-paste',
      timestamp_utc: '2026-05-07T23:16:00.000Z',
    }));
    expect(rows.some(row => row.app_message && row.author_name === 'Sybil')).toBe(true);
    expect(rows.find(row => row.raw_text.includes('BABA SpotGamma flow')).raw_text).toContain('Call Wall: 150');
  });

  it('lets Sybil context parser keep manual paste as context, including watchlist symbols', () => {
    const rows = parseManualDiscordPaste(SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      channelName: 'manual-sybil-paste',
    });
    const parsed = parseSybilContexts(rows);

    const symbols = parsed.contexts.flatMap(context => context.symbols_mentioned);
    expect(symbols).toEqual(expect.arrayContaining(['FIG', 'FIGS', 'BABA', 'FXI', 'ASHR']));
    expect(parsed.summary.context_records).toBeGreaterThan(0);
    expect(parsed.summary.tag_counts.gamma_gex).toBeGreaterThan(0);
    expect(parsed.summary.tag_counts.positioning).toBeGreaterThan(0);
  });

  it('captures a manual Sybil paste to context-only JSONL files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sybil-paste-'));
    const messagesFile = path.join(dir, 'messages.jsonl');
    const contextFile = path.join(dir, 'contexts.jsonl');

    expect(looksLikeManualSybilPaste(SAMPLE)).toBe(true);

    const captured = captureManualSybilPaste(SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      messagesFile,
      contextFile,
      pastedAtUtc: '2026-05-07T23:00:00.000Z',
    });

    expect(captured.summary.messages).toBe(8);
    expect(captured.summary.context_records).toBeGreaterThan(0);
    expect(captured.reply).toContain('Stored as context only');
    expect(fs.readFileSync(messagesFile, 'utf8').split(/\r?\n/).filter(Boolean)).toHaveLength(8);
    expect(fs.readFileSync(contextFile, 'utf8')).toContain('"source_collection"');
  });

  it('does not turn manual Sybil DD/options language into trade calls', () => {
    const rows = parseManualDiscordPaste(SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      channelName: 'manual-sybil-paste',
    });
    const parsed = parseStage2Messages(rows);

    expect(parsed.summary.trade_calls).toBe(0);
    expect(parsed.summary.valid_trade_calls).toBe(0);
    expect(parsed.rejected.every(row => row.reason === 'sybil_context_only_not_trade_source')).toBe(true);
  });

  it('feeds manual Sybil capture into Stage 2 ingestion without changing trade-call counts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sybil-ingest-'));
    const config = defaultStage2Config({ rootDir: dir });

    captureManualSybilPaste(SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      messagesFile: config.inputs.manualSybilMessages,
      contextFile: config.inputs.manualSybilContexts,
      pastedAtUtc: '2026-05-07T23:00:00.000Z',
    });

    const ingestion = ingestStage2Messages(config, {
      includeDiscordExports: false,
      includeManualSybil: true,
    });
    const parsed = parseStage2Messages(ingestion.messages);

    expect(ingestion.inventory.manual_sybil_messages).toBe(8);
    expect(ingestion.inventory.deduped_messages).toBe(8);
    expect(parsed.summary.valid_trade_calls).toBe(0);
  });

  it('captures manual KatBot analyst paste as Stage 2 trade/update/heatmap input', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-analyst-'));
    const messagesFile = path.join(dir, 'manual-analyst.jsonl');

    expect(looksLikeManualAnalystPaste(ANALYST_SAMPLE)).toBe(true);

    const captured = captureManualAnalystPaste(ANALYST_SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      messagesFile,
      pastedAtUtc: '2026-05-07T10:30:00.000Z',
    });

    expect(captured.summary.messages_processed).toBe(3);
    expect(captured.summary.valid_trade_calls).toBe(1);
    expect(captured.summary.trade_updates).toBe(1);
    expect(captured.summary.heatmaps).toBe(1);
    expect(captured.reply).toContain('KatBot analyst paste captured');
    expect(captured.reply).toContain('No trade was staged');
    expect(fs.readFileSync(messagesFile, 'utf8').split(/\r?\n/).filter(Boolean)).toHaveLength(3);
  });

  it('pushes back on incomplete manual analyst paste instead of pretending it is verified', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-analyst-pushback-'));
    const messagesFile = path.join(dir, 'manual-analyst.jsonl');
    const captured = captureManualAnalystPaste('SPX calls maybe, watching this after open', {
      messagesFile,
      pastedAtUtc: '2026-05-07T10:30:00.000Z',
    });

    expect(captured.summary.valid_trade_calls).toBe(0);
    expect(captured.summary.partial_trade_calls).toBeGreaterThanOrEqual(1);
    expect(captured.reply).toContain('Pushback');
    expect(captured.reply).toContain('No trade was staged');
  });

  it('feeds manual KatBot analyst capture into Stage 2 ingestion as trade-call data', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-analyst-ingest-'));
    const config = defaultStage2Config({ rootDir: dir });

    captureManualAnalystPaste(ANALYST_SAMPLE, {
      baseDate: '2026-05-07',
      utcOffset: '-04:00',
      messagesFile: config.inputs.manualAnalystMessages,
      pastedAtUtc: '2026-05-07T10:30:00.000Z',
    });

    const ingestion = ingestStage2Messages(config, {
      includeDiscordExports: false,
      includeManualAnalyst: true,
      includeManualSybil: false,
    });
    const parsed = parseStage2Messages(ingestion.messages);

    expect(ingestion.inventory.manual_analyst_messages).toBe(3);
    expect(parsed.summary.valid_trade_calls).toBe(1);
    expect(parsed.summary.trade_updates).toBe(1);
    expect(parsed.summary.heatmaps).toBe(1);
  });
});
