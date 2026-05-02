'use strict';

const fs = require('fs');
const { loadSatyLevels, saveSatyLevels, parseSatyText, buildStatusSummary, appendSatyToMemory } = require('./saty-levels');
const { parseManciniText, appendManciniToMemory } = require('./parse-mancini');
const { parseBobby, parseBobbyImage, mergeBobby, appendBobbyToMemory } = require('./parse-bobby');
const { parseDubzText, parseDubzImage, mergeDubzInputs, appendDubzToMemory, loadDubzState, saveDubzState, buildDubzStatus } = require('./parse-dubz');
const {
  attachBobbySource,
  buildBobbyHeatmapSourceId,
  countBobbyNodes,
  findBobbyBySourceId,
} = require('./bobby-heatmap-idempotency');
const { getLivePrice } = require('./live-price');
const { log } = require('./logger');
const { events } = require('./paths');

const BOBBY_CONTEXT_JSONL = events.bobbyContext;
const VISION_RATE_LIMIT_MS = 30 * 1000;

let lastHeatmapVisionCallMs = 0;
let lastDubzVisionCallMs = 0;

async function handleSaty(message, res) {
  if (message.trim() === '/saty') {
    return res.json({ reply: buildStatusSummary(loadSatyLevels()) });
  }

  if (message.startsWith('/saty ')) {
    const satyText = message.slice(6).trim();
    const satyParsed = parseSatyText(satyText);
    if (!satyParsed.valid) {
      return res.json({ reply: `ERROR ${satyParsed.error || 'parse failed'}\n\nFormat: paste 13 levels highest->lowest\n/saty 5920 5910 5900 5890 5880 5870 5860 5850 5840 5830 5820 5810 5800` });
    }
    saveSatyLevels(satyParsed);
    const savedSaty = loadSatyLevels();
    await appendSatyToMemory(savedSaty);
    return res.json({ reply: `SATY LEVELS SAVED\n\n${buildStatusSummary(loadSatyLevels())}\n\nWill appear in /alert as entry refinement.` });
  }
}

async function handleMancini(message, res) {
  if (message.trim() === '/mancini') {
    return res.json({ reply: 'Use /mancini [tweet text]\nExample:\n/mancini Apr 9 8am: 6809 reclaim long trigger, 6819 1st, 6830 2nd. Chop 6793/88 to 6830.' });
  }

  if (message.startsWith('/mancini ')) {
    const rawText = message.slice(9).trim();
    const parsed = parseManciniText(rawText);
    if (parsed.levels.length === 0 && parsed.chop_zones.length === 0) {
      return res.json({ reply: `ERROR No Mancini-format levels found. Paste a plan or update tweet with prices, triggers, targets, or chop. notes: ${parsed.parse_errors.join('; ')}` });
    }

    await appendManciniToMemory(parsed);

    const grouped = new Map();
    for (const level of parsed.levels) {
      const key = level.intent || level.direction || 'other';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(level.price);
    }

    const lines = [`Mancini levels saved (${parsed.instrument} ${parsed.date})`];
    for (const [intent, prices] of grouped) {
      lines.push(`${intent}: ${prices.join(', ')}`);
    }
    for (const zone of parsed.chop_zones) {
      lines.push(`avoid: ${zone.low}-${zone.high} (chop)`);
    }
    if (parsed.parse_errors.length > 0) {
      lines.push(`notes: ${parsed.parse_errors.join('; ')}`);
    }
    return res.json({ reply: lines.join('\n') });
  }
}

async function handleHeatmap(message, res, ctx) {
  if (message.trim() === '/heatmap' && !res._heatmapImage) {
    return res.json({ reply: "HEATMAP Paste Bobby's heatmap text then run:\n/heatmap [paste text here]\n\nOr paste the image directly into chat; vision will parse it automatically." });
  }

  if (message.trim() !== '/heatmap' && !message.startsWith('/heatmap ')) return undefined;

  const today = ctx.todayKeyET();
  const text = message.trim() === '/heatmap' ? '' : message.slice(9).trim();
  const obj = ctx.getLegacyConfluenceState(today);
  const sourceId = buildBobbyHeatmapSourceId({ text, image: res._heatmapImage || null });
  const duplicateBobby = findBobbyBySourceId(obj, sourceId);
  if (duplicateBobby) {
    const duplicateNodeCount = countBobbyNodes(duplicateBobby);
    return res.json({ reply: `Heatmap context updated. ${duplicateNodeCount} nodes found (duplicate ignored).` });
  }

  const textBobby = attachBobbySource(parseBobby(text), sourceId);
  const now = Date.now();
  let visionBobby = null;
  let visionNote = '';

  let visionFailed = false;
  if (res._heatmapImage) {
    if (now - lastHeatmapVisionCallMs < VISION_RATE_LIMIT_MS) {
      const waitSecs = Math.ceil((VISION_RATE_LIMIT_MS - (now - lastHeatmapVisionCallMs)) / 1000);
      visionNote = ` (vision rate-limited, retry in ${waitSecs}s)`;
    } else {
      lastHeatmapVisionCallMs = now;
      try {
        const parseImage = ctx.parseBobbyImage || parseBobbyImage;
        const visionResult = await parseImage(res._heatmapImage);
        if (visionResult && visionResult.parse_status === 'failed') {
          visionFailed = true;
          visionNote = `\n Vision error: ${visionResult.error}`;
        } else if (visionResult) {
          visionBobby = attachBobbySource(visionResult, sourceId);
          visionBobby.date = new Date().toISOString();
          visionBobby.channel = 'bobby-spx-coms';
          visionBobby.vision_parsed = true;
          fs.appendFileSync(BOBBY_CONTEXT_JSONL, JSON.stringify(visionBobby) + '\n');
          log('heatmap-vision', { nodes: visionBobby.king_nodes.length + visionBobby.support.length + visionBobby.resistance.length });
          visionNote = ' + vision parsed';
        } else {
          visionFailed = true;
          visionNote = `\n Vision returned no data`;
        }
      } catch (err) {
        visionFailed = true;
        visionNote = `\n Vision error: ${err.message}`;
      }
    }
  }

  const merged = attachBobbySource(mergeBobby(textBobby, visionBobby), sourceId);
  if (merged) {
    obj.bobby = [...(obj.bobby || []), merged];
    ctx.saveLevels(obj);
    await appendBobbyToMemory(merged);
    const nodeCount = (merged.king_nodes || []).length + (merged.support || []).length + (merged.resistance || []).length;
    const mixedSuccess = visionFailed && textBobby;
    const heatmapPrefix = mixedSuccess ? 'PARTIAL parse: text levels captured, image vision failed\n' : '';
    const tailNote      = mixedSuccess ? visionNote : '';
    const inlineNote    = mixedSuccess ? '' : visionNote;
    return res.json({ reply: `${heatmapPrefix}Heatmap context updated. ${nodeCount} nodes found${inlineNote}.${tailNote}` });
  }
  return res.json({ reply: `${visionFailed && !textBobby ? 'VISION failed. ' : ''}No prices found in heatmap text${visionNote}.` });
}

