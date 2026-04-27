'use strict';

const fs   = require('fs');
const path = require('path');
const { parseBobby, mergeBobby, detectMediaType, normalizePanels, getGroundedPrice } = require('../lib/parse-bobby');

describe('parseBobby', () => {
  it('returns null for empty or non-string input', () => {
    expect(parseBobby('')).toBeNull();
    expect(parseBobby(null)).toBeNull();
    expect(parseBobby(undefined)).toBeNull();
    expect(parseBobby(42)).toBeNull();
  });

  it('returns null when no prices found near keywords', () => {
    expect(parseBobby('Just some random text with no relevant prices')).toBeNull();
  });

  it('extracts king node price', () => {
    const result = parseBobby('King node at 5800 — watching this magnet');
    expect(result).not.toBeNull();
    expect(result.king_nodes).toContain(5800);
    expect(result.source).toBe('bobby-text');
  });

  it('extracts support and resistance levels', () => {
    const result = parseBobby(
      'Support at 5750 holding strong with buyers defending the zone and bids stepping in repeatedly through the morning session. ' +
      'Resistance wall at 5820 above.'
    );
    expect(result).not.toBeNull();
    expect(result.support).toContain(5750);
    expect(result.resistance).toContain(5820);
  });

  it('detects bullish bias from keywords', () => {
    const result = parseBobby('Upper king node at 5800 — bullish above. Support cushion at 5780.');
    expect(result).not.toBeNull();
    expect(result.bias).toBe('BULLISH');
  });

  it('detects bearish bias from keywords', () => {
    const result = parseBobby('No floor below 5750 — bearish, air pocket below 5730.');
    expect(result).not.toBeNull();
    expect(result.bias).toBe('BEARISH');
  });

  it('returns null for messages over 10000 chars', () => {
    const big = 'king node at 5800 '.repeat(600);
    expect(parseBobby(big)).toBeNull();
  });

  it('detects VIX mention', () => {
    const result = parseBobby('King node 5800 — VIX elevated, be careful');
    expect(result).not.toBeNull();
    expect(result.vix_mentioned).toBe(true);
  });

  // Regression: pricesNear window boundary bisected "7140" → "714" when a
  // keyword (e.g. "magnet") fell ~80 chars before the 4-digit price.
  it('regression: 4-digit price near window edge is not truncated (7140 not 714)', () => {
    const result = parseBobby(
      'King node at 7100 — magnet for the day. Support cushion at 7060 holding well. ' +
      'Resistance wall at 7140 above — gatekeeper if we rip. Support floor at 7020 below.'
    );
    expect(result).not.toBeNull();
    // 714 must never appear — it is a window-bisection artefact, not a real level
    expect(result.king_nodes).not.toContain(714);
    expect(result.support).not.toContain(714);
    expect(result.resistance).not.toContain(714);
    // 7140 must be captured (in resistance and/or king_nodes via gatekeeper/magnet overlap)
    const all = [...result.king_nodes, ...result.support, ...result.resistance];
    expect(all).toContain(7140);
  });

  it('regression: clean 4-digit boundary — support at 7000', () => {
    const result = parseBobby('Support at 7000 holding strong.');
    expect(result).not.toBeNull();
    expect(result.support).toContain(7000);
  });

  it('regression: lower SPX range — king node at 5895', () => {
    const result = parseBobby('King node at 5895 — primary magnet today.');
    expect(result).not.toBeNull();
    expect(result.king_nodes).toContain(5895);
  });

  it('regression: resistance wall string in isolation extracts correctly', () => {
    const result = parseBobby('Resistance wall at 7140 above');
    expect(result).not.toBeNull();
    expect(result.resistance).toContain(7140);
    expect(result.king_nodes).not.toContain(714);
  });
});

