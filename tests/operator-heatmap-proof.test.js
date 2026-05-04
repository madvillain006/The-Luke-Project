'use strict';

const fs = require('fs');
const path = require('path');

const { buildHeatmapProofResponse } = require('../lib/operator/heatmap-proof-fixtures');

const ROOT = path.join(__dirname, '..');

describe('operator heatmap proof fixtures', () => {
  it('acknowledges levels from two distinct local heatmap PNG fixtures without external vision', () => {
    const proof = buildHeatmapProofResponse();

    expect(proof.read_only).toBe(true);
    expect(proof.no_live_execution).toBe(true);
    expect(proof.external_vision_used).toBe(false);
    expect(proof.fixtures).toHaveLength(2);
    expect(proof.checks.two_distinct_images).toBe(true);
    expect(proof.checks.every_fixture_has_levels).toBe(true);
    expect(proof.fixtures[0].image_sha256).not.toBe(proof.fixtures[1].image_sha256);
    expect(proof.fixtures[0].ack).toContain('SPXW 7160');
    expect(proof.fixtures[1].ack).toContain('QQQ 665');

    for (const fixture of proof.fixtures) {
      expect(fs.existsSync(path.join(ROOT, fixture.image_path))).toBe(true);
    }
  });
});
