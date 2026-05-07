'use strict';

const { attachmentRows, sourceCollectionForExport } = require('../lib/kat-stage2/ingest');
const { computeFeaturesForTrades } = require('../lib/kat-stage2/features');
const { parseStage2Messages, parseTradeCall } = require('../lib/kat-stage2/parser');
const { extractSymbols, filterOutSybilMessages, isSybilMessage, parseSybilContexts } = require('../lib/kat-stage2/sybil');

function sybilMessage(overrides = {}) {
  return {
    message_id: overrides.message_id || 'sybil-1',
    source_collection: 'sybil',
    source_file: overrides.source_file || 'discord-exports\\Sybil\\podcaste server - ask-sybil.json',
    channel_name: overrides.channel_name || 'ask-sybil',
    author_id: 'u1',
    author_name: 'Sybil',
    timestamp_utc: overrides.timestamp_utc || '2026-05-07T13:00:00.000Z',
    raw_text: overrides.raw_text || '$SPY risk off into CPI, gamma pinning and breadth weak. NVDA still leading AI software.',
    attachments: overrides.attachments || [],
  };
}

describe('Kat Stage 2 Sybil context integration', () => {
  it('normalizes DiscordChatExporter attachment fields without fetching image data', () => {
    const rows = attachmentRows([{
      id: 'att1',
      fileName: 'sybil-heatmap.png',
      fileSizeBytes: 123456,
      url: 'https://cdn.discordapp.com/attachments/sybil-heatmap.png',
      contentType: 'image/png',
    }]);

    expect(rows[0].filename).toBe('sybil-heatmap.png');
    expect(rows[0].size).toBe(123456);
    expect(rows[0].content_type).toBe('image/png');
    expect(rows[0].url).toContain('cdn.discordapp.com');
  });

  it('tags Sybil exports as context-only data', () => {
    expect(sourceCollectionForExport('C:\\Users\\conor\\luke\\discord-exports\\Sybil\\narratives.json', 'narratives')).toBe('sybil');
    expect(sourceCollectionForExport('discord-exports\\Sybil\\vault-notes.json', 'vault-notes')).toBe('sybil');
    expect(sourceCollectionForExport('discord-exports\\Kat\\trade-floor.json', 'trade-floor')).toBe('discord_export');
    expect(isSybilMessage(sybilMessage())).toBe(true);
  });

  it('extracts regime and equity tags while keeping attachments metadata-only', () => {
    const parsed = parseSybilContexts([sybilMessage({
      attachments: [{
        id: 'att1',
        filename: 'sybil.png',
        url: 'https://cdn.discordapp.com/attachments/sybil.png',
        content_type: 'image/png',
        size: 100,
      }],
    })]);

    expect(parsed.summary.context_records).toBe(1);
    expect(parsed.summary.attachments).toBe(1);
    expect(parsed.contexts[0].symbols_mentioned).toContain('SPY');
    expect(parsed.contexts[0].context_tags).toEqual(expect.arrayContaining(['risk_off', 'gamma_gex', 'breadth', 'ai_software']));
    expect(parsed.contexts[0].attachment_refs[0]).toEqual(expect.objectContaining({
      filename: 'sybil.png',
      has_url: true,
    }));
    expect(parsed.contexts[0]).not.toHaveProperty('extracted_text');
  });

  it('extracts structured DD/operator fields from Sybil context without OCR', () => {
    const parsed = parseSybilContexts([sybilMessage({
      raw_text: `BABA SpotGamma flow
Trend: bullish
Momentum: weakening
Last close: 132.40
RSI: 52.8
Buy zone: 128-132
Sell / resistance zone: 150-165
Low Vol Point: $132
High Vol Point: $165
Call Gamma: -26M
Put Gamma: 16M
HIRO: +18M
Key Gamma / Key Delta / Call Wall: 150
BABA calls = best directional upside
What kills it: event gap down under 128`,
    })]);

    const context = parsed.contexts[0];
    expect(context.symbols_mentioned).toContain('BABA');
    expect(context.structured_dd.chart_tape_metrics).toEqual(expect.objectContaining({
      trend: 'bullish',
      momentum: 'weakening',
      last_close: 132.4,
      rsi: 52.8,
    }));
    expect(context.structured_dd.spotgamma_metrics).toEqual(expect.objectContaining({
      low_vol_point: 132,
      high_vol_point: 165,
      hiro: '+18M',
      key_gamma_delta_call_wall: 150,
    }));
    expect(context.structured_dd.expression_map.join('\n')).toMatch(/BABA calls/);
    expect(context.structured_dd.what_kills_it.join('\n')).toMatch(/gap down/);
  });

  it('keeps Sybil trade-like language out of Stage 2 trade calls', () => {
    const sybil = sybilMessage({
      message_id: 'sybil-trade-like',
      raw_text: 'Sybil: BABA calls = best directional upside. SPX puts below 7000 would hedge the event stack.',
    });
    const analyst = {
      message_id: 'analyst-trade',
      author_id: 'u2',
      author_name: 'kaprik0rn3',
      timestamp_utc: '2026-05-07T13:05:00.000Z',
      channel_name: 'trade-floor',
      raw_text: 'BABA calls over 150 stop 145 target 165',
      attachments: [],
    };

    expect(parseTradeCall(sybil)).toBeNull();
    expect(filterOutSybilMessages([sybil, analyst])).toEqual([analyst]);
    const parsed = parseStage2Messages([sybil, analyst]);
    expect(parsed.summary.trade_calls).toBe(1);
    expect(parsed.summary.valid_trade_calls).toBe(1);
    expect(parsed.rejected.find(row => row.source_message_id === 'sybil-trade-like').reason).toBe('sybil_context_only_not_trade_source');
  });

  it('requires context for watchlist symbols while preserving core index/futures tickers', () => {
    expect(extractSymbols('The TEAM should review COIN flip GS notes and FIG labels later.')).toEqual([]);
    expect(extractSymbols('SPX and es regime context with vix up')).toEqual(expect.arrayContaining(['SPX', 'ES', 'VIX']));
    expect(extractSymbols('TEAM calls over 190 after earnings, risk under 180')).toContain('TEAM');
    expect(extractSymbols('COIN flow and SpotGamma wall are driving crypto beta')).toContain('COIN');
    expect(extractSymbols('its $FIGS @Sybil, not FIG')).toEqual(expect.arrayContaining(['FIGS']));
  });

  it('joins prior Sybil context to SPX-family trades without using future context', () => {
    const parsed = parseSybilContexts([
      sybilMessage({ message_id: 'past', timestamp_utc: '2026-05-07T13:00:00.000Z', raw_text: '$SPY risk on breadth expanding' }),
      sybilMessage({ message_id: 'future', timestamp_utc: '2026-05-07T15:00:00.000Z', raw_text: '$SPY risk off after FOMC' }),
    ]);
    const features = computeFeaturesForTrades([{
      trade_id: 't1',
      normalized_symbol: 'SPX',
      timestamp_utc: '2026-05-07T14:00:00.000Z',
    }], { bySymbol: {} }, [], parsed.contexts);

    expect(features[0].sybil_context_present).toBe(true);
    expect(features[0].sybil_context_count).toBe(1);
    expect(features[0].sybil_context_tags).toContain('risk_on');
    expect(features[0].sybil_context_tags).not.toContain('risk_off');
  });
});