describe('detectMediaType', () => {
  // Simulate clipboard path: real PNG fixture loaded from disk, base64-encoded
  it('detects PNG from base64 string (clipboard path)', () => {
    const pngPath = path.join(__dirname, '../fixtures/dubz/2026-04-26_0917_dubz_nq.png');
    const b64 = fs.readFileSync(pngPath).toString('base64');
    expect(detectMediaType(b64)).toBe('image/png');
  });

  it('detects PNG from raw Buffer', () => {
    const pngPath = path.join(__dirname, '../fixtures/dubz/2026-04-26_0917_dubz_nq.png');
    const buf = fs.readFileSync(pngPath);
    expect(detectMediaType(buf)).toBe('image/png');
  });

  it('detects JPEG from base64 string', () => {
    // Minimal JPEG: FF D8 FF E0 magic bytes
    const jpegBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const b64 = jpegBytes.toString('base64');
    expect(detectMediaType(b64)).toBe('image/jpeg');
  });

  it('detects JPEG from raw Buffer', () => {
    const jpegBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    expect(detectMediaType(jpegBytes)).toBe('image/jpeg');
  });

  it('detects GIF from Buffer', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    expect(detectMediaType(gif)).toBe('image/gif');
  });

  it('detects WebP from Buffer', () => {
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46,  // RIFF
      0x00, 0x00, 0x00, 0x00,  // file size (ignored)
      0x57, 0x45, 0x42, 0x50   // WEBP
    ]);
    expect(detectMediaType(webp)).toBe('image/webp');
  });

  it('throws on unrecognized format instead of silently defaulting', () => {
    const junk = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => detectMediaType(junk)).toThrow('unrecognized image format');
  });

  it('throws on wrong input type', () => {
    expect(() => detectMediaType(42)).toThrow('expected string or Buffer');
    expect(() => detectMediaType(null)).toThrow('expected string or Buffer');
  });

  it('strips data URL prefix before detection (caller responsibility — verify raw64 path)', () => {
    // Callers do: raw64 = input.replace(/^data:image\/[^;]+;base64,/, '')
    // Confirm that after stripping, the PNG is still detected correctly
    const pngPath = path.join(__dirname, '../fixtures/dubz/2026-04-26_0917_dubz_nq.png');
    const dataUrl = 'data:image/png;base64,' + fs.readFileSync(pngPath).toString('base64');
    const raw64   = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    expect(detectMediaType(raw64)).toBe('image/png');
  });
});

describe('mergeBobby', () => {
  it('returns null if both are null', () => {
    expect(mergeBobby(null, null)).toBeNull();
  });

  it('returns visionResult if textResult is null', () => {
    const v = { king_nodes: [5800], support: [], resistance: [], bias: 'BULLISH', source: 'bobby-vision' };
    expect(mergeBobby(null, v)).toBe(v);
  });

  it('text result wins over vision when both have king_nodes', () => {
    const text   = { king_nodes: [5810], support: [], resistance: [], bias: 'NEUTRAL', raw: 'test', vix_mentioned: false };
    const vision = { king_nodes: [5820], support: [], resistance: [], bias: 'BULLISH', vix_mentioned: false };
    const merged = mergeBobby(text, vision);
    expect(merged.king_nodes).toEqual([5810]);
    expect(merged.source).toBe('bobby-merged');
  });
});

// ── Gate B-4: parseBobby commentary-only bias ─────────────────────────────────

describe('parseBobby – Gate B-4: commentary-only bias (no prices)', () => {
  it('returns non-null with bias for bullish commentary text without prices', () => {
    // Fixture 1003 text: "decent support under all three with room to run on SPY bullish for SPX"
    const result = parseBobby(
      '[10:03 AM]BOBBY [SKY], : $SPX heatmaps, decent support under all three ' +
      'with room to run on SPY bullish for SPX for now @everyone'
    );
    expect(result).not.toBeNull();
    expect(result.bias).toBe('BULLISH');
    expect(result.king_nodes).toHaveLength(0);
    expect(result.support).toHaveLength(0);
    expect(result.resistance).toHaveLength(0);
    expect(result.source).toBe('bobby-text');
  });

  it('returns non-null with NEUTRAL bias for chop commentary', () => {
    // Fixture 1005 text: "large nodes cause the chop"
    const result = parseBobby(
      '[10:05 AM]BOBBY [SKY], : Remmeber large nodes cause the chop if the rest ' +
      'of king nodes are not close in value'
    );
    expect(result).not.toBeNull();
    expect(result.bias).toBe('NEUTRAL');
    expect(result.king_nodes).toHaveLength(0);
    expect(result.source).toBe('bobby-text');
  });

  it('still returns null when no prices AND no bias signals', () => {
    expect(parseBobby('Just some market observations here, nothing directional.')).toBeNull();
  });

  it('commentary path does not fire when prices are present', () => {
    // Text has a price near 'support' — normal path, not commentary path
    const result = parseBobby('Support at 5800 holding strong.');
    expect(result).not.toBeNull();
    expect(result.support).toContain(5800);
  });
});

// ── Gate G1 (B-2): normalizePanels – instrument attribution ──────────────────

