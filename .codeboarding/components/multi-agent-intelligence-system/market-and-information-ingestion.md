---
component_id: 2.5
component_name: Market & Information Ingestion
---

# Market & Information Ingestion

## Component Description

Responsible for fetching external data (RSS, News) and applying analytical models (Sienna Regime) to provide environmental context for the trading agents and daily briefings.

---

## Key References:

### c:\Users\conor\luke\lib\brain\daily-brief.js (lines 307-338)
```
function buildDailyBrief(input = {}) {
  const kind = BRIEF_PROFILES[input.kind] ? input.kind : 'morning';
  const profile = BRIEF_PROFILES[kind];
  const news = input.news || { by_category: {}, social_watchlist: [] };
  const now = input.now || new Date();
  const sections = profile.sections.map(section => {
    const items = (news.by_category?.[section.category] || []).slice(0, section.limit).map(summarizeItem);
    return {
      id: section.id,
      label: section.label,
      category: section.category,
      status: items.length ? 'live' : 'waiting',
      items,
      empty_note: items.length ? null : `No fresh ${CATEGORY_LABELS[section.category]} items pulled yet.`,
    };
  });

  return {
    ok: true,
    agent: 'daily',
    kind,
    label: profile.label,
    generated_at: now.toISOString(),
    weather: input.weather || null,
    news_status: news.status || 'unavailable',
    sections,
    checklist: profile.checklist,
    nudge: profile.nudge,
    source_status: news.sources || [],
    social_watchlist: news.social_watchlist || getDailyNewsConfig(input).social_watchlist,
  };
}
```

### c:\Users\conor\luke\lib\sienna-regime.js (lines 53-107)
```
function getSiennaRegime() {
  const etMins = getETMinutes();
  const today = getTodayET();
  const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;

  // Guard: require today's ximes signals before running any detection
  const allRecentXimes = loadAllXimesSignals(50);
  const todayXimes = allRecentXimes.filter(e => {
    const ts = e.timestamp || e.date || '';
    if (ts.startsWith(today)) return true;
    // numeric ms timestamp fallback
    const ms = typeof e.ts === 'number' ? e.ts : (typeof e.timestamp_ms === 'number' ? e.timestamp_ms : 0);
    return ms > 0 && ms >= eightHoursAgo;
  });

  if (todayXimes.length === 0) {
    return { regime: 'NEUTRAL', selectivity: 'NORMAL', max_trades_today: 2, confidence_boost: 0, reason: 'No signals yet today' };
  }

  const bobbyCtx = loadTodayBobbyContext();
  const recentXimes = todayXimes.slice(-3);

  // RISK_OFF: VIX mentioned in bobby context today
  if (bobbyCtx.some(e => e.vix_mentioned === true)) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'VIX mentioned in bobby context today' };
  }

  // RISK_OFF: last 3 today ximes signals are all MANAGEMENT (choppy, no new entries)
  if (recentXimes.length >= 3 && recentXimes.every(e => e.signal_type === 'MANAGEMENT')) {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Last 3 ximes signals are MANAGEMENT — choppy' };
  }

  if (isGoodTradingTime().window === 'lunch') {
    return { regime: 'RISK_OFF', selectivity: 'HIGH', max_trades_today: 1, confidence_boost: 0, reason: 'Lunch chop window (11:30 AM–1:00 PM ET)' };
  }

  // RISK_ON: Bobby has TRINITY signal today
  if (bobbyCtx.some(e => (e.raw || e.content || '').toUpperCase().includes('TRINITY') || (e.signal_type || '').toUpperCase().includes('TRINITY'))) {
    return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'Bobby TRINITY signal today' };
  }

  // RISK_ON: PRE_MARKET_SETUP with HIGH confidence in today's signals only
  for (const e of todayXimes) {
    if (e.signal_type === 'PRE_MARKET_SETUP' && e.confidence === 'HIGH') {
      return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'PRE_MARKET_SETUP HIGH confidence today' };
    }
    for (const r of e.results || []) {
      if (r.signal_type === 'PRE_MARKET_SETUP' && r.confidence === 'HIGH') {
        return { regime: 'RISK_ON', selectivity: 'NORMAL', max_trades_today: 3, confidence_boost: 1, reason: 'PRE_MARKET_SETUP HIGH confidence today' };
      }
    }
  }

  return { regime: 'NEUTRAL', selectivity: 'HIGH', max_trades_today: 2, confidence_boost: 0, reason: 'No elevated risk signals or special setups' };
}
```

### c:\Users\conor\luke\lib\brain\daily-brief.js (lines 265-295)
```
async function fetchDailyNews(options = {}) {
  const config = getDailyNewsConfig(options);
  const sources = options.sources || config.sources;
  const categories = options.categories || config.categories;
  const feedResults = await Promise.all(sources.map(source => fetchFeed(source, options)));
  const allItems = dedupeItems(feedResults.flatMap(result => result.items))
    .sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff) return scoreDiff;
      return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
    });

  const byCategory = {};
  for (const category of categories) {
    byCategory[category] = allItems.filter(item => item.category === category).slice(0, options.limitPerCategory || 8);
  }

  return {
    status: feedResults.some(result => result.ok) ? 'ok' : 'unavailable',
    generated_at: (options.now || new Date()).toISOString(),
    sources: feedResults.map(result => ({
      id: result.source,
      ok: result.ok,
      count: result.items.length,
      error: result.error || null,
    })),
    social_watchlist: config.social_watchlist,
    items: allItems.slice(0, options.totalLimit || 30),
    by_category: byCategory,
  };
}
```


## Source Files:

- `lib\brain\daily-brief.js`
- `lib\sienna-regime.js`
- `scripts\import-mancini-archive.js`

