'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');
const { getDailyNewsConfig } = require('./daily-brief');

const DEFAULT_LOCATION = {
  label: 'Buffalo, NY',
  lat: 42.8864,
  lon: -78.8784,
  timezone: 'America/New_York',
};

const DEFAULT_WEATHER_LOCATIONS = [
  DEFAULT_LOCATION,
  {
    label: 'Knoxville, TN',
    lat: 35.9606,
    lon: -83.9207,
    timezone: 'America/New_York',
  },
  {
    label: 'Wilmington, NC',
    lat: 34.2104,
    lon: -77.8868,
    timezone: 'America/New_York',
  },
];

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

function readJsonlTail(file, limit = 10) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dateKey(now = new Date(), timeZone = 'America/New_York') {
  return now.toLocaleDateString('en-CA', { timeZone });
}

function buildWeatherUrl({ lat = DEFAULT_LOCATION.lat, lon = DEFAULT_LOCATION.lon, timezone = DEFAULT_LOCATION.timezone } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone,
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function weatherCodeText(code) {
  const numeric = Number(code);
  if ([0].includes(numeric)) return 'clear';
  if ([1, 2].includes(numeric)) return 'partly cloudy';
  if ([3].includes(numeric)) return 'cloudy';
  if ([45, 48].includes(numeric)) return 'foggy';
  if ([51, 53, 55, 56, 57].includes(numeric)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(numeric)) return 'rainy';
  if ([71, 73, 75, 77, 85, 86].includes(numeric)) return 'snowy';
  if ([95, 96, 99].includes(numeric)) return 'stormy';
  return 'unknown';
}

function summarizeWeather(payload, label = DEFAULT_LOCATION.label) {
  if (!payload || !payload.current) {
    return { status: 'unavailable', summary: 'Weather unavailable', source: 'open-meteo', location: label };
  }
  const current = payload.current;
  const daily = payload.daily || {};
  const high = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
  const low = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
  const precip = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : null;
  const temp = Math.round(current.temperature_2m);
  const feels = Math.round(current.apparent_temperature);
  const condition = weatherCodeText(current.weather_code);
  return {
    status: 'ok',
    source: 'open-meteo',
    location: label,
    temperature_f: temp,
    feels_like_f: feels,
    condition,
    weather_code: current.weather_code ?? null,
    wind_mph: current.wind_speed_10m ?? null,
    precipitation_probability: precip,
    high_f: high == null ? null : Math.round(high),
    low_f: low == null ? null : Math.round(low),
    summary: `${temp}F and ${condition}, feels ${feels}F${high == null || low == null ? '' : `, ${Math.round(low)}-${Math.round(high)}F`}${precip == null ? '' : `, rain ${precip}%`}`,
  };
}

async function fetchWeather({ lat, lon, timezone, label, fetchFn = fetch } = {}) {
  const url = buildWeatherUrl({
    lat: lat ?? DEFAULT_LOCATION.lat,
    lon: lon ?? DEFAULT_LOCATION.lon,
    timezone: timezone || DEFAULT_LOCATION.timezone,
  });
  if (!url) {
    return {
      status: 'needs_location',
      summary: 'Weather needs latitude and longitude',
      source: 'open-meteo',
      location: label || DEFAULT_LOCATION.label,
    };
  }
  try {
    const response = await fetchFn(url, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined,
    });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    return summarizeWeather(await response.json(), label || DEFAULT_LOCATION.label);
  } catch (err) {
    return {
      status: 'unavailable',
      summary: `Weather unavailable: ${err.message}`,
      source: 'open-meteo',
      location: label || DEFAULT_LOCATION.label,
    };
  }
}

async function fetchWeatherForLocations(options = {}) {
  const locations = options.locations || DEFAULT_WEATHER_LOCATIONS;
  return Promise.all(locations.map(location => fetchWeather({
    ...location,
    fetchFn: options.fetchFn || fetch,
  })));
}

