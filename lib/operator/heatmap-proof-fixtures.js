'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');

const FIXTURES = [
  {
    id: 'bobby-2026-04-27-1003',
    label: 'Bobby heatmap 10:03',
    file: path.join(ROOT, 'fixtures', 'bobby', '2026-04-27_1003_bobby_3panel.png'),
    message: '$SPX heatmaps, decent support under all three with room to run on SPY bullish for SPX for now.',
    panels: [
      {
        ticker: 'SPXW',
        current_price: 7162.15,
        relevant_levels: [
          { price: 7160, role: 'king_node', note: 'yellow king row near current price' },
          { price: 7155, role: 'floor', note: 'purple floor directly below current' },
          { price: 7130, role: 'support', note: 'large green support below' },
          { price: 7185, role: 'wall', note: 'purple resistance overhead' },
        ],
      },
      {
        ticker: 'SPY',
        current_price: 713.89,
        relevant_levels: [
          { price: 712, role: 'king_node', note: 'yellow king row' },
          { price: 714, role: 'near_price_floor', note: 'purple/negative row near current' },
          { price: 715, role: 'support_or_magnet', note: 'large green row above current' },
          { price: 720, role: 'wall', note: 'large purple overhead row' },
        ],
      },
      {
        ticker: 'QQQ',
        current_price: 662.85,
        relevant_levels: [
          { price: 664, role: 'king_node', note: 'yellow king row overhead' },
          { price: 662, role: 'king_node', note: 'yellow king row below/near current' },
          { price: 663, role: 'near_price_floor', note: 'purple row at current area' },
          { price: 665, role: 'support_or_magnet', note: 'large green row overhead' },
        ],
      },
    ],
  },
  {
    id: 'bobby-2026-04-27-1005',
    label: 'Bobby heatmap 10:05',
    file: path.join(ROOT, 'fixtures', 'bobby', '2026-04-27_1005_bobby_3panel.png'),
    message: 'Remember large nodes cause chop if the rest of king nodes are not close in value.',
    panels: [
      {
        ticker: 'SPXW',
        current_price: 7162.16,
        relevant_levels: [
          { price: 7160, role: 'king_node', note: 'yellow king row still pinned near current' },
          { price: 7155, role: 'floor', note: 'purple floor directly below current' },
          { price: 7130, role: 'support', note: 'large green support below' },
          { price: 7185, role: 'wall', note: 'purple resistance overhead' },
        ],
      },
      {
        ticker: 'SPY',
        current_price: 713.88,
        relevant_levels: [
          { price: 712, role: 'king_node', note: 'yellow king row' },
          { price: 714, role: 'floor', note: 'purple/negative row near current' },
          { price: 715, role: 'support_or_magnet', note: 'large green row above current' },
          { price: 720, role: 'wall', note: 'large purple overhead row' },
        ],
      },
      {
        ticker: 'QQQ',
        current_price: 662.79,
        relevant_levels: [
          { price: 662, role: 'king_node', note: 'yellow king row below/near current' },
          { price: 665, role: 'king_node', note: 'yellow/green major row overhead' },
          { price: 663, role: 'near_price_floor', note: 'purple row at current area' },
          { price: 664, role: 'support_or_magnet', note: 'large green row overhead' },
        ],
      },
    ],
  },
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function toPublicFixture(fixture) {
  const exists = fs.existsSync(fixture.file);
  const allLevels = fixture.panels.flatMap(panel => panel.relevant_levels.map(level => ({
    ticker: panel.ticker,
    current_price: panel.current_price,
    ...level,
  })));
  return {
    id: fixture.id,
    label: fixture.label,
    message: fixture.message,
    image_route: `/api/operator/heatmap-proof/image/${encodeURIComponent(fixture.id)}`,
    image_path: path.relative(ROOT, fixture.file).replace(/\\/g, '/'),
    image_exists: exists,
    image_sha256: exists ? sha256(fixture.file) : null,
    panels: fixture.panels,
    acknowledged_levels: allLevels,
    ack: `ACK ${fixture.label}: ${allLevels.map(level => `${level.ticker} ${level.price} ${level.role}`).join('; ')}`,
  };
}

function listHeatmapProofFixtures() {
  return FIXTURES.map(toPublicFixture);
}

function getHeatmapProofFixture(id) {
  return FIXTURES.find(fixture => fixture.id === id) || null;
}

function buildHeatmapProofResponse() {
  const fixtures = listHeatmapProofFixtures();
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    read_only: true,
    no_live_execution: true,
    mode: 'local_fixture_proof',
    external_vision_used: false,
    note: 'Proof uses local fixture PNGs and visible-level assertions. No broker calls and no third-party image upload.',
    fixtures,
    checks: {
      two_distinct_images: fixtures.length >= 2 && new Set(fixtures.map(item => item.image_sha256)).size >= 2,
      every_fixture_has_levels: fixtures.every(item => item.acknowledged_levels.length > 0),
      every_fixture_image_exists: fixtures.every(item => item.image_exists),
    },
  };
}

module.exports = {
  buildHeatmapProofResponse,
  getHeatmapProofFixture,
  listHeatmapProofFixtures,
};