describe('normalizePanels – Gate G1 (B-2): per-instrument attribution', () => {
  it('adds instrument field: SPXW→SPX, SPY→SPY, QQQ→QQQ', () => {
    const raw = [
      { ticker: 'SPXW', current_price: 7162, king_nodes: [7160], walls: [7185], floors: [7130] },
      { ticker: 'SPY',  current_price: 713,  king_nodes: [711],  walls: [720],  floors: [709]  },
      { ticker: 'QQQ',  current_price: 663,  king_nodes: [663],  walls: [670],  floors: [659]  },
    ];
    const panels = normalizePanels(raw, null);
    expect(panels[0].instrument).toBe('SPX');
    expect(panels[1].instrument).toBe('SPY');
    expect(panels[2].instrument).toBe('QQQ');
  });

  it('sets IWM instrument to null (not in level-memory CANONICAL_TOLERANCE)', () => {
    const raw = [{ ticker: 'IWM', current_price: 210, king_nodes: [210], walls: [], floors: [] }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].instrument).toBeNull();
  });

  it('returns empty array for non-array input', () => {
    expect(normalizePanels(null, null)).toEqual([]);
    expect(normalizePanels('bad', null)).toEqual([]);
  });

  it('preserves ticker and current_price from raw panel', () => {
    const raw = [{ ticker: 'SPY', current_price: 713.89, king_nodes: [711], walls: [720], floors: [709] }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].ticker).toBe('SPY');
    expect(panels[0].current_price).toBe(713.89);
  });
});

// ── Gate G3 (B-1): normalizePanels – king node dedup ─────────────────────────

describe('normalizePanels – Gate G3 (B-1): king node dedup from support/resistance', () => {
  it('removes king node value from floors within the same panel', () => {
    // Model returned king_nodes=[7160] AND floors=[7160, 7130] — 7160 duplicated
    const raw = [{
      ticker: 'SPXW', current_price: null,
      king_nodes: [7160], walls: [], floors: [7160, 7130]
    }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].king_nodes).toEqual([7160]);
    expect(panels[0].support).not.toContain(7160);
    expect(panels[0].support).toContain(7130);
  });

  it('removes king node value from walls within the same panel', () => {
    const raw = [{
      ticker: 'SPY', current_price: null,
      king_nodes: [711], walls: [711, 720], floors: []
    }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].king_nodes).toEqual([711]);
    expect(panels[0].resistance).not.toContain(711);
    expect(panels[0].resistance).toContain(720);
  });

  it('applies ±0.5 tolerance so near-duplicates are also removed', () => {
    const raw = [{
      ticker: 'SPXW', current_price: null,
      king_nodes: [7160], walls: [], floors: [7160.3, 7130]
    }];
    const panels = normalizePanels(raw, null);
    // 7160.3 is within ±0.5 of king_node 7160 → removed
    expect(panels[0].support).not.toContain(7160.3);
    expect(panels[0].support).toContain(7130);
  });

  it('preserves distinct values that are not near any king node', () => {
    const raw = [{
      ticker: 'SPXW', current_price: null,
      king_nodes: [7160], walls: [7185], floors: [7130, 7100]
    }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].king_nodes).toContain(7160);
    // No canonical price — model classification preserved
    expect(panels[0].resistance).toContain(7185);
    expect(panels[0].support).toContain(7130);
    expect(panels[0].support).toContain(7100);
  });
});

// ── Gate G2 (B-3): normalizePanels – wall classification via grounded price ───

