'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('Heatseeker reference context', () => {
  it('loads the durable text pack and the transcribed summary image text', () => {
    const {
      MARKDOWN_FILE,
      JSON_FILE,
      buildHeatseekerReferencePrompt,
      loadHeatseekerReference,
    } = require('../lib/heatseeker-reference');

    expect(MARKDOWN_FILE).toContain(path.join('data', 'trading-context', 'heatseeker-node-reference.md'));
    expect(JSON_FILE).toContain(path.join('data', 'trading-context', 'heatseeker-node-reference.json'));

    const reference = loadHeatseekerReference();
    expect(reference.markdown).toContain('Image Reference Transcription');
    expect(reference.markdown).toContain('Purple right over yellow');
    expect(reference.markdown).toContain('Robinhood Power Hour Liquidation');
    expect(reference.markdown).toContain('SPX: 5.00 margin');
    expect(reference.json.bot_context_summary).toContain('Focus on absolute node value more than sign or color. Higher absolute value means stronger pull, pin, rejection, or volatility effect.');

    const prompt = buildHeatseekerReferencePrompt();
    expect(prompt).toContain('FULL SOURCE NOTES AND SUMMARY IMAGE TRANSCRIPTION');
    expect(prompt).toContain('King Node is King');
    expect(prompt).toContain('OPEX week distorts node reliability');
  });

  it('wires the shared context into Bobby trading vision and Kat vision prompts', () => {
    const parseBobby = fs.readFileSync(path.join(ROOT, 'lib', 'parse-bobby.js'), 'utf8');
    const kat = fs.readFileSync(path.join(ROOT, 'agents', 'agent-14-kat.js'), 'utf8');

    expect(parseBobby).toContain("require('./heatseeker-reference')");
    expect(parseBobby).toContain('const heatseekerReference = buildHeatseekerReferencePrompt()');
    expect(parseBobby).toContain('HEATSEEKER NODE REFERENCE:');
    expect(parseBobby).toContain('BOBBY MESSAGE RULES:');

    expect(kat).toContain("require('../lib/heatseeker-reference')");
    expect(kat).toContain('For heatmap images, apply the Heatseeker node reference below.');
    expect(kat).toContain('"heatmap_context":{"king_nodes":[numbers],"gatekeeper_nodes":[numbers],"air_pockets":[numbers],"node_read":string|null}');
    expect(kat).toContain('heatmap_context: vision.heatmap_context || null');
  });
});
