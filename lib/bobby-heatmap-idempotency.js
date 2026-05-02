'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeHeatmapText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function normalizeImagePayload(image) {
  if (!image || typeof image !== 'string') return '';
  return image.replace(/^data:image\/[^;]+;base64,/, '').replace(/\s+/g, '');
}

function buildBobbyHeatmapSourceId({ text = '', image = null } = {}) {
  const normalizedText = normalizeHeatmapText(text);
  const normalizedImage = normalizeImagePayload(image);
  const payload = {
    text: normalizedText,
    image_sha256: normalizedImage ? sha256(normalizedImage) : null,
  };
  return `bobby-heatmap:${sha256(JSON.stringify(payload))}`;
}

function countBobbyNodes(result) {
  if (!result || typeof result !== 'object') return 0;
  return (result.king_nodes || []).length +
    (result.support || []).length +
    (result.resistance || []).length;
}

function findBobbyBySourceId(state, sourceId) {
  if (!state || !sourceId || !Array.isArray(state.bobby)) return null;
  return state.bobby.find(item => item && item.source_id === sourceId) || null;
}

function attachBobbySource(result, sourceId) {
  if (!result || typeof result !== 'object' || !sourceId) return result;
  return { ...result, source_id: sourceId };
}

module.exports = {
  buildBobbyHeatmapSourceId,
  countBobbyNodes,
  findBobbyBySourceId,
  attachBobbySource,
  _internal: {
    normalizeHeatmapText,
    normalizeImagePayload,
    sha256,
  },
};