function calendarWindow(now = new Date(), days = 7) {
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normalizeSchedule(raw, now = new Date()) {
  const window = raw?.window || calendarWindow(now);
  const events = Array.isArray(raw?.events)
    ? raw.events.map(event => ({
      id: event.id || event.event_id || null,
      title: event.title || event.summary || 'Untitled calendar event',
      starts_at: event.starts_at || event.start || event.start_time || null,
      ends_at: event.ends_at || event.end || event.end_time || null,
      location: event.location || null,
      source: event.source || 'google-calendar',
    })).filter(event => event.starts_at || event.title)
    : [];
  return {
    status: raw?.status || (raw ? 'synced' : 'not_connected'),
    source: raw?.source?.app || raw?.source || 'google-calendar',
    generated_at: raw?.generated_at || null,
    window,
    events,
    note: raw?.note || (raw ? null : 'No Google Calendar cache found yet. Connect/sync Google Calendar to fill this.'),
  };
}

function readSchedule(paths, now = new Date()) {
  return normalizeSchedule(readJson(paths.snapshots.dailyCalendarWeek, null), now);
}

function readMailAttention(paths) {
  const raw = readJson(paths.snapshots.dailyGmailAttention, null);
  if (!raw) {
    return {
      status: 'not_synced',
      unread_inbox: null,
      unread_total: null,
      cleanup: {
        status: 'needs_retry',
        label: 'Luke/Cleanup/Unread Non-Substack Subscriptions',
        query: 'is:unread in:inbox older_than:7d (unsubscribe OR "manage preferences" OR "view in browser") -substack',
        action: 'Label and archive, not permanent delete.',
      },
      attention: ['Gmail cleanup has not synced into Luke yet.'],
    };
  }

  if (raw.counts) {
    return {
      status: raw.status || 'ok',
      unread_inbox: raw.counts?.inbox?.messages_unread ?? null,
      unread_total: raw.counts?.unread?.messages_total ?? null,
      cleanup: {
        status: raw.cleanup?.applied ? 'applied' : 'estimate_only',
        label: raw.cleanup?.label || 'Luke/Cleanup/Unread Non-Substack Subscriptions',
        query: raw.cleanup?.query || 'in:inbox is:unread older_than:7d (unsubscribe OR subscription) -substack',
        action: 'Label and archive, not permanent delete.',
        messages_matched: raw.cleanup?.messages_matched ?? 0,
      },
      attention: Array.isArray(raw.attention_notes) ? raw.attention_notes : [],
      generated_at: raw.generated_at || null,
    };
  }

  return {
    status: raw.status || 'synced',
    unread_inbox: raw.unread_inbox ?? null,
    unread_total: raw.unread_total ?? null,
    cleanup: raw.cleanup || null,
    attention: Array.isArray(raw.attention) ? raw.attention : [],
    generated_at: raw.generated_at || null,
  };
}

function formatDateTime(now = new Date(), timeZone = 'America/New_York') {
  return {
    date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone }),
    timezone: timeZone,
  };
}

