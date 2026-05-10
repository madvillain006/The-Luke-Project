'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildIntelligencePacket } = require('../lib/luke-intelligence-packet');
const { recordRadarIngest } = require('../lib/brain/radar-layer');

function tempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-packet-'));
  return {
    root,
    paths: {
      ROOT: root,
      events: {
        radarIngest: path.join(root, 'events', 'radar-ingest.jsonl'),
        radarReviews: path.join(root, 'events', 'radar-reviews.jsonl'),
        companionMemory: path.join(root, 'events', 'companion-memory.jsonl'),
        contextBins: path.join(root, 'events', 'context-bins.jsonl'),
      },
      snapshots: {
        radarState: path.join(root, 'snapshots', 'radar-state.json'),
        contextBins: path.join(root, 'snapshots', 'context-bins.json'),
        memory: path.join(root, 'snapshots', 'memory.json'),
      },
      config: {
        memory: path.join(root, 'config', 'memory.json'),
      },
    },
  };
}

describe('luke intelligence packet', () => {
  it('returns a non-empty string within the default char budget', () => {
    const { paths } = tempPaths();
    const packet = buildIntelligencePacket({ paths });
    expect(typeof packet).toBe('string');
    expect(packet.trim().length).toBeGreaterThan(0);
    expect(packet.length).toBeLessThanOrEqual(1200);
  });

  it('respects a custom maxChars budget', () => {
    const { paths } = tempPaths();
    const packet = buildIntelligencePacket({ paths, maxChars: 300 });
    expect(packet.length).toBeLessThanOrEqual(300);
  });

  it('includes radar section when items are present', () => {
    const { paths } = tempPaths();
    recordRadarIngest({
      source_label: 'sybil',
      source_type: 'sybil_paste',
      text: '$NVDA data center capex note contradicts the old semi thesis.',
    }, { paths });

    const packet = buildIntelligencePacket({ paths });
    expect(packet).toContain('Radar');
  });

  it('includes why-recalled review metadata for Radar items', () => {
    const { paths } = tempPaths();
    recordRadarIngest({
      source_label: 'hermes-ref',
      source_type: 'reference_idea',
      title: 'Session recall pattern',
      text: 'Hermes keeps scoped recall metadata on session memories.',
    }, { paths });

    const packet = buildIntelligencePacket({ paths, maxChars: 1200 });
    expect(packet).toContain('Session recall pattern');
    expect(packet).toContain('scope=reference_review');
    expect(packet).toContain('why=reference_idea_review_lane');
    expect(packet).toContain('review_only');
  });

  it('excludes reference registry section when surface is trading', () => {
    const { paths } = tempPaths();
    const packet = buildIntelligencePacket({ paths, surface: 'trading' });
    expect(packet).not.toContain('Refs');
  });

  it('includes reference registry section when surface is system', () => {
    const { paths } = tempPaths();
    const packet = buildIntelligencePacket({ paths, surface: 'system', maxChars: 2000 });
    expect(packet).toContain('Refs');
  });

  it('does not crash when all sources are empty', () => {
    const { paths } = tempPaths();
    expect(() => buildIntelligencePacket({ paths })).not.toThrow();
    const packet = buildIntelligencePacket({ paths });
    expect(typeof packet).toBe('string');
    expect(packet.length).toBeGreaterThan(0);
  });
});
