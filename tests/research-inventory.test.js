'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { inventoryFile, classifyFile } = require('../lib/research/existing-data-inventory');
const { buildSourceTimeline, makeEvent } = require('../lib/research/source-timeline');
const { activeEventsAt } = require('../lib/research/no-lookahead-context');

describe('research existing-data inventory', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-inventory-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses discovered Barchart CSV bars with ET timezone handling', () => {
    const filePath = path.join(tempDir, 'esh26_intraday-1min_historical-data-download-04-29-2026.csv');
    fs.writeFileSync(filePath, [
      'Time,Open,High,Low,Latest,Change,%Change,Volume',
      '"2026-04-09 09:30",6800,6810,6790,6805,5,+0.07%,123',
      '"2026-04-09 09:31",6805,6815,6800,6812,7,+0.10%,234',
    ].join('\n'), 'utf8');

    const entry = inventoryFile(filePath);
    expect(entry.type).toBe('ES 1-minute bars');
    expect(entry.row_count).toBe(2);
    expect(entry.timestamps_parseable).toBe(true);
    expect(entry.timezone_explicit).toBe(true);
    expect(entry.date_range).toEqual({ start: '2026-04-09', end: '2026-04-09' });
  });

  it('marks heatmap image without cached parse as unparsed image data', () => {
    expect(classifyFile('fixtures/bobby/2026-04-27_1003_bobby_3panel.png', '.png')).toBe('Bobby heatmap images');
    const event = makeEvent({
      id: 'image-only',
      source: 'bobby',
      source_type: 'bobby_image_unparsed',
      raw_path: 'fixtures/bobby/example.png',
      usable_for_replay: false,
      unusable_reason: 'image_unparsed',
    });
    expect(event.usable_for_replay).toBe(false);
    expect(event.unusable_reason).toBe('image_unparsed');
  });

  it('quarantines source events without timestamps from time-specific replay', () => {
    const event = makeEvent({
      id: 'missing-time',
      source: 'katbot',
      source_type: 'katbot_context',
      usable_for_replay: false,
      unusable_reason: 'missing_timestamp',
    });
    const active = activeEventsAt([event], '2026-04-09T10:00:00-04:00');
    expect(active).toEqual([]);
  });

  it('orders source timeline events and deduplicates repeated source events', () => {
    const timeline = buildSourceTimeline({ usableOnly: false });
    const keys = new Set();
    for (const event of timeline.events) {
      const key = `${event.source}|${event.source_type}|${event.instrument}|${event.available_at_et}|${JSON.stringify(event.levels)}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    const usable = timeline.events.filter(event => event.usable_for_replay);
    const sorted = [...usable].sort((a, b) => new Date(a.available_at_et) - new Date(b.available_at_et));
    expect(usable.map(event => event.id)).toEqual(sorted.map(event => event.id));
    expect(timeline.missing.some(item => item.unusable_reason === 'image_unparsed' || item.unusable_reason === 'missing_timestamp')).toBe(true);
  });

  it('filters no-lookahead context at checkpoint time', () => {
    const before = makeEvent({
      id: 'before',
      source: 'bobby',
      source_type: 'bobby_text',
      timestamp_et: '2026-04-09T09:59:00-04:00',
      available_at_et: '2026-04-09T09:59:00-04:00',
    });
    const after = makeEvent({
      id: 'after',
      source: 'bobby',
      source_type: 'bobby_text',
      timestamp_et: '2026-04-09T10:01:00-04:00',
      available_at_et: '2026-04-09T10:01:00-04:00',
    });
    expect(activeEventsAt([before, after], '2026-04-09T10:00:00-04:00').map(event => event.id)).toEqual(['before']);
  });
});