describe('normalizePanels – Gate G2 (B-3): wall classification with grounded current_price', () => {
  it('reclassifies wall below current price to support', () => {
    // 7130 was in walls but is below current_price 7162 → should land in support
    const raw = [{
      ticker: 'SPXW', current_price: 7162,
      king_nodes: [7160], walls: [7185, 7130], floors: []
    }];
    // No live prices — use vision's current_price (7162) as canonical
    const panels = normalizePanels(raw, null);
    expect(panels[0].support).toContain(7130);
    expect(panels[0].resistance).not.toContain(7130);
    expect(panels[0].resistance).toContain(7185);
  });

  it('reclassifies floor above current price to resistance', () => {
    // 715 in floors but is above current_price 713 → should land in resistance
    const raw = [{
      ticker: 'SPY', current_price: 713,
      king_nodes: [711], walls: [720], floors: [715, 709]
    }];
    const panels = normalizePanels(raw, null);
    expect(panels[0].resistance).toContain(715);
    expect(panels[0].support).not.toContain(715);
    expect(panels[0].support).toContain(709);
  });

  it('skips levels within ±0.5 of current price (at-price levels)', () => {
    const raw = [{
      ticker: 'SPXW', current_price: 7162,
      king_nodes: [], walls: [7162.3], floors: []
    }];
    const panels = normalizePanels(raw, null);
    // 7162.3 is within ±0.5 of 7162 → excluded from support/resistance
    expect(panels[0].support).toHaveLength(0);
    expect(panels[0].resistance).toHaveLength(0);
  });

  it('uses grounded price from livePrice when available (overrides vision current_price)', () => {
    // Vision says current_price=7150 but grounded SPX is 7162
    const livePrice = { spx: 7162, spy: 713, instruments: { qqq: { price: 663 } } };
    const raw = [{
      ticker: 'SPXW', current_price: 7150,
      king_nodes: [], walls: [7130, 7185], floors: []
    }];
    const panels = normalizePanels(raw, livePrice);
    // Using grounded 7162: 7130 < 7162 → support; 7185 > 7162 → resistance
    expect(panels[0].support).toContain(7130);
    expect(panels[0].resistance).toContain(7185);
    expect(panels[0].current_price).toBe(7162); // canonical is grounded
  });

  it('fails open when livePrice is null — preserves model classification', () => {
    // No live price and no vision current_price — model classification stays
    const raw = [{
      ticker: 'SPXW', current_price: null,
      king_nodes: [7160], walls: [7185], floors: [7130]
    }];
    const panels = normalizePanels(raw, null);
    // No canonical price → deduped walls → resistance, deduped floors → support
    expect(panels[0].resistance).toContain(7185);
    expect(panels[0].support).toContain(7130);
  });

  it('QQQ grounded price resolved from livePrice.instruments.qqq.price', () => {
    const livePrice = { spx: 7162, spy: 713, instruments: { qqq: { price: 663 } } };
    const raw = [{
      ticker: 'QQQ', current_price: null,
      king_nodes: [663], walls: [670], floors: [659]
    }];
    const panels = normalizePanels(raw, livePrice);
    expect(panels[0].current_price).toBe(663);
    // After king-node dedup (none overlap): 670 > 663 → resistance; 659 < 663 → support
    expect(panels[0].resistance).toContain(670);
    expect(panels[0].support).toContain(659);
  });
});

// ── Gate 2: pricesNear regex cap {3,9} ────────────────────────────────────────

describe('parseBobby – Gate 2: pricesNear regex cap {3,9}', () => {
  it('extracts NQ prices with commas (up to 9 digit+comma chars)', () => {
    const result = parseBobby('NQ 26,884 holding above the 27,000 magnet');
    expect(result).not.toBeNull();
    const all = [...result.king_nodes, ...result.support, ...result.resistance];
    expect(all).toContain(26884);
    expect(all).toContain(27000);
  });
});

// ── Gate 1: parseBobby array-pollution dedup ──────────────────────────────────

describe('parseBobby – Gate 1: array-pollution dedup', () => {
  it('regression: same price in support+resistance keyword overlap is dropped from both', () => {
    const result = parseBobby(
      'support at 7100 above the resistance line at 7100'
    );
    expect(result).not.toBeNull();
    expect(result.king_nodes).not.toContain(7100);
    expect(result.support).not.toContain(7100);
    expect(result.resistance).not.toContain(7100);
  });

  it('regression: king node price is removed from support and resistance', () => {
    const result = parseBobby(
      'king node at 5800 with support at 5800 below and resistance at 5800 above'
    );
    expect(result).not.toBeNull();
    expect(result.king_nodes).toContain(5800);
    expect(result.support).not.toContain(5800);
    expect(result.resistance).not.toContain(5800);
  });

  it('regression: 5d bearish fixture pollution fix — 7100 and 7180 not in all three arrays', () => {
    const text = fs.readFileSync(
      path.join(__dirname, '../fixtures/bobby/synthetic-bearish-bobby.txt'),
      'utf8'
    );
    const result = parseBobby(text);
    expect(result).not.toBeNull();
    for (const price of [7100, 7180]) {
      const count = [result.king_nodes, result.support, result.resistance]
        .filter(arr => arr.includes(price)).length;
      expect(count).toBeLessThan(3);
    }
    expect([result.support, result.resistance].filter(arr => arr.includes(7100)).length).toBeLessThanOrEqual(1);
    expect([result.support, result.resistance].filter(arr => arr.includes(7180)).length).toBeLessThanOrEqual(1);
  });
});

// ── Gate 3: crossSourceConfirmed wired through appendBobbyToMemory ───────────

