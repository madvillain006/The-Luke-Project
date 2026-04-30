const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('domcontentloaded');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });
  console.log('SCREENSHOT: 01-initial-load.png taken');

  // Find the chat input
  const inputSel = 'textarea, #msg, #message, input[type=text]:not([readonly])';
  const inputEl = await page.$(inputSel).catch(() => null);
  if (!inputEl) {
    // Try any visible input
    const allInputs = await page.$$('input, textarea');
    console.log('INPUT_COUNT:', allInputs.length);
    for (const el of allInputs) {
      const visible = await el.isVisible();
      const type = await el.getAttribute('type');
      console.log('INPUT visible=' + visible + ' type=' + type);
    }
  }

  const chatInput = await page.$('textarea, input[type=text]');
  if (chatInput) {
    await chatInput.click();
    await chatInput.fill('/status');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-status-response.png'), fullPage: true });
    console.log('SCREENSHOT: 02-status-response.png taken');

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('CONTAINS_LUKE_ONLINE:', pageText.includes('LUKE ONLINE'));
    console.log('CONTAINS_MARKET:', pageText.includes('Market'));
    const hasMojibake = /[ï¿½Ã]/.test(pageText);
    console.log('MOJIBAKE_DETECTED:', hasMojibake);

    await chatInput.click();
    await chatInput.fill('/ready');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-ready-response.png'), fullPage: true });
    console.log('SCREENSHOT: 03-ready-response.png taken');
  } else {
    console.log('INPUT_NOT_FOUND - cannot type');
    const html = await page.content();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'page-source.html'), html);
    console.log('SAVED page-source.html for inspection');
  }

  await browser.close();
  console.log('UI_TEST_COMPLETE');
}

run().catch(e => { console.error('UI_TEST_ERROR:', e.message); process.exit(1); });
