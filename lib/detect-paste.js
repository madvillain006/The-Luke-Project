'use strict';

const DISCORD_PREFIX = /^[\s\S]*?(?:\[\d{1,2}:\d{2}\s*(?:AM|PM)\][^\n,]*,\s*:|[^\n]+ — Today at \d{1,2}:\d{2}\s*(?:AM|PM)\s*\n?)/i;

const ANALYST_RULES = [
  { re: /\b(katbot|jefe|el\s+jefe|followtherabbit|spx[_ -]?coms|heatmaps?|heatmap-requests|trade-floor|spy-qqq-es-nq-vix)\b/i, command: '/heatmap', analyst: 'katbot' },
  { re: /\b(richy|richydubz|richyd)\b/i,                          command: '/dubz',    analyst: 'richy' },
];

const HEATMAP_PATTERN  = /\b(king node|air pocket|trinity)\b/i;
const HEATMAP_LEVEL_PATTERN = /\b(node|support|resistance|wall|floor|spot|heatmap|spxw|spy|qqq)\b/i;
const PRICE_PATTERN = /\b\d{3,6}(?:\.\d+)?\b/;

function stripDiscordPrefix(text) {
  return text.replace(DISCORD_PREFIX, '').trimStart();
}

function detectPasteIntent(text, hasImage) {
  if (hasImage) {
    return { command: '/heatmap', cleanedText: text, detectedAnalyst: 'katbot' };
  }

  const sample = text.slice(0, 200);
  const hasDiscordPrefix = DISCORD_PREFIX.test(text);

  for (const rule of ANALYST_RULES) {
    if (rule.re.test(sample)) {
      if (rule.command === '/heatmap') {
        const looksLikeHeatmapPaste = hasDiscordPrefix ||
          HEATMAP_PATTERN.test(sample) ||
          (HEATMAP_LEVEL_PATTERN.test(sample) && PRICE_PATTERN.test(sample));
        const explicitHeatmapSource = /\b(heatmaps?|heatmap-requests|spx[_ -]?coms)\b/i.test(sample);
        if (hasDiscordPrefix && !explicitHeatmapSource && !HEATMAP_PATTERN.test(sample) && !(HEATMAP_LEVEL_PATTERN.test(sample) && PRICE_PATTERN.test(sample))) continue;
        if (!looksLikeHeatmapPaste) continue;
      }
      return { command: rule.command, cleanedText: stripDiscordPrefix(text), detectedAnalyst: rule.analyst };
    }
  }

  if (HEATMAP_PATTERN.test(sample)) {
    return { command: '/heatmap', cleanedText: stripDiscordPrefix(text), detectedAnalyst: null };
  }

  return { command: null, cleanedText: text, detectedAnalyst: null };
}

module.exports = { detectPasteIntent };
