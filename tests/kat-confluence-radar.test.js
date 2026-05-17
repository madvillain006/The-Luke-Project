'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { recordRadarIngest, buildRadarSnapshot } = require('../lib/brain/radar-layer');
const {
  buildKatAnalystRadarIngest,
  buildKatVisionRadarIngest,
  recordKatAnalystCapture,
  mirrorKatPayloadToRollingRadar,
} = require('../lib/kat-radar-bridge');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-kat-radar-'));
  return {
    root,
    paths: {
      events: {
        radarIngest: path.join(root, 'events', 'radar-ingest.jsonl'),
        radarReviews: path.join(root, 'events', 'radar-reviews.jsonl'),
      },
      snapshots: {
        radarState: path.join(root, 'snapshots', 'radar-state.json'),
      },
    },
  };
}

const ROOT = path.join(__dirname, '..');

describe('katbot confluence radar bridge', () => {
  it('katbot_paste items always get review_priority review (human gate)', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T14:00:00.000Z');
    const result = recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      title: 'BULL ES_NQ confluence',
      text: 'BULL KAT ALERT - ES_NQ confluence brewing\n- 2 analysts bullish: kapri, dubz\n- Pine/Luke Watch context only - not an order',
      relationship_ids: ['kat:kapri', 'kat:dubz'],
    }, { paths, now });

    expect(result.ok).toBe(true);
    expect(result.item.source_type).toBe('katbot_paste');
    expect(result.item.review_priority).toBe('review');
    expect(result.item.scope).toBe('katbot_confluence');
    expect(result.item.status).toBe('review_only');
    expect(result.item.recall_reason).toBe('katbot_confluence_evidence');
    expect(result.item.review_only).toBe(true);
    expect(result.item.trading_authority).toBe('none');
    expect(result.item.relationship_ids).toEqual(['kat:kapri', 'kat:dubz']);
  });

  it('katbot confluence alert appears in radar review queue', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-08T14:00:00.000Z');
    recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      text: 'BEAR KAT ALERT - SPX confluence brewing\n- 3 analysts bearish\n- Pine/Luke Watch context only - not an order',
    }, { paths, now });

    const snapshot = buildRadarSnapshot(paths, now);
    expect(snapshot.counts.review).toBe(1);
    expect(snapshot.source_type_counts.katbot_paste).toBe(1);
    expect(snapshot.review_queue[0]).toEqual(expect.objectContaining({
      review_only: true,
      trading_authority: 'none',
      recall_reason: 'katbot_confluence_evidence',
    }));
  });

  it('agent-14-kat.js contains the radar ingest call for confluence alerts', () => {
    const agent14 = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');
    expect(agent14).toContain('katbot-confluence');
    expect(agent14).toContain('recordRadarIngest');
    expect(agent14).toContain('recordKatCaptureToRadar(entry, signal)');
    expect(agent14).toContain('recordKatVisionToRadar(record, stored.processed)');
    expect(agent14).toContain("envFlagEnabled('KATBOT_ENABLE_LIVE_VISION') && envFlagEnabled('LUKE_ALLOW_ANTHROPIC_VISION')");
  });

  it('builds review-only radar ingest payloads for every monitored analyst capture', () => {
    const entry = {
      ts: '2026-05-16T20:00:00.000Z',
      message_id: 'discord-msg-1',
      channel_name: 'trade-floor',
      username: 'AnalystA',
      content: '$SPX watching 5400 support reclaim. bullish if holds.',
      attachments: [],
    };
    const signal = {
      signal_type: 'LEVEL_WATCH',
      analyst: 'AnalystA',
      ticker: 'SPX',
      bias: 'BULLISH',
      timeframe: '5M',
      levels: [5400],
      raw: entry.content,
    };

    const payload = buildKatAnalystRadarIngest(entry, signal);
    expect(payload).toEqual(expect.objectContaining({
      source_label: 'katbot-analyst-feed',
      source_type: 'katbot_paste',
      scope: 'katbot_analyst_feed',
      status: 'review_only',
      review_only: true,
      human_gate: 'required',
      trading_authority: 'none',
      execution_routes: [],
    }));
    expect(payload.text).toContain('Katbot monitored analyst capture');
    expect(payload.text).toContain('Review-only. No execution authority. Human gate required.');
    expect(payload.text).toContain('Analyst: AnalystA');
    expect(payload.text).toContain('Levels: 5400');
    expect(payload.relationship_ids).toEqual(expect.arrayContaining(['kat:AnalystA', 'kat-message:discord-msg-1', 'symbol:SPX']));
  });

  it('records monitored analyst captures into Radar review queue without execution authority', () => {
    const { paths } = tempPaths();
    const now = new Date('2026-05-16T20:00:00.000Z');
    const result = recordKatAnalystCapture({
      ts: now.toISOString(),
      message_id: 'discord-msg-2',
      channel_name: 'trade-floor',
      username: 'AnalystB',
      content: '$QQQ bear flag under 460',
      attachments: [],
    }, {
      signal_type: 'DIRECTIONAL',
      analyst: 'AnalystB',
      ticker: 'QQQ',
      bias: 'BEARISH',
      levels: [460],
    }, { recordOptions: { paths, now } });

    expect(result.ok).toBe(true);
    expect(result.item.source_type).toBe('katbot_paste');
    expect(result.item.review_priority).toBe('review');
    expect(result.item.review_only).toBe(true);
    expect(result.item.trading_authority).toBe('none');
    expect(result.item.scope).toBe('katbot_analyst_feed');
    expect(result.item.status).toBe('review_only');
  });

  it('builds review-only radar ingest payloads for Katbot vision parses', () => {
    const payload = buildKatVisionRadarIngest({
      vision_id: 'kat-vision:abc',
      analyst: 'AnalystC',
      channel: 'trade-floor',
      message_id: 'discord-msg-3',
      attachment_id: 'att-1',
      ts: '2026-05-16T20:05:00.000Z',
      chart_type: 'heatmap',
      ticker: 'SPX',
      bias: 'BULLISH',
      levels: [5400, 5425],
      notes: 'Liquidity node above spot.',
      raw_text: 'heatmap update',
      attachment: { url: 'https://cdn.discordapp.example/chart.png' },
    });

    expect(payload).toEqual(expect.objectContaining({
      source_label: 'katbot-vision-feed',
      source_type: 'katbot_paste',
      scope: 'katbot_vision_confluence',
      status: 'review_only',
      review_only: true,
      human_gate: 'required',
      trading_authority: 'none',
      execution_routes: [],
      source_url: 'https://cdn.discordapp.example/chart.png',
    }));
    expect(payload.text).toContain('Katbot analyst image/vision parse');
    expect(payload.text).toContain('Levels: 5400, 5425');
    expect(payload.relationship_ids).toEqual(expect.arrayContaining(['kat:AnalystC', 'kat-message:discord-msg-3', 'kat-vision:abc', 'symbol:SPX']));
  });


  it('mirrors Katbot captures into rolling brain radar cards and LukeSync index', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-kat-radar-mirror-'));
    const paths = {
      sourcesDir: path.join(root, 'brain', 'trading', 'sources', 'katbot'),
      cardsDir: path.join(root, 'brain', 'trading', 'radar-cards'),
      handoffIndex: path.join(root, 'LukeSync', 'handoff', 'market-captures', 'radar', 'INDEX.md'),
    };
    const payload = buildKatAnalystRadarIngest({
      ts: '2026-05-16T20:15:00.000Z',
      message_id: 'discord-msg-mirror',
      channel_name: 'trade-floor',
      username: 'AnalystMirror',
      content: '$ES buyers defending 5340 after flush.',
      attachments: [],
    }, {
      signal_type: 'LEVEL_WATCH',
      analyst: 'AnalystMirror',
      ticker: 'ES',
      bias: 'BULLISH',
      levels: [5340],
    });

    const result = mirrorKatPayloadToRollingRadar(payload, {
      item: { id: 'radar_test_mirror', ts: '2026-05-16T20:15:00.000Z' },
    }, { ...paths, now: '2026-05-16T20:15:00.000Z', expiresAt: '2026-05-18T12:00:00.000Z' });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(result.source_note)).toBe(true);
    expect(fs.existsSync(result.radar_card)).toBe(true);
    expect(fs.existsSync(result.handoff_index)).toBe(true);

    const sourceNote = fs.readFileSync(result.source_note, 'utf8');
    const card = fs.readFileSync(result.radar_card, 'utf8');
    const index = fs.readFileSync(result.handoff_index, 'utf8');
    expect(sourceNote).toContain('review_only: true');
    expect(sourceNote).toContain('human_gate: required');
    expect(card).toContain('thesis_id: katbot-analyst-feed-2026-05-16');
    expect(card).toContain('execution_authority: none');
    expect(card).toContain('radar_test_mirror');
    expect(index).toContain('Katbot analyst feed rolling inbox — 2026-05-16');
  });

  it('recordKatAnalystCapture mirrors when explicit mirror paths are provided', () => {
    const { paths } = tempPaths();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-kat-radar-record-mirror-'));
    const result = recordKatAnalystCapture({
      ts: '2026-05-16T20:20:00.000Z',
      message_id: 'discord-msg-record-mirror',
      channel_name: 'trade-floor',
      username: 'AnalystRecordMirror',
      content: '$NQ sellers active under 19000',
      attachments: [],
    }, {
      signal_type: 'DIRECTIONAL',
      analyst: 'AnalystRecordMirror',
      ticker: 'NQ',
      bias: 'BEARISH',
      levels: [19000],
    }, {
      recordOptions: { paths, now: new Date('2026-05-16T20:20:00.000Z') },
      mirrorOptions: {
        sourcesDir: path.join(root, 'sources'),
        cardsDir: path.join(root, 'cards'),
        handoffIndex: path.join(root, 'handoff', 'radar', 'INDEX.md'),
        now: '2026-05-16T20:20:00.000Z',
        expiresAt: '2026-05-18T12:00:00.000Z',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.rolling_radar_mirror).toEqual(expect.objectContaining({ ok: true }));
    expect(fs.existsSync(result.rolling_radar_mirror.source_note)).toBe(true);
    expect(fs.existsSync(result.rolling_radar_mirror.radar_card)).toBe(true);
  });

  it('katbot confluence radar ingest creates no live candidate path', () => {
    const { paths } = tempPaths();
    const result = recordRadarIngest({
      source_label: 'katbot-confluence',
      source_type: 'katbot_paste',
      text: 'BULL KAT ALERT - SPX confluence brewing\n- Pine/Luke Watch context only - not an order',
    }, { paths });

    expect(result.item.review_state).toBe('new');
    expect(result.item).not.toHaveProperty('live');
    expect(result.item).not.toHaveProperty('execute');
    expect(result.item).not.toHaveProperty('broker');
  });
});
