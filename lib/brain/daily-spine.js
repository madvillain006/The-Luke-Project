'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
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

function buildWeatherUrl({ lat, lon, timezone = 'America/New_York' }) {
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

function summarizeWeather(payload) {
  if (!payload || !payload.current) {
    return { status: 'unavailable', summary: 'Weather unavailable', source: 'open-meteo' };
  }
  const current = payload.current;
  const daily = payload.daily || {};
  const high = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
  const low = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
  const precip = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : null;
  const temp = Math.round(current.temperature_2m);
  const feels = Math.round(current.apparent_temperature);
  return {
    status: 'ok',
    source: 'open-meteo',
    temperature_f: temp,
    feels_like_f: feels,
    wind_mph: current.wind_speed_10m ?? null,
    precipitation_probability: precip,
    high_f: high == null ? null : Math.round(high),
    low_f: low == null ? null : Math.round(low),
    summary: `${temp}F, feels ${feels}F${high == null || low == null ? '' : `, ${Math.round(low)}-${Math.round(high)}F`}${precip == null ? '' : `, rain ${precip}%`}`,
  };
}

async function fetchWeather({ lat, lon, timezone, fetchFn = fetch } = {}) {
  const url = buildWeatherUrl({ lat, lon, timezone });
  if (!url) {
    return {
      status: 'needs_location',
      summary: 'Weather needs latitude and longitude',
      source: 'open-meteo',
    };
  }
  try {
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    return summarizeWeather(await response.json());
  } catch (err) {
    return {
      status: 'unavailable',
      summary: `Weather unavailable: ${err.message}`,
      source: 'open-meteo',
    };
  }
}

function buildDailySpine(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const timeZone = options.timeZone || 'America/New_York';
  const today = dateKey(now, timeZone);
  const checkins = readJsonlTail(paths.events.dailyCheckins, 5);
  const todaysCheckins = checkins.filter(entry => entry.date === today);
  const latestCheckin = todaysCheckins[todaysCheckins.length - 1] || null;

  const checklist = [
    {
      id: 'daily-checkin',
      label: 'Daily check-in',
      status: latestCheckin ? 'done' : 'open',
      detail: latestCheckin ? latestCheckin.summary || 'Check-in captured' : 'Capture priorities, hard commitments, and constraints.',
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
  ];

  return {
    agent: 'daily',
    label: 'Daily check-in spine',
    generated_at: now.toISOString(),
    date: today,
    status: checklist.some(item => item.status === 'open') ? 'open' : 'nominal',
    weather: options.weather || {
      status: 'needs_location',
      summary: 'Weather needs latitude and longitude',
      source: 'open-meteo',
    },
    checklist,
    things_to_know: [
      'Hard commitments and errands belong here before the day starts.',
      'Weather is advisory only; it does not drive trading decisions.',
      'Trading remains a separate human-gated sub-agent.',
    ],
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
  buildDailySpine,
  buildWeatherUrl,
  fetchWeather,
  recordDailyCheckin,
  summarizeWeather,
};
