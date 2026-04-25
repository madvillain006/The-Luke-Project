'use strict';
/**
 * Quick test for parseBobbyImage against a real heatmap screenshot.
 *
 * Usage:
 *   node scripts/test-bobby-vision.js [path-to-image]
 *
 * Default image path: test-heatmap.png in luke root.
 * Drag any Bobby heatmap screenshot to that path, then run this.
 */
const fs   = require('fs');
const path = require('path');
const { parseBobbyImage } = require('../lib/parse-bobby');

const imgPath = process.argv[2] || path.join(__dirname, '../test-heatmap.png');

if (!fs.existsSync(imgPath)) {
  console.error(`Image not found: ${imgPath}`);
  console.error('Save a Bobby heatmap screenshot to that path and re-run.');
  process.exit(1);
}

const stat = fs.statSync(imgPath);
if (stat.size < 1000) {
  console.error(`File at ${imgPath} is too small (${stat.size} bytes) — placeholder file.`);
  console.error('Save a real Bobby heatmap screenshot there and re-run.');
  process.exit(1);
}

console.log(`Testing vision parse on: ${imgPath} (${(stat.size/1024).toFixed(1)} KB)`);

const b64 = fs.readFileSync(imgPath).toString('base64');

parseBobbyImage(b64).then(result => {
  if (!result) {
    console.log('\n✗ parseBobbyImage returned null — vision failed or no levels found.');
    console.log('  This usually means the image format or size confused the model.');
    console.log('  Use text paste fallback: /heatmap [Bobby commentary text]');
    process.exit(1);
  }

  console.log('\n✓ Vision parse succeeded:\n');
  console.log(JSON.stringify(result, null, 2));

  const total = result.king_nodes.length + result.support.length + result.resistance.length;
  console.log(`\nSummary: ${total} levels extracted`);
  console.log(`  King nodes: ${result.king_nodes.join(', ') || 'none'}`);
  console.log(`  Support:    ${result.support.join(', ') || 'none'}`);
  console.log(`  Resistance: ${result.resistance.join(', ') || 'none'}`);
  console.log(`  Bias:       ${result.bias}`);
  console.log(`  Tickers:    ${(result.tickers_detected || []).join(', ') || 'unknown'}`);
  console.log(`  Notes:      ${result.notes}`);

  if (total === 0) {
    console.log('\n⚠️  No levels extracted — model saw the image but found nothing.');
    console.log('   Check if the image is clear. Text fallback will work fine.');
  } else {
    console.log('\n✅ Vision working. Tomorrow: paste image into /heatmap and it will parse.');
  }
}).catch(e => {
  console.error('\nError:', e.message);
  process.exit(1);
});
