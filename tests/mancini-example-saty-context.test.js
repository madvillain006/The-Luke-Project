import { describe, it, expect } from 'vitest';
import satyContext from '../scripts/research-mancini-fbd-example-saty-context.js';

const {
  proofTimestamp,
  satySessionTimestamp,
  isTimestampInsideWindow,
  referenceCompleteness,
  referenceCompletenessUsableForSaty,
  normalizedSatyError,
  strictSatyValidityFailures,
  asNumber,
  strongestPacketLabel,
} = satyContext._internal;

describe('Mancini example SATY context helpers', () => {
  it('uses the earliest real trap/reclaim event as the proof timestamp', () => {
    const quick = {
      source_timestamp_et: '2026-03-17T18:00:00-04:00',
      trap_candle_timestamp_et: '2026-03-17T17:48:00-04:00',
      first_reclaim_close_timestamp_et: '2026-03-17T18:00:00-04:00',
    };

    expect(proofTimestamp(quick, {}).value).toBe('2026-03-17T17:48:00-04:00');
    expect(proofTimestamp(quick, {}).source).toBe('quick.trap_candle_timestamp_et');
  });

  it('anchors SATY to the first in-session event and skips maintenance-gap timestamps', () => {
    const quick = {
      source_timestamp_et: '2026-03-17T18:00:00-04:00',
      trap_candle_timestamp_et: '2026-03-17T17:48:00-04:00',
      first_reclaim_close_timestamp_et: '2026-03-17T18:00:00-04:00',
    };

    expect(satySessionTimestamp(quick, {}).value).toBe('2026-03-17T18:00:00-04:00');
    expect(satySessionTimestamp(quick, {}).source).toBe('quick.first_reclaim_close_timestamp_et');
  });

  it('uses a plan-date fallback when all available event timestamps are in maintenance', () => {
    const quick = {
      source_timestamp_et: '2026-04-21T17:53:00-04:00',
      trap_candle_timestamp_et: '2026-04-21T17:53:00-04:00',
      first_reclaim_close_timestamp_et: '2026-04-21T17:56:00-04:00',
    };

    expect(satySessionTimestamp(quick, {}).value).toBe('');
    expect(satySessionTimestamp(quick, {}).source).toBe('maintenance_gap_plan_date_fallback');
  });

  it('compares SATY validity windows with ET offsets applied', () => {
    expect(isTimestampInsideWindow(
      '2026-03-17T18:00:00-04:00',
      '2026-03-17T18:00:00',
      '2026-03-18T17:00:00',
    )).toBe(true);
    expect(isTimestampInsideWindow(
      '2026-03-17T17:59:00-04:00',
      '2026-03-17T18:00:00',
      '2026-03-18T17:00:00',
    )).toBe(false);
  });

  it('does not collapse duplicate packet labels into false positives', () => {
    const label = strongestPacketLabel([
      { source_label_status: 'source_planned_fbd', source_planned_fbd: true, source_confidence_score: 0.65 },
      { source_label_status: 'data_only', data_only: true, source_confidence_score: 0.4 },
    ]);

    expect(label.source_context_classification).toBe('source_planned_fbd');
    expect(label.training_rows_joined).toBe(2);
    expect(label.source_confidence_score).toBe(0.65);
  });

  it('labels 15:59 local close convention separately from full 16:59 coverage', () => {
    expect(referenceCompleteness({
      session_close: '2026-05-06T15:59:00-04:00',
      bar_count: 1320,
    })).toBe('local_full_to_1559_close_convention');
    expect(referenceCompleteness({
      session_close: '2026-05-06T16:59:00-04:00',
      bar_count: 1380,
    })).toBe('full_to_1659_before_maintenance');
  });

  it('fails partial reference sessions closed for SATY-valid derivations', () => {
    expect(referenceCompletenessUsableForSaty('partial_reference_session')).toBe(false);
    expect(referenceCompletenessUsableForSaty('local_full_to_1559_close_convention')).toBe(true);
    const failures = strictSatyValidityFailures({
      satyRow: { valid: true },
      referenceStatus: 'partial_reference_session',
      hasSatyAnchor: true,
      satyAnchorInsideFuturesSession: true,
      satyAnchorTimestampInsideSatyWindow: true,
      referenceBeforeTarget: true,
      referenceFieldIsClose: true,
      exampleMapsToTarget: true,
      referenceCloseBeforeValidFrom: true,
      closeMatches: true,
    });

    expect(failures).toContain('unusable_reference_partial_reference_session');
  });

  it('fails maintenance fallback rows closed for SATY timing context', () => {
    const failures = strictSatyValidityFailures({
      satyRow: { valid: true },
      referenceStatus: 'local_full_to_1559_close_convention',
      hasSatyAnchor: false,
      satyAnchorInsideFuturesSession: false,
      satyAnchorTimestampInsideSatyWindow: false,
      referenceBeforeTarget: true,
      referenceFieldIsClose: true,
      exampleMapsToTarget: true,
      referenceCloseBeforeValidFrom: true,
      closeMatches: true,
    });

    expect(failures).toContain('missing_in_session_saty_anchor');
  });

  it('normalizes SATY derivation errors to stable reject keys', () => {
    expect(normalizedSatyError({
      valid: false,
      error: 'Need at least 15 ES futures sessions to derive Saty ATR',
    })).toBe('insufficient_prior_sessions_for_atr14');
  });

  it('treats blank numeric CSV cells as missing rather than zero', () => {
    expect(asNumber('')).toBeNull();
    expect(asNumber('   ')).toBeNull();
    expect(asNumber(null)).toBeNull();
    expect(asNumber('0')).toBe(0);
  });
});
