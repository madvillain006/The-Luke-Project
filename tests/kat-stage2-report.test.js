'use strict';

const { buildMarkdownReport } = require('../lib/kat-stage2/report');
const { defaultStage2Config } = require('../lib/kat-stage2/config');

describe('Kat Stage 2 report', () => {
  it('labels small samples and gains-only caveats', () => {
    const config = defaultStage2Config({ rootDir: process.cwd() });
    const md = buildMarkdownReport({
      config,
      outputPaths: {},
      discovery: { katbot: { location: 'agents/agent-14-kat.js' } },
      ingestion: { inventory: { kat_raw_messages: 1, manual_analyst_messages: 1, manual_sybil_messages: 2, discord_export_messages: 0, deduped_messages: 4, attachments: 0, analysts: { a: 1 }, channels: { c: 1 } } },
      sybil: { summary: { context_records: 2, low_signal_records: 0, attachments: 0, tag_counts: { gamma_gex: 1 } } },
      parsed: { trade_calls: [{ timestamp_utc: 't', analyst_name: 'a', normalized_symbol: 'ES', direction: 'long', entry_type: 'market', parse_status: 'valid' }], summary: {} },
      linked: { gains_posts: [], trade_updates: [], heatmaps: [], trade_heatmap_links: [] },
      marketData: { coverage: { ES: { found: true, rows: 2, first_timestamp: 'a', last_timestamp: 'b', source: 'local_csv' } } },
      features: [],
      backtestResults: [],
      metrics: {
        inventory: {
          heatmaps_cataloged: 0,
          candidate_trade_calls: 1,
          valid_trade_calls: 1,
          partial_trade_calls: 0,
          ambiguous_trade_calls: 0,
          rejected_messages: 0,
          trade_updates: 0,
          linked_updates: 0,
          gains_only_posts: 1,
          verified_linked_gains: 0,
          heatmaps_linked_to_trades: 0,
        },
        overall: { total_results: 1, backtestable_trades: 1, win_count: 0, loss_count: 0, partial_count: 0, unresolved_count: 1 },
        by_analyst: { analyst1: { backtestable_trades: 1, win_count: 1, loss_count: 0, hit_rate: 1, expectancy_points: 2, average_r: 1 } },
        by_symbol: {},
        by_heatmap_confluence: {},
        by_time_of_day: {},
        caveats: ['Gains-only posts are not counted as verified calls unless linked to a prior call.'],
      },
    });

    expect(md).toContain('low sample');
    expect(md).toContain('Gains-only screenshots/captions are not counted as verified trade calls');
    expect(md).toContain('No-lookahead rule');
    expect(md).toContain('Manual Sybil/server context messages: 2');
    expect(md).toContain('Manual KatBot analyst paste messages: 1');
    expect(md).toContain('Sybil is treated as regime/equity/SPX context only, not verified trade calls.');
    expect(md).toContain('Context records: 2');
  });
});