function buildDailySpine(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const timeZone = options.timeZone || 'America/New_York';
  const today = dateKey(now, timeZone);
  const checkins = readJsonlTail(paths.events.dailyCheckins, 5);
  const todaysCheckins = checkins.filter(entry => entry.date === today);
  const latestCheckin = todaysCheckins[todaysCheckins.length - 1] || null;
  const carryoverCommitments = checkins
    .filter(entry => entry.date && entry.date !== today)
    .flatMap(entry => (entry.commitments || []).map(commitment => ({
      date: entry.date,
      commitment,
    })))
    .slice(-12);
  const newsConfig = getDailyNewsConfig(options);

  const dateTime = formatDateTime(now, timeZone);
  const schedule = options.schedule || readSchedule(paths, now);
  const mailAttention = options.mailAttention || readMailAttention(paths);
  const weatherLocations = options.weatherLocations || (options.weather ? [options.weather] : []);
  const checklist = [
    {
      id: 'daily-checkin',
      label: 'Daily check-in',
      status: latestCheckin ? 'done' : 'static',
      detail: latestCheckin ? latestCheckin.summary || 'Check-in captured' : 'Daily is now a static operating brief; calendar, jobs, weather, and attention signals fill it automatically.',
    },
    {
      id: 'weather',
      label: 'Weather',
      status: options.weather?.status === 'ok' ? 'done' : 'open',
      detail: options.weather?.summary || 'Weather waits for a location.',
    },
    {
      id: 'trading-readiness',
      label: 'Trading readiness',
      status: 'manual',
      detail: 'Run /status and /ready before any trading decision.',
    },
    {
      id: 'brain-inbox',
      label: 'Brain inbox',
      status: 'manual',
      detail: 'Send important sub-agent updates to /agent/brain/report.',
    },
    {
      id: 'morning-brief',
      label: 'Morning brief',
      status: 'manual',
      detail: 'Pull /agent/brain/daily/brief?kind=morning for markets, NFL, and Bills news.',
    },
    {
      id: 'afternoon-brief',
      label: 'Afternoon brief',
      status: 'manual',
      detail: 'Pull /agent/brain/daily/brief?kind=afternoon for updated market and sports wires.',
    },
  ];
  const blockers = checklist
    .filter(item => item.status === 'open')
    .map(item => `${item.label}: ${item.detail}`);
  const nextActions = blockers.length
    ? blockers
    : ['No immediate daily blocker detected.'];

  return {
    agent: 'daily',
    label: 'Daily brief spine',
    generated_at: now.toISOString(),
    date: today,
    date_label: dateTime.date,
    time_label: dateTime.time,
    timezone: dateTime.timezone,
    status: checklist.some(item => item.status === 'open') ? 'open' : 'nominal',
    blockers,
    weather: options.weather || {
      status: 'needs_location',
      summary: 'Weather needs latitude and longitude',
      source: 'open-meteo',
    },
    checklist,
    weather_locations: weatherLocations,
    schedule,
    mail_attention: mailAttention,
    move_prompt: {
      label: 'Move to Tennessee',
      question: 'What is the next concrete thing Luke should track for the Tennessee move?',
      locations_to_watch: ['Knoxville, TN', 'Wilmington, NC', DEFAULT_LOCATION.label],
    },
    personal_note: 'I love Kat',
    pipeline: {
      checkins_today: todaysCheckins.length,
      recent_checkins: checkins.length,
      carryover_commitments: carryoverCommitments.length,
      schedule_events_this_week: schedule.events.length,
      mail_attention_items: mailAttention.attention.length,
    },
    carryover_commitments: carryoverCommitments,
    next_actions: nextActions,
    things_to_know: [
      'Hard commitments and errands belong here before the day starts.',
      'Weather is advisory only; it does not drive trading decisions.',
      'Schedule comes from the Google Calendar cache/feed when connected.',
      'Mail cleanup is label/archive first, not permanent deletion.',
      'Luke is the personal assistant/clawbot; trading is one separate human-gated module.',
      'Daily briefs use live RSS feeds when available; X sources need configured feed bridges or API access.',
    ],
    briefs: {
      morning: {
        endpoint: '/agent/brain/daily/brief?kind=morning',
        focus: ['market open setup', 'DeItaone-style market wire scan', 'NFL wire', 'Buffalo Bills watch'],
      },
      afternoon: {
        endpoint: '/agent/brain/daily/brief?kind=afternoon',
        focus: ['market afternoon tape', 'new headline risk', 'NFL injury/transaction sweep', 'Buffalo Bills updates'],
      },
    },
    live_news: {
      endpoint: '/agent/brain/daily/news',
      categories: newsConfig.categories,
      sources: newsConfig.sources.map(source => ({
        id: source.id,
        label: source.label,
        category: source.category,
        url: source.url,
      })),
      social_watchlist: newsConfig.social_watchlist,
    },
    recent_checkins: checkins,
  };
}

function recordDailyCheckin(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const timeZone = options.timeZone || 'America/New_York';
  const entry = {
    ts: now.toISOString(),
    date: dateKey(now, timeZone),
    summary: input.summary || null,
    priorities: Array.isArray(input.priorities) ? input.priorities.slice(0, 12) : [],
    commitments: Array.isArray(input.commitments) ? input.commitments.slice(0, 12) : [],
    constraints: Array.isArray(input.constraints) ? input.constraints.slice(0, 12) : [],
  };
  ensureParent(paths.events.dailyCheckins);
  fs.appendFileSync(paths.events.dailyCheckins, JSON.stringify(entry) + '\n', 'utf8');
  ensureParent(paths.snapshots.dailySpine);
  fs.writeFileSync(paths.snapshots.dailySpine, JSON.stringify(buildDailySpine({ paths, now, timeZone }), null, 2), 'utf8');
  return entry;
}

module.exports = {
  DEFAULT_LOCATION,
  DEFAULT_WEATHER_LOCATIONS,
  buildDailySpine,
  buildWeatherUrl,
  fetchWeatherForLocations,
  fetchWeather,
  formatDateTime,
  readMailAttention,
  readSchedule,
  recordDailyCheckin,
  summarizeWeather,
  weatherCodeText,
};
