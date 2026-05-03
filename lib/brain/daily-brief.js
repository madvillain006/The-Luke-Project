'use strict';

const SOCIAL_WATCHLIST = [
  {
    id: 'deitaone',
    label: 'DeItaone / Walter Bloomberg',
    category: 'markets',
    url: 'https://x.com/DeItaone',
    env_feed: 'LUKE_DEITAONE_FEED_URL',
    note: 'X needs an API key or RSS bridge for automated live pulls.',
  },
  {
    id: 'schefter',
    label: 'Adam Schefter',
    category: 'nfl',
    url: 'https://x.com/AdamSchefter',
    env_feed: 'LUKE_SCHEFTER_FEED_URL',
    note: 'X needs an API key or RSS bridge for automated live pulls.',
  },
];

const DEFAULT_RSS_SOURCES = [
  {
    id: 'cnbc-markets',
    label: 'CNBC Markets',
    category: 'markets',
    url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html',
    priority: 90,
    keywords: ['fed', 'fomc', 'yield', 'treasury', 'stocks', 'market', 's&p', 'nasdaq', 'dow', 'inflation', 'oil'],
  },
  {
    id: 'yahoo-spy',
    label: 'Yahoo Finance SPY',
    category: 'markets',
    url: 'https://finance.yahoo.com/rss/headline?s=SPY',
    priority: 75,
    keywords: ['spy', 's&p', 'market', 'stocks', 'etf', 'fed', 'inflation'],
  },
  {
    id: 'yahoo-qqq',
    label: 'Yahoo Finance QQQ',
    category: 'markets',
    url: 'https://finance.yahoo.com/rss/headline?s=QQQ',
    priority: 72,
    keywords: ['qqq', 'nasdaq', 'tech', 'ai', 'semiconductor', 'stocks'],
  },
  {
    id: 'espn-nfl',
    label: 'ESPN NFL',
    category: 'nfl',
    url: 'https://www.espn.com/espn/rss/nfl/news',
    priority: 80,
    keywords: ['trade', 'injury', 'contract', 'coach', 'quarterback', 'draft', 'roster', 'suspension'],
  },
  {
    id: 'pro-football-rumors',
    label: 'Pro Football Rumors',
    category: 'nfl',
    url: 'https://www.profootballrumors.com/feed',
    priority: 78,
    keywords: ['trade', 'signing', 'extension', 'injury', 'waiver', 'roster', 'bills', 'buffalo'],
  },
  {
    id: 'buffalo-rumblings',
    label: 'Buffalo Rumblings',
    category: 'bills',
    url: 'https://www.buffalorumblings.com/rss/current',
    priority: 82,
    keywords: ['bills', 'buffalo', 'josh allen', 'injury', 'roster', 'draft', 'camp', 'schedule'],
  },
];

const CATEGORY_LABELS = {
  markets: 'Markets',
  nfl: 'NFL',
  bills: 'Buffalo Bills',
};

const BRIEF_PROFILES = {
  morning: {
    label: 'Morning brief',
    sections: [
      { id: 'market-open', label: 'Market open setup', category: 'markets', limit: 5 },
      { id: 'nfl-wire', label: 'NFL wire', category: 'nfl', limit: 4 },
      { id: 'bills-watch', label: 'Bills watch', category: 'bills', limit: 4 },
    ],
    checklist: [
      'Scan overnight market headlines before touching trade ideas.',
      'Check /status and /ready before any trading decision.',
      'Look for Schefter-style NFL injury, trade, and contract news.',
      'Look for Bills roster, injury, schedule, and Josh Allen items.',
    ],
    nudge: 'Keep the brief tight: what moved, why it matters, what to watch next.',
  },
  afternoon: {
    label: 'Afternoon brief',
    sections: [
      { id: 'market-afternoon', label: 'Market afternoon tape', category: 'markets', limit: 5 },
      { id: 'nfl-afternoon', label: 'NFL afternoon wire', category: 'nfl', limit: 4 },
      { id: 'bills-afternoon', label: 'Bills afternoon watch', category: 'bills', limit: 4 },
    ],
    checklist: [
      'Re-check market-moving headlines before power hour.',
      'Separate live news from stale morning narratives.',
      'Check Bills/NFL injury and transaction updates again.',
      'Do not let headline noise bypass trading guardrails.',
    ],
    nudge: 'Aim for a clean second look: new information, changed risk, next obvious action.',
  },
};

