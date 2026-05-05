'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('./paths');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const GOOGLE_GMAIL_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_CLEANUP_LABEL = 'Luke/Cleanup/Unread Non-Substack Subscriptions';
const GMAIL_CLEANUP_QUERY = 'is:unread in:inbox older_than:7d (unsubscribe OR "manage preferences" OR "view in browser") -substack';

function timeoutSignal(ms = 8000) {
  return typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function writeJson(file, value) {
  ensureParent(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function freshDirectSnapshot(file, expectedSource, now, maxAgeMs) {
  if (!maxAgeMs || maxAgeMs <= 0) return null;
  const snapshot = readJson(file);
  if (!snapshot || snapshot.source !== expectedSource || !snapshot.generated_at) return null;
  const generatedAt = new Date(snapshot.generated_at).getTime();
  if (!Number.isFinite(generatedAt)) return null;
  const ageMs = now.getTime() - generatedAt;
  if (ageMs < 0 || ageMs > maxAgeMs) return null;
  return { ...snapshot, cached: true };
}

function directGoogleConfig(env = process.env) {
  return {
    apiKey: env.GOOGLE_API_KEY || env.GOOGLE_CALENDAR_API_KEY || null,
    calendarId: env.GOOGLE_CALENDAR_ID || env.GOOGLE_PRIMARY_CALENDAR_ID || 'primary',
    accessToken: env.GOOGLE_ACCESS_TOKEN || env.GOOGLE_OAUTH_ACCESS_TOKEN || null,
    refreshToken: env.GOOGLE_REFRESH_TOKEN || env.GOOGLE_OAUTH_REFRESH_TOKEN || null,
    clientId: env.GOOGLE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || null,
    clientSecret: env.GOOGLE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || null,
    gmailCleanupEnabled: env.LUKE_GMAIL_CLEANUP_DIRECT === 'true',
    gmailCleanupMax: Number(env.LUKE_GMAIL_CLEANUP_MAX || 100),
  };
}

function googleDirectConfigured(env = process.env) {
  const config = directGoogleConfig(env);
  const hasOAuth = hasValue(config.accessToken) ||
    (hasValue(config.refreshToken) && hasValue(config.clientId) && hasValue(config.clientSecret));
  return {
    calendar: hasOAuth || hasValue(config.apiKey),
    gmail: hasOAuth,
    oauth: hasOAuth,
    api_key_calendar: hasValue(config.apiKey),
    cleanup_enabled: config.gmailCleanupEnabled,
  };
}

async function getAccessToken({ env = process.env, fetchFn = fetch } = {}) {
  const config = directGoogleConfig(env);
  if (hasValue(config.accessToken)) return config.accessToken.trim();
  if (!hasValue(config.refreshToken) || !hasValue(config.clientId) || !hasValue(config.clientSecret)) return null;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchFn(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: timeoutSignal(8000),
  });
  if (!response.ok) throw new Error(`google token HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error('google token response missing access_token');
  return payload.access_token;
}

function calendarWindow(now = new Date(), days = 7) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normalizeCalendarEvent(item) {
  const start = item.start || {};
  const end = item.end || {};
  return {
    id: item.id || null,
    title: item.summary || 'Untitled calendar event',
    starts_at: start.dateTime || start.date || null,
    ends_at: end.dateTime || end.date || null,
    location: item.location || null,
    source: 'google-calendar-direct',
    url: item.htmlLink || null,
  };
}

async function fetchCalendarWeek({ env = process.env, fetchFn = fetch, now = new Date(), days = 7 } = {}) {
  const config = directGoogleConfig(env);
  const availability = googleDirectConfigured(env);
  if (!availability.calendar) {
    return {
      status: 'not_configured',
      source: 'google-calendar-direct',
      note: 'Direct Google Calendar needs GOOGLE_ACCESS_TOKEN or GOOGLE_REFRESH_TOKEN/GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET; API key works only for public calendars.',
    };
  }

  const window = calendarWindow(now, days);
  const calendarId = encodeURIComponent(config.calendarId || 'primary');
  const params = new URLSearchParams({
    timeMin: window.start,
    timeMax: window.end,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  });
  const headers = {};
  const accessToken = await getAccessToken({ env, fetchFn });
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.apiKey) {
    params.set('key', config.apiKey);
  }

  const response = await fetchFn(`${GOOGLE_CALENDAR_EVENTS_URL}/${calendarId}/events?${params.toString()}`, {
    headers,
    signal: timeoutSignal(8000),
  });
  if (!response.ok) throw new Error(`google calendar HTTP ${response.status}`);
  const payload = await response.json();
  const events = Array.isArray(payload.items) ? payload.items.map(normalizeCalendarEvent) : [];

  return {
    status: 'synced',
    source: 'google-calendar-direct',
    generated_at: now.toISOString(),
    window,
    events,
    note: events.length ? null : 'Direct Google Calendar returned no events for this week.',
  };
}

async function fetchGmailAttention({ env = process.env, fetchFn = fetch, now = new Date() } = {}) {
  const accessToken = await getAccessToken({ env, fetchFn });
  if (!accessToken) {
    return {
      status: 'not_configured',
      source: 'gmail-direct',
      note: 'Direct Gmail needs Google OAuth credentials with Gmail scopes.',
    };
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const [inboxRes, unreadRes, cleanupRes] = await Promise.all([
    fetchFn(`${GOOGLE_GMAIL_URL}/labels/INBOX`, { headers, signal: timeoutSignal(8000) }),
    fetchFn(`${GOOGLE_GMAIL_URL}/labels/UNREAD`, { headers, signal: timeoutSignal(8000) }),
    fetchFn(`${GOOGLE_GMAIL_URL}/messages?${new URLSearchParams({ q: GMAIL_CLEANUP_QUERY, maxResults: '1' }).toString()}`, {
      headers,
      signal: timeoutSignal(8000),
    }),
  ]);
  if (!inboxRes.ok) throw new Error(`gmail inbox HTTP ${inboxRes.status}`);
  if (!unreadRes.ok) throw new Error(`gmail unread HTTP ${unreadRes.status}`);
  if (!cleanupRes.ok) throw new Error(`gmail cleanup query HTTP ${cleanupRes.status}`);

  const inbox = await inboxRes.json();
  const unread = await unreadRes.json();
  const cleanup = await cleanupRes.json();

  return {
    status: 'synced',
    source: 'gmail-direct',
    generated_at: now.toISOString(),
    unread_inbox: inbox.messagesUnread ?? null,
    unread_total: unread.messagesTotal ?? null,
    cleanup: {
      status: 'estimate_only',
      label: GMAIL_CLEANUP_LABEL,
      query: GMAIL_CLEANUP_QUERY,
      matching_estimate: cleanup.resultSizeEstimate ?? 0,
      action: 'Direct Gmail is connected. Cleanup remains label/archive first, not permanent deletion.',
    },
    attention: cleanup.resultSizeEstimate > 0
      ? [`${cleanup.resultSizeEstimate} unread non-Substack subscription-like messages currently match the cleanup query.`]
      : [],
  };
}

async function syncDirectDailyIntegrations({
  paths = defaultPaths,
  env = process.env,
  fetchFn = fetch,
  now = new Date(),
  force = false,
  maxAgeMs = Number(env.LUKE_GOOGLE_SYNC_MAX_AGE_MS || 10 * 60 * 1000),
} = {}) {
  const result = {
    ok: true,
    configured: googleDirectConfigured(env),
    calendar: null,
    gmail: null,
    errors: [],
  };

  try {
    const cachedCalendar = !force ? freshDirectSnapshot(paths.snapshots.dailyCalendarWeek, 'google-calendar-direct', now, maxAgeMs) : null;
    const calendar = cachedCalendar || await fetchCalendarWeek({ env, fetchFn, now });
    result.calendar = calendar;
    if (!cachedCalendar && calendar.status === 'synced') writeJson(paths.snapshots.dailyCalendarWeek, calendar);
  } catch (err) {
    result.errors.push({ integration: 'calendar', error: err.message });
  }

  try {
    const cachedGmail = !force ? freshDirectSnapshot(paths.snapshots.dailyGmailAttention, 'gmail-direct', now, maxAgeMs) : null;
    const gmail = cachedGmail || await fetchGmailAttention({ env, fetchFn, now });
    result.gmail = gmail;
    if (!cachedGmail && gmail.status === 'synced') writeJson(paths.snapshots.dailyGmailAttention, gmail);
  } catch (err) {
    result.errors.push({ integration: 'gmail', error: err.message });
  }

  result.ok = result.errors.length === 0;
  return result;
}

module.exports = {
  GMAIL_CLEANUP_LABEL,
  GMAIL_CLEANUP_QUERY,
  calendarWindow,
  directGoogleConfig,
  fetchCalendarWeek,
  fetchGmailAttention,
  getAccessToken,
  googleDirectConfigured,
  syncDirectDailyIntegrations,
};
