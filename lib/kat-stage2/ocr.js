'use strict';

const { readKatVisionSignals } = require('../kat-vision-store');
const { parseOptionContracts } = require('./options');
const { normalizeSymbol } = require('./instruments');

function buildVisionIndex(options = {}) {
  const rows = readKatVisionSignals({ rootDir: options.rootDir });
  const byMessage = new Map();
  for (const row of rows) {
    if (!row || !row.message_id) continue;
    if (!byMessage.has(row.message_id)) byMessage.set(row.message_id, []);
    byMessage.get(row.message_id).push(row);
  }
  return byMessage;
}

function hydrateHeatmapsWithVision(heatmaps, options = {}) {
  const index = options.visionIndex || buildVisionIndex(options);
  let hydrated = 0;
  const rows = (heatmaps || []).map(heatmap => {
    const matches = index.get(String(heatmap.source_message_id || '')) || [];
    const heatmapVision = matches.find(row => row.source_class === 'heatmap' || row.chart_type === 'heatmap') || matches[0] || null;
    if (!heatmapVision) return heatmap;
    hydrated += 1;
    const extractedLevels = Array.from(new Set([
      ...(heatmap.extracted_levels || []),
      ...(heatmapVision.levels || []),
      ...(heatmapVision.key_levels || []),
      ...(heatmapVision.support_levels || []),
      ...(heatmapVision.resistance_levels || []),
    ].map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
    return {
      ...heatmap,
      symbol: heatmap.symbol || heatmapVision.ticker || null,
      extracted_text: heatmapVision.notes || heatmapVision.raw_model_text || null,
      extracted_levels: extractedLevels,
      directional_bias: heatmapVision.bias ? String(heatmapVision.bias).toLowerCase() : heatmap.directional_bias,
      confluence_tags: Array.from(new Set([
        ...(heatmap.confluence_tags || []),
        heatmapVision.source_class === 'heatmap' ? 'vision_heatmap' : 'vision_chart',
        ...(heatmapVision.patterns || []),
      ].filter(Boolean))).slice(0, 12),
      parse_confidence: Math.max(heatmap.parse_confidence || 0, extractedLevels.length ? 0.85 : 0.7),
      notes: 'hydrated from Kat vision/OCR record; human-gated confluence only',
      vision_id: heatmapVision.vision_id || null,
    };
  });
  return {
    heatmaps: rows,
    summary: {
      vision_records: [...index.values()].reduce((sum, list) => sum + list.length, 0),
      heatmaps_hydrated: hydrated,
      heatmaps_without_ocr: rows.filter(row => !row.extracted_text).length,
    },
  };
}

function visionText(row) {
  return [
    row?.raw_text,
    row?.notes,
    row?.raw_model_text,
    Array.isArray(row?.patterns) ? row.patterns.join(' ') : '',
  ].filter(Boolean).join(' ');
}

function imageKindForVision(row) {
  const text = visionText(row).toLowerCase();
  if (row?.source_class === 'heatmap' || row?.chart_type === 'heatmap' || /\bheat\s?map|gamma|gex|king node|gatekeeper\b/.test(text)) return 'heatmap';
  if (/\bp\/?l|pnl|profit|loss|sold|closed|net profit|runner|gains?\b/.test(text)) return 'pnl';
  if (/\bbought|filled|avg fill|premium|contracts?|calls?|puts?|strike\b/.test(text)) return 'broker_ticket';
  if (row?.source_class === 'chart' || ['candlestick', 'technical'].includes(row?.chart_type)) return 'chart';
  return 'unknown';
}

function visionOptionEvidence(row) {
  const text = visionText(row);
  const contracts = parseOptionContracts(text, row?.ticker, row?.ts);
  const kind = imageKindForVision(row);
  return {
    vision_id: row?.vision_id || null,
    source_message_id: row?.message_id || null,
    timestamp_utc: row?.ts || null,
    analyst_id: row?.user_id || row?.analyst || 'unknown',
    analyst_name: row?.analyst || null,
    image_kind: kind,
    symbol: normalizeSymbol(row?.ticker) || contracts[0]?.underlying || null,
    option_contracts: contracts,
    option_contract: contracts[0] || null,
    ocr_text: row?.notes || row?.raw_model_text || null,
    attachment: row?.attachment || null,
    confidence: contracts.length ? 0.75 : 0.45,
  };
}

function buildVisionGainsPosts(options = {}) {
  const rows = options.rows || readKatVisionSignals({ rootDir: options.rootDir });
  return rows
    .map(visionOptionEvidence)
    .filter(row => ['pnl', 'broker_ticket'].includes(row.image_kind) && row.option_contracts.length > 0)
    .map(row => ({
      gains_id: 'vision_gains_' + row.vision_id,
      source_message_id: row.source_message_id,
      analyst_id: row.analyst_id,
      analyst_name: row.analyst_name,
      timestamp_utc: row.timestamp_utc,
      symbol: row.symbol,
      direction: row.option_contract?.option_side === 'PUT' ? 'short' : 'long',
    option_contracts: row.option_contracts,
    option_contract: row.option_contract,
    option_ticker: row.option_contract?.option_ticker || null,
      claimed_points: null,
      claimed_percent: null,
      claimed_dollars: null,
      claimed_r: null,
      screenshot_or_attachment: true,
      linked_trade_id: null,
      verification_status: 'gains_only_unverified',
      notes: 'vision-derived ' + row.image_kind + ' evidence; not verified without prior call link',
      vision_id: row.vision_id,
      image_kind: row.image_kind,
      ocr_text: row.ocr_text,
      parser_confidence: row.confidence,
    }));
}

function hydrateParsedWithVision(parsed, options = {}) {
  const rows = readKatVisionSignals({ rootDir: options.rootDir });
  const heatmapHydration = hydrateHeatmapsWithVision(parsed.heatmaps, {
    ...options,
    visionIndex: buildVisionIndex({ rootDir: options.rootDir }),
  });
  const existingGainSources = new Set((parsed.gains_posts || []).map(row => String(row.source_message_id || '')));
  const visionGains = buildVisionGainsPosts({ rows })
    .filter(row => !existingGainSources.has(String(row.source_message_id || '')));
  return {
    parsed: {
      ...parsed,
      heatmaps: heatmapHydration.heatmaps,
      gains_posts: [...(parsed.gains_posts || []), ...visionGains],
      summary: {
        ...parsed.summary,
        gains_posts: (parsed.gains_posts || []).length + visionGains.length,
        heatmaps_hydrated_with_vision: heatmapHydration.summary.heatmaps_hydrated,
        heatmaps_without_ocr: heatmapHydration.summary.heatmaps_without_ocr,
        vision_gains_posts: visionGains.length,
        vision_records: rows.length,
      },
    },
    ocr: {
      ...heatmapHydration.summary,
      vision_gains_posts: visionGains.length,
      vision_records: rows.length,
    },
  };
}

module.exports = {
  buildVisionIndex,
  buildVisionGainsPosts,
  hydrateHeatmapsWithVision,
  hydrateParsedWithVision,
  imageKindForVision,
  visionOptionEvidence,
};
