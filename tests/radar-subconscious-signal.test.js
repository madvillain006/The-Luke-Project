'use strict';

const {
  SubconsciousSignalValidationError,
  mapSubconsciousSignalToRadarInput,
  normalizeSubconsciousSignal,
  validateSubconsciousSignal,
} = require('../lib/radar/subconscious-signal');

function validSignal(overrides = {}) {
  return {
    slug: 'import-lock-watcher',
    title: 'Import lock watcher',
    raw_text: 'A tiny watcher that flags imports outside approved reference boundaries.',
    source: {
      agent: 'subconscious',
      mode: 'drift-from-research',
      source_label: 'luke-subconscious',
    },
    signal_types: ['return', 'evidence'],
    score: 6,
    positive_walk_count: 3,
    cooldown_state: 'clear',
    lock_state: 'none',
    status: 'ready_for_main_review',
    non_goals: ['do not create Coder jobs', 'do not write runtime state'],
    forbidden_surfaces: ['trading', 'pine', 'ninjatrader', 'broker', 'risk', 'credentials', 'runtime-state'],
    review_only: true,
    recall_reason: 'subconscious_signal_review_lane',
    created_at: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('review-only Subconscious signal schema', () => {
  it('normalizes a valid review-only signal and maps it to Radar reference_idea shape', () => {
    const signal = normalizeSubconsciousSignal(validSignal());
    const radar = mapSubconsciousSignalToRadarInput(signal);

    expect(signal).toEqual(expect.objectContaining({
      kind: 'subconscious_signal',
      slug: 'import-lock-watcher',
      signal_types: ['return', 'evidence'],
      score: 6,
      positive_walk_count: 3,
      cooldown_state: 'clear',
      lock_state: 'none',
      status: 'ready_for_main_review',
      review_only: true,
      requires_main_approval: true,
      trading_authority: 'none',
      creates_coder_job: false,
      creates_schedule: false,
      writes_runtime_state: false,
    }));
    expect(radar).toEqual(expect.objectContaining({
      source_type: 'reference_idea',
      source_label: 'luke-subconscious',
      scope: 'subconscious_review',
      status: 'review_only',
      review_only: true,
      trading_authority: 'none',
      recall_reason: 'subconscious_signal_review_lane',
      _does_not_write_state: true,
    }));
    expect(radar.text).toContain('[SUBCONSCIOUS_PROPOSAL: import-lock-watcher]');
    expect(radar.text).toContain('score: 6');
    expect(radar.text).toContain('forbidden_surfaces: trading, pine, ninjatrader, broker, risk, credentials, runtime-state');
    expect(radar.relationship_ids).toContain('subconscious:import-lock-watcher');
  });

  it('fails explicitly when a required field is missing', () => {
    const input = validSignal({ slug: '' });
    expect(() => normalizeSubconsciousSignal(input)).toThrow(SubconsciousSignalValidationError);

    const result = validateSubconsciousSignal(input);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'slug' }),
    ]));
  });

  it('fails explicitly when score is malformed', () => {
    expect(() => normalizeSubconsciousSignal(validSignal({ score: 'hot' })))
      .toThrow(/score must be numeric/);
  });

  it('fails explicitly when score is out of range', () => {
    expect(() => normalizeSubconsciousSignal(validSignal({ score: 11 })))
      .toThrow(/score must be between 0 and 10/);
  });

  it('fails explicitly when signal types are empty', () => {
    expect(() => normalizeSubconsciousSignal(validSignal({ signal_types: [] })))
      .toThrow(/signal_types must not be empty/);
  });

  it('blocks no-touch trading, Pine, Ninja, broker, risk, credential, and execution targets', () => {
    const signal = normalizeSubconsciousSignal(validSignal({
      slug: 'unsafe-router',
      raw_text: 'Tune Pine and NinjaTrader broker execution risk checks using a credential token.',
      status: 'ready_for_main_review',
      target_paths: [
        'trading/router.js',
        'tradingview/strategy.pine',
        'ninjatrader/LukeNativeShadowStrategy.cs',
        'state/events/radar-ingest.jsonl',
      ],
    }));

    expect(signal.status).toBe('blocked');
    expect(signal.requested_status).toBe('ready_for_main_review');
    expect(signal.blocked_surfaces).toEqual(expect.arrayContaining([
      'trading',
      'pine',
      'ninjatrader',
      'broker',
      'risk',
      'credentials',
      'execution',
      'runtime-state',
    ]));
    expect(signal.blocked_reason).toBe('protected_surface_requires_explicit_named_approval');
    expect(signal.creates_coder_job).toBe(false);
  });

  it('does not create an approved or active job from a high score', () => {
    const signal = normalizeSubconsciousSignal(validSignal({
      score: 10,
      positive_walk_count: 99,
      signal_types: ['commit', 'friction', 'excitement', 'reuse', 'mention', 'return', 'evidence'],
      status: 'watching',
    }));

    expect(signal.status).toBe('watching');
    expect(signal.creates_coder_job).toBe(false);
    expect(signal.requires_main_approval).toBe(true);
    expect(signal.approval.main_approval_required).toBe(true);
  });

  it('fails explicitly when status is invalid', () => {
    expect(() => normalizeSubconsciousSignal(validSignal({ status: 'ready_to_build' })))
      .toThrow(/status must be one of/);
  });

  it('preserves forbidden surfaces instead of silently dropping them', () => {
    const forbiddenSurfaces = ['trading', 'pine', 'ninjatrader', 'broker', 'credentials', 'risk', 'runtime-state', 'custom-surface'];
    const signal = normalizeSubconsciousSignal(validSignal({ forbidden_surfaces: forbiddenSurfaces }));

    expect(signal.forbidden_surfaces).toEqual(forbiddenSurfaces);
    expect(mapSubconsciousSignalToRadarInput(signal).text)
      .toContain('forbidden_surfaces: trading, pine, ninjatrader, broker, credentials, risk, runtime-state, custom-surface');
  });

  it('fails explicitly when review_only is false', () => {
    expect(() => normalizeSubconsciousSignal(validSignal({ review_only: false })))
      .toThrow(/review_only must be true/);
  });

  it('normalizes the existing proposal document shape without adding runtime writes', () => {
    const signal = normalizeSubconsciousSignal({
      slug: 'room-window',
      title: 'Room Window',
      text: 'A local status view for the room.',
      source: {
        agent: 'subconscious',
        mode: 'continue-project',
        source_label: 'luke-subconscious',
      },
      signals: {
        types: ['reuse', 'return'],
        score: 5,
        positive_walk_count: 2,
        cooldown_state: 'clear',
        lock_state: 'none',
      },
      review: {
        status: 'review_only',
        review_only: true,
      },
      boundaries: {
        non_goals: ['no dashboard wiring yet'],
        forbidden_surfaces: ['trading', 'state/events', 'state/snapshots'],
      },
      radar_mapping: {
        recall_reason: 'subconscious_signal_review_lane',
      },
    }, { now: new Date('2026-05-10T13:00:00.000Z') });

    expect(signal.status).toBe('watching');
    expect(signal.created_at).toBe('2026-05-10T13:00:00.000Z');
    expect(signal.writes_runtime_state).toBe(false);
  });
});
