'use strict';
const fs   = require('fs');
const path = require('path');

const PROCESSED  = path.join(__dirname, '../data/kat/processed-signals.jsonl');
const OUTPUT     = path.join(__dirname, '../data/level-frequency.json');
const BUCKET_SIZE = 5; // round to nearest 5 points

function buildLevelFrequency() {
  if (!fs.existsSync(PROCESSED)) {
    console.log('[level-freq] No processed signals file. Run Kat batch processor first.');
    process.exit(0);
  }

  const lines = fs.readFileSync(PROCESSED, 'utf8')
    .split('\n').filter(l => l.trim());

  console.log('[level-freq] Processing', lines.length, 'signals...');

  const map = {};

  for (const line of lines) {
    try {
      const sig = JSON.parse(line);
      if (!sig.levels || sig.levels.length === 0) continue;
      if (!sig.ticker || !sig.ts || !sig.analyst) continue;

      const sigTs = new Date(sig.ts).getTime();

      for (const level of sig.levels) {
        const bucket = Math.round(level / BUCKET_SIZE) * BUCKET_SIZE;
        const key    = String(bucket);

        if (!map[key]) {
          map[key] = {
            level:       bucket,
            count:       0,
            analysts:    {},
            tickers:     {},
            biases:      { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 },
            signal_types: {},
            first_seen:  sig.ts,
            last_seen:   sig.ts
          };
        }

        const entry = map[key];
        entry.count++;
        entry.analysts[sig.analyst]     = (entry.analysts[sig.analyst] || 0) + 1;
        entry.tickers[sig.ticker]       = (entry.tickers[sig.ticker] || 0) + 1;
        entry.signal_types[sig.signal_type] = (entry.signal_types[sig.signal_type] || 0) + 1;

        if (sig.bias && entry.biases[sig.bias] !== undefined) {
          entry.biases[sig.bias]++;
        }

        if (sigTs < new Date(entry.first_seen).getTime()) entry.first_seen = sig.ts;
        if (sigTs > new Date(entry.last_seen).getTime())  entry.last_seen  = sig.ts;
      }
    } catch (e) {
      console.error('[level-freq] Parse error:', e.message);
    }
  }

  // Compute derived fields
  const result = {};
  for (const [key, entry] of Object.entries(map)) {
    const analystCount = Object.keys(entry.analysts).length;
    const dominantBias = entry.biases.BULLISH > entry.biases.BEARISH ? 'BULLISH'
      : entry.biases.BEARISH > entry.biases.BULLISH ? 'BEARISH' : 'NEUTRAL';

    result[key] = {
      ...entry,
      analyst_count:  analystCount,
      dominant_bias:  dominantBias,
      // Confluence bonus score:
      // +1 if count >= 3
      // +2 if count >= 8
      // +1 additional if analyst_count >= 2
      // Max bonus: +3
      confluence_bonus: Math.min(3,
        (entry.count >= 3 ? 1 : 0) +
        (entry.count >= 8 ? 1 : 0) +
        (analystCount >= 2 ? 1 : 0)
      )
    };
  }

  // Write atomically
  const tmp = OUTPUT + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2), 'utf8');
  fs.renameSync(tmp, OUTPUT);

  const qualified = Object.values(result).filter(e => e.confluence_bonus > 0);
  console.log('[level-freq] Total levels mapped:', Object.keys(result).length);
  console.log('[level-freq] Levels with confluence bonus:', qualified.length);
  console.log('[level-freq] Top 10 by count:');
  Object.entries(result)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([k, v]) => {
      console.log('  ', k, '— count:', v.count,
        'analysts:', v.analyst_count,
        'bias:', v.dominant_bias,
        'bonus:+' + v.confluence_bonus);
    });

  console.log('[level-freq] Written to', OUTPUT);
}

buildLevelFrequency();
