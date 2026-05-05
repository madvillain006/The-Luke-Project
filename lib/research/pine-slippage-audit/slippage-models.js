'use strict';

const SLIPPAGE_MODE_NAMES = Object.freeze([
  'none',
  'entry_only_0_25',
  'exit_only_0_25',
  'both_sides_0_25_each',
  'round_trip_0_50',
  'round_trip_1_00',
  'custom_points',
]);

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function slippageModel(mode = 'both_sides_0_25_each', customPoints = 0.25) {
  const name = String(mode || 'both_sides_0_25_each');
  if (name === 'none') {
    return { mode: name, entry: 0, targetExit: 0, stopExit: 0, roundTrip: 0 };
  }
  if (name === 'entry_only_0_25') {
    return { mode: name, entry: 0.25, targetExit: 0, stopExit: 0, roundTrip: 0.25 };
  }
  if (name === 'exit_only_0_25') {
    return { mode: name, entry: 0, targetExit: 0.25, stopExit: 0.25, roundTrip: 0.25 };
  }
  if (name === 'round_trip_1_00') {
    return { mode: name, entry: 0.5, targetExit: 0.5, stopExit: 0.5, roundTrip: 1 };
  }
  if (name === 'custom_points') {
    const points = Number.isFinite(Number(customPoints)) ? Number(customPoints) : 0.25;
    return { mode: name, entry: points, targetExit: points, stopExit: points, roundTrip: rounded(points * 2) };
  }
  return { mode: name, entry: 0.25, targetExit: 0.25, stopExit: 0.25, roundTrip: 0.5 };
}

function roundTripSlippageModel(roundTripPoints) {
  const roundTrip = Math.max(0, Number(roundTripPoints) || 0);
  const side = roundTrip / 2;
  return {
    mode: `round_trip_${String(roundTrip).replace('.', '_')}`,
    entry: side,
    targetExit: side,
    stopExit: side,
    roundTrip: rounded(roundTrip),
  };
}

function applyLongSlippage(plan, model) {
  const selected = model || slippageModel(plan?.slippage_mode);
  const rawEntry = Number(plan.raw_entry);
  const rawStop = Number(plan.raw_stop);
  const rawTp1 = Number(plan.raw_tp1);
  return {
    ...plan,
    slippage_model: selected,
    entry_effective: rounded(rawEntry + selected.entry),
    stop_effective: rounded(rawStop - selected.stopExit),
    tp1_effective: rounded(rawTp1 - selected.targetExit),
  };
}

module.exports = {
  SLIPPAGE_MODE_NAMES,
  rounded,
  slippageModel,
  roundTripSlippageModel,
  applyLongSlippage,
};