async function handleDubz(message, res, ctx) {
  if (message.trim() === '/dubz' && !res._dubzImage) {
    return res.json({ reply: buildDubzStatus(loadDubzState()) });
  }

  if (!message.startsWith('/dubz') || (!message.startsWith('/dubz ') && !res._dubzImage)) return undefined;

  const today   = ctx.todayKeyET();
  const rawText = message.startsWith('/dubz ') ? message.slice(6).trim() : null;
  const now     = Date.now();

  // Warm live-price cache before text parsing so bounds are Polygon-grounded.
  // parseDubzImage fetches live prices internally; this ensures text-only pastes
  // also get live bounds rather than falling back to hardcoded PRICE_RANGES.
  const livePrice = await getLivePrice().catch(() => null);

  let textResult = null;
  if (rawText) textResult = parseDubzText(rawText.replace(/\\n/g, '\n'), livePrice);

  let imageResults = [];
  let visionNote   = '';
  let visionFailed = false;
  if (res._dubzImage) {
    if (now - lastDubzVisionCallMs < VISION_RATE_LIMIT_MS) {
      const waitSecs = Math.ceil((VISION_RATE_LIMIT_MS - (now - lastDubzVisionCallMs)) / 1000);
      visionNote = ` (vision rate-limited, retry in ${waitSecs}s)`;
    } else {
      lastDubzVisionCallMs = now;
      try {
        const imgResult = await parseDubzImage(res._dubzImage);
        imageResults = imgResult ? [imgResult] : [];
        if (imgResult?.parse_status === 'failed') {
          visionFailed = true;
          visionNote = `\n Vision error: ${imgResult.error}`;
        } else if (imgResult) {
          visionNote = ` + vision parsed (${imgResult.instrument || '?'}: ${(imgResult.levels || []).length} levels)`;
        }
      } catch (err) {
        visionFailed = true;
        visionNote = `\n Vision error: ${err.message}`;
      }
    }
  }

  const input_type = (rawText && imageResults.length) ? 'mixed'
    : imageResults.length ? 'image' : 'text';

  const pasteRecord = {
    timestamp:   new Date().toISOString(),
    input_type,
    raw_text:    rawText || null,
    image_count: imageResults.filter(r => r && r.parse_status !== 'failed').length,
  };

  const existingState = loadDubzState();
  const newState      = mergeDubzInputs(textResult, imageResults, existingState, today, pasteRecord);
  saveDubzState(newState);
  await appendDubzToMemory(newState);

  const instrLines = Object.entries(newState.instruments)
    .map(([instr, data]) => `${instr}: ${data.levels.length}`)
    .join('  |  ');
  const conflictLine = newState.conflicts.length > 0
    ? `\n ${newState.conflicts.length} conflict(s) detected; run /dubz to review`
    : '';
  const errLine = newState.parse_errors.length > 0
    ? `\nParse notes: ${newState.parse_errors.join('; ')}`
    : '';

  if (newState.carry_forward_failed) {
    return res.json({ reply: `Carry-forward requested but no prior Dubz state was found. Paste today's levels first.` });
  }

  const mixedSuccess = visionFailed && textResult;
  const dubzPrefix   = mixedSuccess ? 'PARTIAL parse: text levels captured, image vision failed\n' : '';
  const dubzTailNote = mixedSuccess ? visionNote : '';
  const dubzInline   = mixedSuccess ? '' : visionNote;
  // Suppress parse_errors redundancy in mixed-success: dubzTailNote already carries the detail.
  const dubzErrLine  = mixedSuccess ? '' : errLine;

  return res.json({
    reply: `${dubzPrefix} Dubz levels updated${dubzInline}.\n${instrLines}${conflictLine}${dubzErrLine}${dubzTailNote}`,
  });
}

module.exports = { handleSaty, handleMancini, handleHeatmap, handleDubz };
