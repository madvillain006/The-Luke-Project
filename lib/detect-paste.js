'use strict';

const DISCORD_PREFIX = /^[\s\S]*?(?:\[\d{1,2}:\d{2}\s*(?:AM|PM)\][^\n,]*,\s*:|[^\n]+ — Today at \d{1,2}:\d{2}\s*(?:AM|PM)\s*\n?)/i;

const ANALYST_RULES = [
  { re: /\b(ximes|ximestrades|xi[mn]es|followthewhiterabblt|kanabis16)\b/i, command: '/alert', analyst: 'ximes' },
  { re: /\b(bobby|followtherabbit|spx[_ -]?coms)\b/i,             command: '/heatmap', analyst: 'bobby' },
  { re: /\b(richy|richydubz|richyd)\b/i,                          command: '/levels',  analyst: 'richy' },
];

const OPTION_PATTERN   = /\b[A-Z]{1,5}\s+\d{3,5}[CP]\b/i;
const HEATMAP_PATTERN  = /\b(king node|air pocket|trinity)\b/i;

function stripDiscordPrefix(text) {
  return text.replace(DISCORD_PREFIX, '').trimStart();
}

function detectPasteIntent(text, hasImage) {
  if (hasImage) {
    return { command: '/heatmap', cleanedText: text, detectedAnalyst: 'bobby' };
  }

  const sample = text.slice(0, 200);

  for (const rule of ANALYST_RULES) {
    if (rule.re.test(sample)) {
      return { command: rule.command, cleanedText: stripDiscordPrefix(text), detectedAnalyst: rule.analyst };
    }
  }

  if (OPTION_PATTERN.test(sample)) {
    return { command: '/alert', cleanedText: stripDiscordPrefix(text), detectedAnalyst: null };
  }
  if (HEATMAP_PATTERN.test(sample)) {
    return { command: '/heatmap', cleanedText: stripDiscordPrefix(text), detectedAnalyst: null };
  }

  return { command: null, cleanedText: text, detectedAnalyst: null };
}

module.exports = { detectPasteIntent };
