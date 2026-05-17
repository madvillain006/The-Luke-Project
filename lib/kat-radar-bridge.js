'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function compactText(value, max = 900) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function normalizeList(values, max = 12) {
  return [...new Set((values || [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
    .slice(0, max);
}

function relationshipIdsForEntry(entry = {}, signal = null) {
  return normalizeList([
    entry.username ? `kat:${entry.username}` : null,
    entry.channel_name ? `kat-channel:${entry.channel_name}` : null,
    entry.message_id ? `kat-message:${entry.message_id}` : null,
    signal && signal.ticker ? `symbol:${signal.ticker}` : null,
  ]);
}

function attachmentLines(entry = {}) {
  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  if (!attachments.length) return ['Attachments: none'];
  return [
    `Attachments: ${attachments.length}`,
    ...attachments.slice(0, 3).map(att => `- ${att.filename || att.name || att.id || 'attachment'} ${att.url || ''}`.trim()),
  ];
}

function signalLines(signal) {
  if (!signal) return ['Parsed signal: none yet'];
  return [
    `Parsed signal: ${signal.signal_type || 'unknown'}`,
    `Ticker: ${signal.ticker || 'unknown'}`,
    `Bias: ${signal.bias || 'unknown'}`,
    `Timeframe: ${signal.timeframe || 'unknown'}`,
    `Levels: ${Array.isArray(signal.levels) && signal.levels.length ? signal.levels.join(', ') : 'none'}`,
    signal.pattern ? `Pattern: ${signal.pattern}` : null,
  ].filter(Boolean);
}

function buildKatAnalystRadarIngest(entry = {}, signal = null) {
  const content = compactText(entry.content || signal?.raw || '', 1600);
  const hasAttachments = Array.isArray(entry.attachments) && entry.attachments.length > 0;
  if (!content && !hasAttachments && !signal) return null;

  const ticker = signal && signal.ticker ? String(signal.ticker).toUpperCase() : null;
  const titleParts = ['Katbot analyst capture', entry.username || 'unknown'];
  if (ticker) titleParts.push(ticker);
  if (signal && signal.bias && signal.bias !== 'NEUTRAL') titleParts.push(signal.bias);

  const text = [
    'Katbot monitored analyst capture for Radar/confluence brain dump.',
    'Review-only. No execution authority. Human gate required.',
    '',
    `Analyst: ${entry.username || signal?.analyst || 'unknown'}`,
    `Channel: ${entry.channel_name || 'unknown'}`,
    `Message ID: ${entry.message_id || 'unknown'}`,
    `Timestamp: ${entry.ts || 'unknown'}`,
    ...signalLines(signal),
    ...attachmentLines(entry),
    content ? `Raw analyst text: ${content}` : 'Raw analyst text: none',
  ].filter(Boolean).join('\n');

  const firstAttachment = hasAttachments ? entry.attachments.find(att => att && att.url) : null;
  return {
    source_label: 'katbot-analyst-feed',
    source_type: 'katbot_paste',
    title: titleParts.join(' - '),
    text,
    source_url: firstAttachment ? firstAttachment.url : null,
    relationship_ids: relationshipIdsForEntry(entry, signal),
    scope: 'katbot_analyst_feed',
    status: 'review_only',
    recall_reason: 'katbot_monitored_analyst_capture_for_confluence_brain_dump',
    review_only: true,
    human_gate: 'required',
    trading_authority: 'none',
    execution_routes: [],
  };
}

function buildKatVisionRadarIngest(record = {}, processed = null) {
  if (!record || !record.vision_id) return null;
  const levels = Array.isArray(record.levels) ? record.levels : [];
  const text = [
    'Katbot analyst image/vision parse for Radar/confluence brain dump.',
    'Review-only. No execution authority. Human gate required.',
    '',
    `Vision ID: ${record.vision_id}`,
    `Analyst: ${record.analyst || 'unknown'}`,
    `Channel: ${record.channel || 'unknown'}`,
    `Message ID: ${record.message_id || 'unknown'}`,
    `Attachment ID: ${record.attachment_id || 'unknown'}`,
    `Timestamp: ${record.ts || record.parsed_at || 'unknown'}`,
    `Chart type: ${record.chart_type || 'unknown'}`,
    `Ticker: ${record.ticker || processed?.ticker || 'unknown'}`,
    `Bias: ${record.bias || processed?.bias || 'unknown'}`,
    `Levels: ${levels.length ? levels.join(', ') : 'none'}`,
    record.notes ? `Vision notes: ${compactText(record.notes, 600)}` : null,
    record.raw_text ? `Original post text: ${compactText(record.raw_text, 1200)}` : null,
    record.attachment && record.attachment.url ? `Image evidence: ${record.attachment.url}` : null,
  ].filter(Boolean).join('\n');

  return {
    source_label: 'katbot-vision-feed',
    source_type: 'katbot_paste',
    title: ['Katbot vision parse', record.analyst, record.ticker, record.bias].filter(Boolean).join(' - '),
    text,
    source_url: record.attachment && record.attachment.url ? record.attachment.url : null,
    relationship_ids: normalizeList([
      record.analyst ? `kat:${record.analyst}` : null,
      record.channel ? `kat-channel:${record.channel}` : null,
      record.message_id ? `kat-message:${record.message_id}` : null,
      record.vision_id,
      record.ticker ? `symbol:${record.ticker}` : null,
    ]),
    scope: 'katbot_vision_confluence',
    status: 'review_only',
    recall_reason: 'katbot_analyst_image_parse_for_confluence_brain_dump',
    review_only: true,
    human_gate: 'required',
    trading_authority: 'none',
    execution_routes: [],
  };
}


function slugify(value, fallback = 'katbot-capture') {
  const slug = String(value || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || fallback;
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addHoursIso(value, hours) {
  const base = value ? new Date(value) : new Date();
  const ms = Number.isFinite(base.getTime()) ? base.getTime() : Date.now();
  return new Date(ms + hours * 60 * 60 * 1000).toISOString();
}

function windowsish(filePath) {
  return String(filePath || '').replace(/\//g, '\\');
}

function resolveRollingRadarPaths(options = {}) {
  const home = options.home || process.env.USERPROFILE || os.homedir();
  const brainTradingRoot = options.brainTradingRoot || process.env.LUKE_RADAR_BRAIN_TRADING_ROOT || path.join(home, 'brain', 'trading');
  const handoffRoot = options.handoffRoot || process.env.LUKE_RADAR_HANDOFF_ROOT || path.join(home, 'OneDrive', 'Documents', 'LukeSync', 'handoff', 'market-captures');
  return {
    brainTradingRoot,
    sourcesDir: options.sourcesDir || path.join(brainTradingRoot, 'sources', 'katbot'),
    cardsDir: options.cardsDir || path.join(brainTradingRoot, 'radar-cards'),
    handoffIndex: options.handoffIndex || path.join(handoffRoot, 'radar', 'INDEX.md'),
  };
}

function sourceNoteMarkdown(payload = {}, item = {}, nowIso = new Date().toISOString()) {
  const title = payload.title || 'Katbot analyst capture';
  return [
    '---',
    'type: trading/source',
    'schema_version: 0.1',
    'status: active',
    'review_only: true',
    'execution_authority: none',
    'human_gate: required',
    'source_systems: [katbot, discord, luke-radar]',
    `created: ${nowIso}`,
    `updated: ${nowIso}`,
    `source_type: ${payload.source_type || 'katbot_paste'}`,
    `source_label: ${payload.source_label || 'katbot'}`,
    `radar_item_id: ${item.id || ''}`,
    'tags: [trading/review-only, trading/source, katbot, discord]',
    '---',
    '',
    `# ${title}`,
    '',
    '## Compiled truth',
    'Katbot captured this from the monitored Discord analyst feed. This is review-only confluence/context, not a trade instruction.',
    '',
    '## Source payload',
    '```text',
    compactText(payload.text || payload.source_url || '', 5000),
    '```',
    '',
    '## Safety',
    '- review_only: true',
    '- execution_authority: none',
    '- human_gate: required',
    '- execution_routes: []',
    '',
    '## Links',
    payload.source_url ? `- Source URL: ${payload.source_url}` : '- Source URL: none',
    item.id ? `- Luke Radar item: ${item.id}` : '- Luke Radar item: not recorded',
    '',
  ].join('\n');
}

function radarCardMarkdown({ date, nowIso, expiresIso, sourceNotePath, payload, item }) {
  const thesisId = `katbot-analyst-feed-${date}`;
  return [
    '---',
    'type: trading/radar-card',
    'schema_version: 0.1',
    'status: active',
    'review_only: true',
    'execution_authority: none',
    'human_gate: required',
    'source_systems: [katbot, discord, luke-radar]',
    'source_refs:',
    `  - ${windowsish(sourceNotePath)}`,
    `created: ${nowIso}`,
    `updated: ${nowIso}`,
    'symbols: []',
    'markets: [futures, equities, macro]',
    'confidence: unknown',
    'review_priority: medium',
    'risk_note: "Informational only; not trade instruction."',
    'tags: [trading/review-only, trading/radar-card, katbot, discord]',
    `thesis_id: ${thesisId}`,
    'thesis_state: open',
    `opened_at: ${nowIso}`,
    `expires_at: ${expiresIso}`,
    'close_reason:',
    'invalidated_by:',
    'supersedes:',
    'superseded_by:',
    'timeframe: rolling-session',
    'setup_family: analyst-feed-confluence',
    'direction: unknown',
    '---',
    '',
    `# Katbot analyst feed rolling inbox — ${date}`,
    '',
    '## Compiled truth',
    'Rolling review-only brain dump of Katbot monitored Discord analyst captures for this session/day. Use this to notice repeated themes, confluence, contradictions, and analyst drift. Do not treat any item here as execution authority.',
    '',
    '## Human review question or current disposition',
    '- **State:** Open',
    '- **Question:** Are multiple independent analyst captures converging on the same market theme, level, or risk?',
    '',
    '## Current levels / thesis markers',
    '- Derived from appended evidence below; verify manually against live tape before action.',
    '',
    '## Evidence captures',
    `- ${nowIso} — ${payload.title || 'Katbot capture'} (${item.id || 'no Radar ID'})`,
    `  - Source note: ${windowsish(sourceNotePath)}`,
    '',
    '## Links',
    `- Latest source note: ${windowsish(sourceNotePath)}`,
    '',
    '---',
    '',
    '## Timeline',
    `- ${nowIso} — Opened/updated from Katbot monitored Discord analyst capture. Radar item: ${item.id || 'not recorded'}.`,
    '',
  ].join('\n');
}

function updateExistingRadarCard(content, { nowIso, sourceNotePath, payload, item }) {
  let next = content.replace(/^updated: .*$/m, `updated: ${nowIso}`);
  const refLine = `  - ${windowsish(sourceNotePath)}`;
  if (!next.includes(refLine)) {
    next = next.replace(/source_refs:\n/, `source_refs:\n${refLine}\n`);
  }
  const evidenceLine = `- ${nowIso} — ${payload.title || 'Katbot capture'} (${item.id || 'no Radar ID'})`;
  if (!next.includes(evidenceLine)) {
    next = next.replace(/## Evidence captures\n/, `## Evidence captures\n${evidenceLine}\n  - Source note: ${windowsish(sourceNotePath)}\n`);
  }
  const timelineLine = `- ${nowIso} — Appended Katbot monitored Discord analyst capture. Radar item: ${item.id || 'not recorded'}.`;
  if (!next.includes(timelineLine)) {
    next = next.replace(/## Timeline\n/, `## Timeline\n${timelineLine}\n`);
  }
  return next;
}

function updateHandoffIndex(indexPath, { date, cardPath, sourceNotePath, expiresIso }) {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const header = [
    '# Rolling Radar Index',
    '',
    'This is the handoff-facing mirror of open market radar items being captured from screenshots, notes, Katbot Discord analyst scrapes, and other source material.',
    '',
    '## Open items',
  ].join('\n');
  let content = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : `${header}\n\n## Workflow\n- New screenshot/Katbot capture comes in\n- Hermes/Luke extracts the useful thesis or appends evidence\n- Card stays open until expiry, invalidation, supersession, or manual close\n`;
  const bullet = `- Katbot analyst feed rolling inbox — ${date}`;
  if (content.includes(bullet)) return { updated: false, path: indexPath };
  const block = [
    bullet,
    `  - Brain note: \`${windowsish(cardPath)}\``,
    `  - Source: \`${windowsish(sourceNotePath)}\``,
    '  - Status: active',
    `  - Expiry: ${expiresIso}`,
  ].join('\n');
  if (content.includes('## Workflow')) {
    content = content.replace(/\n## Workflow/, `\n${block}\n\n## Workflow`);
  } else {
    content = `${content.trimEnd()}\n${block}\n`;
  }
  fs.writeFileSync(indexPath, content, 'utf8');
  return { updated: true, path: indexPath };
}

function mirrorKatPayloadToRollingRadar(payload = {}, ingestResult = {}, options = {}) {
  if (options.enabled === false || /^(1|true|yes)$/i.test(String(process.env.LUKE_KAT_RADAR_MIRROR_DISABLED || ''))) {
    return { ok: true, skipped: true, reason: 'disabled' };
  }
  const item = ingestResult.item || {};
  const nowIso = (options.now || item.ts || new Date().toISOString());
  const date = isoDate(nowIso);
  const paths = resolveRollingRadarPaths(options);
  fs.mkdirSync(paths.sourcesDir, { recursive: true });
  fs.mkdirSync(paths.cardsDir, { recursive: true });

  const sourceSlug = slugify(`${date}-${payload.title || item.id || payload.source_label || 'katbot-capture'}`);
  const sourceNotePath = path.join(paths.sourcesDir, `${sourceSlug}.md`);
  if (!fs.existsSync(sourceNotePath)) {
    fs.writeFileSync(sourceNotePath, sourceNoteMarkdown(payload, item, nowIso), 'utf8');
  }

  const cardPath = path.join(paths.cardsDir, `${date}-katbot-analyst-feed.md`);
  const expiresIso = options.expiresAt || addHoursIso(`${date}T23:59:00.000Z`, 36);
  if (fs.existsSync(cardPath)) {
    const current = fs.readFileSync(cardPath, 'utf8');
    fs.writeFileSync(cardPath, updateExistingRadarCard(current, { nowIso, sourceNotePath, payload, item }), 'utf8');
  } else {
    fs.writeFileSync(cardPath, radarCardMarkdown({ date, nowIso, expiresIso, sourceNotePath, payload, item }), 'utf8');
  }

  const indexResult = updateHandoffIndex(paths.handoffIndex, { date, cardPath, sourceNotePath, expiresIso });
  return {
    ok: true,
    source_note: sourceNotePath,
    radar_card: cardPath,
    handoff_index: paths.handoffIndex,
    index_updated: indexResult.updated,
  };
}

function recordKatRadarIngest(payload, options = {}) {
  if (!payload) return { ok: false, skipped: true, reason: 'empty_payload' };
  const recordRadarIngest = options.recordRadarIngest || require('./radar/ingest').recordRadarIngest;
  const result = recordRadarIngest(payload, options.recordOptions || {});
  const hasCustomRadarPaths = Boolean(options.recordOptions && options.recordOptions.paths);
  const shouldMirror = options.mirror !== false && (!hasCustomRadarPaths || options.mirrorOptions);
  if (shouldMirror && result && result.ok && !result.duplicate) {
    try {
      result.rolling_radar_mirror = mirrorKatPayloadToRollingRadar(payload, result, options.mirrorOptions || {});
    } catch (error) {
      result.rolling_radar_mirror = { ok: false, error: error.message };
    }
  }
  return result;
}

function recordKatAnalystCapture(entry, signal = null, options = {}) {
  return recordKatRadarIngest(buildKatAnalystRadarIngest(entry, signal), options);
}

function recordKatVisionCapture(record, processed = null, options = {}) {
  return recordKatRadarIngest(buildKatVisionRadarIngest(record, processed), options);
}

module.exports = {
  buildKatAnalystRadarIngest,
  buildKatVisionRadarIngest,
  recordKatRadarIngest,
  recordKatAnalystCapture,
  recordKatVisionCapture,
  mirrorKatPayloadToRollingRadar,
  _internal: {
    compactText,
    normalizeList,
    relationshipIdsForEntry,
    resolveRollingRadarPaths,
    sourceNoteMarkdown,
    radarCardMarkdown,
    updateExistingRadarCard,
    updateHandoffIndex,
  },
};