describe('appendBobbyToMemory – Gate 3: crossSourceConfirmed on merged path', () => {
  const os   = require('os');
  const { appendBobbyToMemory } = require('../lib/parse-bobby');
  const { queryLevels, _internal: { _setMemoryFile, _resetWriteFn } } = require('../lib/level-memory');

  let tmpFile;
  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bobby-mem-'));
    tmpFile = path.join(dir, 'lm.json');
    _setMemoryFile(tmpFile);
    _resetWriteFn();
  });

  it('merged result: panel king_node confirmed by text king_nodes → crossSourceConfirmed: true', async () => {
    const result = {
      source: 'bobby-merged',
      king_nodes: [7160],  // text-derived
      panels: [{
        ticker: 'SPXW', instrument: 'SPX',
        king_nodes: [7160], support: [], resistance: [],
      }],
      notes: 'test',
    };

    await appendBobbyToMemory(result);
    const levels = queryLevels({ instrument: 'SPX' });
    expect(levels).toHaveLength(1);
    expect(levels[0].mentions[0].crossSourceConfirmed).toBe(true);
  });

  it('vision-only result: king_node not in text king_nodes → crossSourceConfirmed: false', async () => {
    const result = {
      source: 'bobby-vision',
      king_nodes: [],  // no text
      panels: [{
        ticker: 'SPXW', instrument: 'SPX',
        king_nodes: [7160], support: [], resistance: [],
      }],
      notes: 'test',
    };

    await appendBobbyToMemory(result);
    const levels = queryLevels({ instrument: 'SPX' });
    expect(levels[0].mentions[0].crossSourceConfirmed).toBe(false);
  });
});

// ── Gate G1 (B-2): mergeBobby – panels propagated from vision ─────────────────

describe('mergeBobby – Gate G1 (B-2): panels propagated into merged result', () => {
  const VISION_PANELS = [
    { ticker: 'SPXW', instrument: 'SPX', current_price: 7162, king_nodes: [7160], support: [7130], resistance: [7185] },
    { ticker: 'SPY',  instrument: 'SPY', current_price: 713,  king_nodes: [711],  support: [709],  resistance: [720]  },
  ];

  it('merged result includes panels from vision', () => {
    const text   = { king_nodes: [], support: [], resistance: [], bias: 'BULLISH', raw: '', vix_mentioned: false };
    const vision = { panels: VISION_PANELS, king_nodes: [7160, 711], support: [7130, 709],
                     resistance: [7185, 720], bias: 'BULLISH', trinity: true, notes: '', tickers_detected: [],
                     source: 'bobby-vision', vision_parsed: true };
    const merged = mergeBobby(text, vision);
    expect(merged.panels).toEqual(VISION_PANELS);
    expect(merged.source).toBe('bobby-merged');
  });

  it('text bias_statement propagates into merged result', () => {
    const text   = { king_nodes: [], support: [], resistance: [], bias: 'BEARISH',
                     bias_statement: 'lower nodes dominating', raw: '', vix_mentioned: false };
    const vision = { panels: [], king_nodes: [], support: [], resistance: [],
                     bias: 'BULLISH', trinity: false, notes: '', tickers_detected: [],
                     source: 'bobby-vision', vision_parsed: true };
    const merged = mergeBobby(text, vision);
    expect(merged.bias).toBe('BEARISH');
    expect(merged.bias_statement).toBe('lower nodes dominating');
  });

  it('panels is empty array when vision has no panels', () => {
    const text   = { king_nodes: [5800], support: [], resistance: [], bias: 'NEUTRAL', raw: '', vix_mentioned: false };
    const vision = { king_nodes: [5820], support: [], resistance: [], bias: 'BULLISH', vix_mentioned: false };
    const merged = mergeBobby(text, vision);
    expect(merged.panels).toEqual([]);
  });

  it('trinity and notes from vision appear in merged result', () => {
    const text   = { king_nodes: [], support: [], resistance: [], bias: 'NEUTRAL', raw: '', vix_mentioned: false };
    const vision = { panels: [], king_nodes: [], support: [], resistance: [],
                     bias: 'BULLISH', trinity: true, notes: 'strong pinning', tickers_detected: ['SPXW'],
                     source: 'bobby-vision', vision_parsed: true };
    const merged = mergeBobby(text, vision);
    expect(merged.trinity).toBe(true);
    expect(merged.notes).toBe('strong pinning');
    expect(merged.tickers_detected).toContain('SPXW');
  });
});
