'use strict';

const fs   = require('fs');
const path = require('path');
const { parseBobby, mergeBobby, detectMediaType } = require('../lib/parse-bobby');

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
    const result = parseBobby('Support at 5750 holding strong. Resistance wall at 5820 above.');
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
