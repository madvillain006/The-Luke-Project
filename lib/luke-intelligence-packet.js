'use strict';

const defaultPaths = require('./paths');
const { buildRadarBrief } = require('./brain/radar-layer');
const { buildCompanionContext } = require('./companion-memory');
const { buildContextBinPrompt } = require('./luke-context-bins');
const { getContextSummary } = require('./reference-repo-registry');

const DEFAULT_MAX_CHARS = 1200;

function buildIntelligencePacket(options = {}) {
  const paths = options.paths || defaultPaths;
  const maxChars = Number(options.maxChars || DEFAULT_MAX_CHARS);
  const surface = options.surface || null;

  const sections = [];

  // Section 1 (highest priority): Radar brief
  try {
    const brief = buildRadarBrief({ paths, now: options.now });
    if (brief && brief.ok) {
      const lines = ['--- Radar ---'];
      if (brief.summary_line) lines.push(brief.summary_line);
      for (const idea of (brief.ideas_to_verify || []).slice(0, 3)) {
        const meta = [
          idea.scope ? `scope=${idea.scope}` : null,
          idea.status ? `status=${idea.status}` : null,
          idea.recall_reason ? `why=${idea.recall_reason}` : null,
          idea.review_only ? 'review_only' : null,
        ].filter(Boolean);
        lines.push(`- [${idea.review_state || 'new'}] ${idea.title || idea.raw_text_preview || ''}${meta.length ? ` (${meta.join('; ')})` : ''}`);
      }
      sections.push(lines.join('\n'));
    }
  } catch {}

  // Section 2: Companion memory context
  try {
    const ctx = buildCompanionContext({ surface: surface || 'system' }, { paths });
    if (ctx && ctx.trim()) sections.push(`--- Memory ---\n${ctx.trim()}`);
  } catch {}

  // Section 3: Context bins
  try {
    const bins = buildContextBinPrompt({}, { paths });
    if (bins && bins.trim()) sections.push(`--- Context ---\n${bins.trim()}`);
  } catch {}

  // Section 4 (lowest priority, skip on trading surface): Reference registry summary
  if (surface !== 'trading') {
    try {
      const summary = getContextSummary();
      if (summary && summary.trim()) sections.push(`--- Refs ---\n${summary.trim()}`);
    } catch {}
  }

  // Drop entire sections from lowest priority until within budget
  while (sections.length > 1) {
    const joined = sections.join('\n\n');
    if (joined.length <= maxChars) break;
    sections.pop();
  }

  const packet = sections.join('\n\n');
  if (!packet.trim()) return '--- Luke intelligence: no context available ---';
  return packet.length <= maxChars ? packet : packet.slice(0, maxChars - 3) + '...';
}

module.exports = { buildIntelligencePacket };
