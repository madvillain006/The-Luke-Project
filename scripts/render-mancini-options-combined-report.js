'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-options-horizons-spx');
const HTML_FILE = path.join(REPORT_DIR, 'mancini-acceptance-carry-es-spx-underlying-report.html');
const PDF_FILE = path.join(REPORT_DIR, 'mancini-acceptance-carry-es-spx-underlying-report.pdf');
const PNG_FILE = path.join(REPORT_DIR, 'mancini-acceptance-carry-es-spx-underlying-report.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(HTML_FILE).href, { waitUntil: 'load' });
  await page.pdf({
    path: PDF_FILE,
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '0.45in',
      right: '0.45in',
      bottom: '0.45in',
      left: '0.45in',
    },
  });
  await page.screenshot({ path: PNG_FILE, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({
    ok: true,
    pdf: path.relative(ROOT, PDF_FILE),
    png: path.relative(ROOT, PNG_FILE),
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
