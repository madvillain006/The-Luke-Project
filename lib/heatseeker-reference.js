'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTEXT_DIR = path.join(ROOT, 'data', 'trading-context');
const MARKDOWN_FILE = path.join(CONTEXT_DIR, 'heatseeker-node-reference.md');
const JSON_FILE = path.join(CONTEXT_DIR, 'heatseeker-node-reference.json');

let cachedReference = null;
let cachedPrompt = null;

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function loadHeatseekerReference() {
  if (cachedReference) return cachedReference;
  const markdown = readText(MARKDOWN_FILE);
  const json = readJson(JSON_FILE);
  cachedReference = {
    markdown,
    json,
    files: {
      markdown: MARKDOWN_FILE,
      json: JSON_FILE,
    },
  };
  return cachedReference;
}

function buildHeatseekerReferencePrompt() {
  if (cachedPrompt) return cachedPrompt;
  const reference = loadHeatseekerReference();
  const sections = [
    'DURABLE HEATSEEKER / BOBBY HEATMAP REFERENCE',
    'Use this as interpretive confluence only. It does not authorize autonomous execution or override Luke risk controls.',
    'This pack includes the full text notes plus the transcribed summary image text.',
  ];

  if (reference.json) {
    sections.push('MACHINE SUMMARY JSON:');
    sections.push(JSON.stringify(reference.json, null, 2));
  }

  if (reference.markdown) {
    sections.push('FULL SOURCE NOTES AND SUMMARY IMAGE TRANSCRIPTION:');
    sections.push(reference.markdown);
  }

  if (!reference.json && !reference.markdown) {
    sections.push('No Heatseeker reference files were found. Continue with conservative generic heatmap parsing.');
  }

  cachedPrompt = sections.join('\n\n');
  return cachedPrompt;
}

module.exports = {
  MARKDOWN_FILE,
  JSON_FILE,
  loadHeatseekerReference,
  buildHeatseekerReferencePrompt,
};