function splitEnvList(value) {
  return String(value || '')
    .split(/[\n,|]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function configuredSourcesFromEnv(env = process.env) {
  const groups = [
    ['LUKE_MARKET_RSS_URLS', 'markets', 'Configured market feed'],
    ['LUKE_NFL_RSS_URLS', 'nfl', 'Configured NFL feed'],
    ['LUKE_BILLS_RSS_URLS', 'bills', 'Configured Bills feed'],
  ];
  const sources = [];
  for (const [key, category, fallbackLabel] of groups) {
    splitEnvList(env[key]).forEach((entry, index) => {
      const [maybeLabel, maybeUrl] = entry.includes('=') ? entry.split(/=(.*)/s).filter(Boolean) : [null, entry];
      sources.push({
        id: `${key.toLowerCase()}-${index + 1}`,
        label: maybeLabel || `${fallbackLabel} ${index + 1}`,
        category,
        url: maybeUrl,
        priority: 95,
        keywords: [],
      });
    });
  }

  for (const social of SOCIAL_WATCHLIST) {
    if (!env[social.env_feed]) continue;
    sources.push({
      id: `${social.id}-feed`,
      label: social.label,
      category: social.category,
      url: env[social.env_feed],
      priority: 100,
      keywords: social.id === 'deitaone'
        ? ['breaking', 'fed', 'fomc', 'treasury', 'stocks', 'oil', 'inflation']
        : ['breaking', 'trade', 'injury', 'contract', 'roster', 'bills'],
    });
  }
  return sources;
}

function getDailyNewsConfig(options = {}) {
  const env = options.env || process.env;
  return {
    sources: [...configuredSourcesFromEnv(env), ...DEFAULT_RSS_SOURCES],
    social_watchlist: SOCIAL_WATCHLIST.map(item => ({
      ...item,
      configured: Boolean(env[item.env_feed]),
    })),
    categories: Object.keys(CATEGORY_LABELS),
  };
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(text, limit = 400) {
  return decodeEntities(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function tagValue(block, tagNames) {
  for (const tag of tagNames) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (match) return cleanText(match[1], 1000);
  }
  return null;
}

function parseFeedItems(xml, source) {
  const blocks = [...String(xml || '').matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return blocks.map((block, index) => {
    const title = tagValue(block, ['title']);
    const link = tagValue(block, ['link']) || (block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || null);
    const summary = tagValue(block, ['description', 'summary', 'content']);
    const published = tagValue(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const parsedMs = published ? new Date(published).getTime() : NaN;
    return {
      id: `${source.id}:${link || title || index}`,
      source_id: source.id,
      source: source.label,
      category: source.category,
      title,
      summary,
      url: link,
      published_at: Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : null,
      priority: source.priority || 50,
    };
  }).filter(item => item.title);
}

function itemScore(item, source) {
  const haystack = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  const keywordHits = (source.keywords || []).filter(keyword => haystack.includes(String(keyword).toLowerCase())).length;
  const recency = item.published_at ? Math.max(0, 24 - ((Date.now() - new Date(item.published_at).getTime()) / 3600000)) : 0;
  return (source.priority || 50) + (keywordHits * 12) + Math.min(24, recency);
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = String(item.url || item.title).toLowerCase().replace(/\?.*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

async function fetchFeed(source, options = {}) {
  const fetchFn = options.fetchFn || fetch;
  const timeoutMs = options.timeoutMs || 10000;
  try {
    const response = await fetchFn(source.url, {
      headers: { 'User-Agent': 'LukeDailyBrief/1.0' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return {
      source: source.id,
      ok: true,
      items: parseFeedItems(xml, source).map(item => ({
        ...item,
        score: itemScore(item, source),
      })),
    };
  } catch (err) {
    return {
      source: source.id,
      ok: false,
      error: err.message,
      items: [],
    };
  }
}

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

function summarizeItem(item) {
  return {
    title: item.title,
    source: item.source,
    url: item.url,
    published_at: item.published_at,
    why_it_matters: item.summary || `${CATEGORY_LABELS[item.category] || item.category} headline to review.`,
  };
}

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

function formatBriefForNotification(brief) {
  const lines = [
    `${brief.label.toUpperCase()} ${new Date(brief.generated_at).toLocaleString()}`,
  ];
  if (brief.weather?.summary) lines.push(`WEATHER: ${brief.weather.summary}`);
  for (const section of brief.sections || []) {
    lines.push('');
    lines.push(section.label.toUpperCase());
    if (!section.items.length) {
      lines.push(section.empty_note);
      continue;
    }
    section.items.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title} (${item.source})`);
    });
  }
  lines.push('');
  lines.push(`NUDGE: ${brief.nudge}`);
  return lines.join('\n');
}

module.exports = {
  buildDailyBrief,
  fetchDailyNews,
  formatBriefForNotification,
  getDailyNewsConfig,
  parseFeedItems,
  _internal: {
    cleanText,
    configuredSourcesFromEnv,
    decodeEntities,
    splitEnvList,
  },
};
