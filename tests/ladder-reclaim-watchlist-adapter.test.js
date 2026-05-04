'use strict';

const fs = require('fs');
const path = require('path');

const {
  CANDIDATE_NAME,
  CANDIDATE_STATUS,
  buildLadderReclaimWatchlistResponse,
  getLadderReclaimCaseImagePath,
} = require('../lib/operator/ladder-reclaim-watchlist-adapter');

const ROOT = path.join(__dirname, '..');

function fixtureReader(fixtures) {
  return (filePath, fallback = null) => {
    const key = path.basename(filePath);
    return Object.prototype.hasOwnProperty.call(fixtures, key) ? fixtures[key] : fallback;
  };
}

function account(account, mode, pnl, maxDrawdown, failed = false) {
  return {
    account,
    mode,
    total_trades: 47,
    cumulative_pnl: pnl,
    max_drawdown: maxDrawdown,
    target: account === '50k' ? 3000 : 1250,
    target_hit: false,
    account_failed: failed,
    continuous_profitable: !failed && pnl > 0,
    profit_factor: 1.28,
    average_trade_pnl: mode === '2ES_FULL' ? 23.94 : 11.97,
    positive_day_rate: 0.46,
  };
}

describe('ladder reclaim watchlist adapter', () => {
  it('returns a read-only PAPER_CANDIDATE summary with 25k and 50k research fields', () => {
    const result = buildLadderReclaimWatchlistResponse({
      readJsonFn: fixtureReader({
        'ladder-reclaim-bobby-mancini-review.json': {
          summary: {
            rows: 91,
            unique_setups: 91,
            tp_plus_2_rate: 0.912,
            stop_first_rate: 0.099,
            avg_heat_before_tp1: 1.16,
            median_heat_before_tp1: 0.75,
            avg_stop_points: 2.43,
          },
        },
        'ladder-reclaim-25k-1es-review.json': {
          rows: 47,
          avg_account_impact_1es: 11.97,
        },
        'ladder-reclaim-staged-add-analysis.json': {
          best_variant_25k: {
            variant: '1ES_ADD_AFTER_RETEST_HOLD',
            account: '25k',
            trades: 47,
            cumulative_pnl: 2850,
            max_drawdown: 487.5,
            failed: false,
            continuous_profitable: true,
          },
          best_variant_50k: {
            variant: '1ES_ADD_AFTER_RETEST_HOLD',
            account: '50k',
            trades: 47,
            cumulative_pnl: 2850,
            max_drawdown: 487.5,
            failed: false,
            continuous_profitable: true,
          },
        },
        'ladder-reclaim-false-positives.json': {
          summary: { category_counts: { reclaim_failed: 12 } },
        },
        'ladder-reclaim-case-image-manifest.json': {
          positive: [{ date: '2026-04-02', timestamp_et: '2026-04-02T11:31:00-04:00', source_combo: 'bobby+mancini', result: 'tp_plus_2', png: path.join(ROOT, 'artifacts', 'review', 'ok.png') }],
          negative: [{ date: '2026-04-20', timestamp_et: '2026-04-20T09:49:00-04:00', source_combo: 'mancini', result: 'stop_first', png: path.join(ROOT, 'artifacts', 'review', 'bad.png') }],
        },
        'multi-source-ladder-reclaim-results.json': {
          summary: {
            generated_at: '2026-05-04T12:52:50.112Z',
            rows: 933,
            account_sim: {
              '25k_1ES_STARTER': account('25k', '1ES_STARTER', 562.5, 525),
              '25k_2ES_FULL': account('25k', '2ES_FULL', -1050, 1050, true),
              '50k_1ES_STARTER': account('50k', '1ES_STARTER', 562.5, 525),
              '50k_2ES_FULL': account('50k', '2ES_FULL', 1125, 1050),
            },
          },
        },
      }),
    });

    expect(result.read_only).toBe(true);
    expect(result.no_execution).toBe(true);
    expect(result.no_trade_recommendation).toBe(true);
    expect(result.candidate).toEqual(expect.objectContaining({
      name: CANDIDATE_NAME,
      status: CANDIDATE_STATUS,
      promoted_live: false,
      promoted_paper_only: false,
    }));
    expect(result.research_stats.examples).toBe(91);
    expect(result.research_stats.account_25k_1es).toEqual(expect.objectContaining({
      cumulative_pnl: 562.5,
      continuous_profitable: true,
    }));
    expect(result.research_stats.account_50k_2es).toEqual(expect.objectContaining({
      cumulative_pnl: 1125,
      continuous_profitable: true,
    }));
    expect(result.research_stats.best_staged_add_50k).toEqual(expect.objectContaining({
      account: '50k',
      variant: '1ES_ADD_AFTER_RETEST_HOLD',
    }));
    expect(result.example_images.positive).toEqual(expect.objectContaining({
      label: 'Good example: first reclaim worked',
      image_route: '/api/research/ladder-reclaim-watchlist/image?kind=positive&index=0',
    }));
    expect(result.example_images.negative).toEqual(expect.objectContaining({
      label: 'Bad example: reclaim failed / stop-first',
    }));
    expect(result.live_state.available).toBe(false);
    expect(result.live_state.state).toBe('UNKNOWN');
  });

  it('keeps the app route GET-only and does not add execution controls to operator-v2', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
    const operator = fs.readFileSync(path.join(ROOT, 'operator-v2.html'), 'utf8');

    expect(index).toContain('app.get("/api/research/ladder-reclaim-watchlist"');
    expect(index).toContain('app.get("/api/research/ladder-reclaim-watchlist/image"');
    expect(index).not.toContain('app.post("/api/research/ladder-reclaim-watchlist"');
    expect(operator).toContain('Ladder Reclaim Watchlist');
    expect(operator).toContain('Good example: first reclaim worked');
    expect(operator).toContain('Bad example: stop-first / failed reclaim');
    expect(operator).toContain('Open full visual review with all cases');
    expect(operator).toContain('/api/research/ladder-reclaim-watchlist?instrument=ES');
  });

  it('serves only manifest-approved image paths under artifacts/review', () => {
    const image = path.join(ROOT, 'artifacts', 'review', 'unit-ok.png');
    const readJsonFn = fixtureReader({
      'ladder-reclaim-case-image-manifest.json': {
        positive: [{ png: image }],
        negative: [{ png: path.join(ROOT, 'state', 'not-allowed.png') }],
      },
    });
    const exists = fs.existsSync;
    const spy = vi.spyOn(fs, 'existsSync').mockImplementation(file => file === image || exists.call(fs, file));
    try {
      expect(getLadderReclaimCaseImagePath({ kind: 'positive', index: 0, readJsonFn })).toBe(image);
      expect(getLadderReclaimCaseImagePath({ kind: 'negative', index: 0, readJsonFn })).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
