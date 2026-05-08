'use strict';

const COMMANDS = [
  'alert',
  'backtest',
  'balance',
  'confluence',
  'dubz',
  'entries',
  'heatmap',
  'history',
  'layout',
  'levels',
  'luke',
  'mancini',
  'ready',
  'reset',
  'review',
  'runner',
  'saty',
  'session',
  'status',
  'trade',
  'trading-mode',
  'verdict',
];

const NATURAL_COMMANDS = new Set([
  'balance',
  'entries',
  'history',
  'ready',
  'review',
  'saty',
  'status',
  'verdict',
]);

const ALIASES = new Map([
  ['bal', 'balance'],
  ['entry', 'entries'],
  ['entrie', 'entries'],
  ['stat', 'status'],
  ['stats', 'status'],
  ['staus', 'status'],
  ['rdy', 'ready'],
  ['satty', 'saty'],
  ['satyr', 'saty'],
  ['heat', 'heatmap'],
  ['heatmaps', 'heatmap'],
  ['mancinni', 'mancini'],
  ['verdit', 'verdict'],
  ['veridct', 'verdict'],
]);

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '');
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function looksLikeNaturalCommand(trimmed, token, surface) {
  if (surface !== 'trading') return false;
  if (!NATURAL_COMMANDS.has(token) && !ALIASES.has(token)) return false;
  if (trimmed.length > 60) return false;
  return !/[?.!,;:]/.test(trimmed);
}

function bestCommand(token) {
  if (!token) return null;
  if (ALIASES.has(token)) return { command: ALIASES.get(token), distance: 0, alias: true };
  if (COMMANDS.includes(token)) return { command: token, distance: 0, alias: false };

  let best = null;
  for (const command of COMMANDS) {
    const distance = editDistance(token, command);
    if (!best || distance < best.distance) best = { command, distance, alias: false };
  }
  const maxDistance = token.length <= 4 ? 1 : 2;
  if (best && best.distance <= maxDistance) return best;
  return null;
}

function recoverLukeCommand(message, options = {}) {
  const original = String(message || '');
  const trimmed = original.trim();
  if (!trimmed) return null;

  const first = trimmed.split(/\s+/)[0];
  const hasSlash = first.startsWith('/');
  const token = normalizeToken(first);
  const surface = options.surface || 'trading';

  if (!hasSlash && !looksLikeNaturalCommand(trimmed, token, surface)) return null;

  const match = bestCommand(token);
  if (!match) return null;
  if (hasSlash && match.command === token && !match.alias) return null;

  const rest = trimmed.slice(first.length).trimStart();
  const commandText = `/${match.command}${rest ? ` ${rest}` : ''}`;
  return {
    original: trimmed,
    command: commandText,
    command_name: match.command,
    recovered: match.command !== token || match.alias || !hasSlash,
    reason: hasSlash ? 'slash-command-typo' : 'natural-command',
    distance: match.distance,
  };
}

module.exports = {
  COMMANDS,
  recoverLukeCommand,
  _internal: {
    editDistance,
    normalizeToken,
    bestCommand,
  },
};
