'use strict';

const { buildKatAudit } = require('../lib/kat-audit');

function pct(numerator, denominator) {
  if (!denominator) return '0.0%';
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

function printAudit(audit) {
  console.log('KATBOT INDEX AUDIT');
  console.log('Generated: ' + audit.generated_at);
  console.log('');
  console.log('Scope');
  console.log('- watched: ' + audit.scope.watched_index_tickers.join(', '));
  console.log('- SPX direct option lane: ' + audit.scope.spx_options_direct_only.join(', '));
  console.log('- QQQ/NDX/NQ: separate confluence lane, not SPX-equivalent yet');
  console.log('- single names: ignored in this pass');
  console.log('');
  console.log('Raw feed');
  console.log('- lines: ' + audit.files.raw_feed.lines + ' bad: ' + audit.files.raw_feed.bad_lines);
  console.log('- range: ' + (audit.raw.first_ts || 'n/a') + ' -> ' + (audit.raw.last_ts || 'n/a'));
  console.log('- analysts: ' + audit.raw.analysts_count + ' channels: ' + audit.raw.channels_count);
  console.log('- image posts: ' + audit.raw.image_posts + ' with index mentions: ' + audit.raw.image_posts_with_index_mentions);
  console.log('- heatmap candidates: ' + audit.raw.heatmap_candidates);
  console.log('- index mention posts: ' + audit.raw.index_mention_posts);
  console.log('- lanes: ' + JSON.stringify(audit.raw.lane_counts));
  console.log('');
  console.log('Processed signals');
  console.log('- lines: ' + audit.files.processed_signals.lines + ' bad: ' + audit.files.processed_signals.bad_lines);
  console.log('- index signals: ' + audit.processed.index_signals + ' / ' + audit.processed.total + ' (' + pct(audit.processed.index_signals, audit.processed.total) + ')');
  console.log('- SPX direct option signals: ' + audit.processed.spx_options_direct_signals);
  console.log('- image signals: ' + audit.processed.image_signals);
  console.log('- lanes: ' + JSON.stringify(audit.processed.by_lane));
  console.log('');
  console.log('Replay parser');
  console.log('- parsed: ' + audit.replay.parsed + ' / ' + audit.replay.attempted + ' (' + pct(audit.replay.parsed, audit.replay.attempted) + ')');
  console.log('- index parsed: ' + audit.replay.index_parsed);
  console.log('- SPX direct parsed: ' + audit.replay.spx_options_direct_parsed);
  console.log('- lanes: ' + JSON.stringify(audit.replay.by_lane));
  console.log('');
  console.log('Market data');
  console.log('- available: ' + (audit.market_data.available_tickers.join(', ') || 'none'));
  for (const ticker of audit.market_data.available_tickers) {
    const files = audit.market_data.by_ticker[ticker] || [];
    console.log('  ' + ticker + ': ' + files.length + ' file(s); largest ' + files.slice(0, 2).map(f => f.path).join(' | '));
  }
  console.log('');
  console.log('Blockers');
  if (audit.blockers.length) {
    for (const blocker of audit.blockers) console.log('- ' + blocker);
  } else {
    console.log('- none from audit layer');
  }
  console.log('');
  console.log('Next actions');
  for (const action of audit.next_actions) console.log('- ' + action);
}

const audit = buildKatAudit();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  printAudit(audit);
}
