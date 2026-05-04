'use strict';

function timeBucket(timestamp) {
  const m = String(timestamp || '').match(/T(\d{2}):(\d{2})/);
  if (!m) return 'unknown';
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes < 10 * 60) return 'open_0930_1000';
  if (minutes < 11 * 60 + 30) return 'morning_1000_1130';
  if (minutes < 13 * 60 + 30) return 'midday_1130_1330';
  if (minutes < 15 * 60) return 'afternoon_1330_1500';
  return 'late_1500_1600';
}

function breakdownBucket(depth) {
  if (!Number.isFinite(depth)) return 'unknown';
  if (depth < 3) return '2_to_3';
  if (depth < 5) return '3_to_5';
  if (depth < 10) return '5_to_10';
  return '10_plus';
}

function reclaimBucket(minutes) {
  if (!Number.isFinite(minutes)) return 'no_reclaim';
  if (minutes <= 3) return '0_to_3';
  if (minutes <= 5) return '3_to_5';
  if (minutes <= 10) return '5_to_10';
  if (minutes <= 15) return '10_to_15';
  return 'late';
}

function sourceCombo(sources) {
  return [...new Set(sources || [])].filter(Boolean).sort().join('+') || 'unknown';
}

function sourceFlags(sources) {
  const set = new Set(sources || []);
  return {
    bobby_confirmed: set.has('bobby'),
    gex_confirmed: set.has('gex') || set.has('heatseeker'),
    dubz_aligned: set.has('dubz'),
    saty_confirmed: set.has('saty'),
    mancini_confirmed: set.has('mancini'),
    katbot_present: set.has('katbot'),
  };
}

function insideChop(candidate) {
  return Boolean(candidate.level?.sources?.some(source =>
    source.source === 'mancini' && /chop/i.test(source.role || source.label || '')
  ));
}

module.exports = {
  timeBucket,
  breakdownBucket,
  reclaimBucket,
  sourceCombo,
  sourceFlags,
  insideChop,
};
