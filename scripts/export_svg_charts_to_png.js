#!/usr/bin/env node
// Export local SVG chart artifacts to PNG using an installed Chromium browser.
// Review artifact helper only; does not touch trading/runtime state.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { dirs: [], executablePath: null };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--dir') {
      args.dirs.push(argv[++i]);
    } else if (item === '--browser') {
      args.executablePath = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

function existingBrowserPath(explicit) {
  const candidates = [
    explicit,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function svgFiles(dir) {
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) {
    throw new Error(`Directory not found: ${abs}`);
  }
  return fs.readdirSync(abs)
    .filter((name) => name.toLowerCase().endsWith('.svg'))
    .map((name) => path.join(abs, name))
    .sort();
}

function svgSize(file) {
  const text = fs.readFileSync(file, 'utf8').slice(0, 500);
  const width = Number((text.match(/\bwidth="(\d+(?:\.\d+)?)"/) || [])[1]) || 1400;
  const height = Number((text.match(/\bheight="(\d+(?:\.\d+)?)"/) || [])[1]) || 860;
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.dirs.length) {
    throw new Error('Usage: node scripts/export_svg_charts_to_png.js --dir <relative-chart-dir> [--dir <relative-chart-dir>]');
  }
  const executablePath = existingBrowserPath(args.executablePath);
  if (!executablePath) {
    throw new Error('No Chrome or Edge executable found for SVG raster export.');
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const exported = [];
  try {
    for (const dir of args.dirs) {
      for (const file of svgFiles(dir)) {
        const size = svgSize(file);
        const page = await browser.newPage({ viewport: size });
        await page.goto(pathToFileURL(file).href);
        const out = file.replace(/\.svg$/i, '.png');
        await page.screenshot({ path: out, fullPage: false });
        await page.close();
        exported.push(path.relative(ROOT, out));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({
    review_only: true,
    trading_authority: 'none',
    exported_count: exported.length,
    exported,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
