'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('./paths');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const GOOGLE_GMAIL_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_CLEANUP_LABEL = 'Luke/Cleanup/Unread Non-Substack Subscriptions';
const GMAIL_CLEANUP_QUERY = 'in:inbox is:unread older_than:7d (unsubscribe OR subscription) -substack';

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
  const source = snapshot?.source;
  const sourceMatches = typeof expectedSource === 'string'
    ? source === expectedSource || source?.app === expectedSource
    : Array.isArray(expectedSource)
      ? expectedSource.some(value => source === value || source?.app === value)
      : false;
  if (!snapshot || !sourceMatches || !snapshot.generated_at) return null;
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
    gmailCleanupEnabled: env.LUKE_GMAIL_CLEANUP_DIRECT !== 'false',
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
      source: {
        app: 'Google Calendar',
        calendar_id: config.calendarId || 'primary',
        timezone: 'America/New_York',
      },
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
    status: events.length ? 'synced' : 'empty',
    source: {
      app: 'Google Calendar',
      calendar_id: config.calendarId || 'primary',
      timezone: 'America/New_York',
    },
    generated_at: now.toISOString(),
    window,
    events,
    note: events.length ? null : 'No events were returned for the next 7 days in America/New_York.',
  };
}

async function ensureGmailLabelId({ accessToken, fetchFn = fetch, labelName = GMAIL_CLEANUP_LABEL } = {}) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const listRes = await fetchFn(`${GOOGLE_GMAIL_URL}/labels`, { headers, signal: timeoutSignal(8000) });
  if (!listRes.ok) throw new Error(`gmail labels HTTP ${listRes.status}`);
  const listBody = await listRes.json();
  const labels = Array.isArray(listBody.labels) ? listBody.labels : [];
  const existing = labels.find(label => label.name === labelName);
  if (existing) return existing.id;

  const createRes = await fetchFn(`${GOOGLE_GMAIL_URL}/labels`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
    signal: timeoutSignal(8000),
  });
  if (!createRes.ok) throw new Error(`gmail label create HTTP ${createRes.status}`);
  const created = await createRes.json();
  if (!created.id) throw new Error('gmail label create response missing id');
  return created.id;
}

async function listGmailMessageIds({ accessToken, fetchFn = fetch, query, maxResults = 500 } = {}) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const ids = [];
  let nextPageToken = null;

  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(maxResults, 500)),
    });
    if (nextPageToken) params.set('pageToken', nextPageToken);
    const res = await fetchFn(`${GOOGLE_GMAIL_URL}/messages?${params.toString()}`, {
      headers,
      signal: timeoutSignal(8000),
    });
    if (!res.ok) throw new Error(`gmail search HTTP ${res.status}`);
    const body = await res.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    ids.push(...messages.map(message => message.id).filter(Boolean));
    nextPageToken = body.nextPageToken || null;
  } while (nextPageToken);

  return ids;
}

async function batchModifyGmailMessages({ accessToken, fetchFn = fetch, messageIds, addLabelIds = [], removeLabelIds = [] } = {}) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  for (let i = 0; i < messageIds.length; i += 1000) {
    const chunk = messageIds.slice(i, i + 1000);
    const res = await fetchFn(`${GOOGLE_GMAIL_URL}/messages/batchModify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ids: chunk,
        addLabelIds,
        removeLabelIds,
      }),
      signal: timeoutSignal(8000),
    });
    if (!res.ok) throw new Error(`gmail batchModify HTTP ${res.status}`);
  }
}

async function applyGmailCleanup({ accessToken, fetchFn = fetch, labelName = GMAIL_CLEANUP_LABEL, query = GMAIL_CLEANUP_QUERY } = {}) {
  const messageIds = await listGmailMessageIds({ accessToken, fetchFn, query });
  const labelId = messageIds.length ? await ensureGmailLabelId({ accessToken, fetchFn, labelName }) : null;
  if (messageIds.length && labelId) {
    await batchModifyGmailMessages({
      accessToken,
      fetchFn,
      messageIds,
      addLabelIds: [labelId],
      removeLabelIds: ['INBOX'],
    });
  }
  return {
    applied: messageIds.length > 0,
    query,
    label: labelName,
    label_id: labelId,
    messages_matched: messageIds.length,
    archived: messageIds.length > 0,
  };
}

async function fetchGmailAttention({ env = process.env, fetchFn = fetch, now = new Date() } = {}) {
  const config = directGoogleConfig(env);
  const accessToken = await getAccessToken({ env, fetchFn });
  if (!accessToken) {
    return {
      status: 'not_configured',
      source: {
        app: 'Gmail',
        scope: ['INBOX', 'UNREAD', GMAIL_CLEANUP_LABEL],
      },
      note: 'Direct Gmail needs Google OAuth credentials with Gmail scopes.',
    };
  }

  const cleanup = config.gmailCleanupEnabled
    ? await applyGmailCleanup({ accessToken, fetchFn })
    : {
        applied: false,
        query: GMAIL_CLEANUP_QUERY,
        label: GMAIL_CLEANUP_LABEL,
        label_id: null,
        messages_matched: 0,
        archived: false,
      };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [inboxRes, unreadRes, cleanupLabelRes] = await Promise.all([
    fetchFn(`${GOOGLE_GMAIL_URL}/labels/INBOX`, { headers, signal: timeoutSignal(8000) }),
    fetchFn(`${GOOGLE_GMAIL_URL}/labels/UNREAD`, { headers, signal: timeoutSignal(8000) }),
    fetchFn(`${GOOGLE_GMAIL_URL}/labels/${encodeURIComponent(GMAIL_CLEANUP_LABEL)}`, { headers, signal: timeoutSignal(8000) }),
  ]);
  if (!inboxRes.ok) throw new Error(`gmail inbox HTTP ${inboxRes.status}`);
  if (!unreadRes.ok) throw new Error(`gmail unread HTTP ${unreadRes.status}`);

  const inbox = await inboxRes.json();
  const unread = await unreadRes.json();
  const cleanupLabel = cleanupLabelRes.ok
    ? await cleanupLabelRes.json()
    : {
        id: null,
        name: GMAIL_CLEANUP_LABEL,
        messagesTotal: 0,
        messagesUnread: 0,
        threadsTotal: 0,
        threadsUnread: 0,
      };

  return {
    status: 'ok',
    source: {
      app: 'Gmail',
      scope: ['INBOX', 'UNREAD', GMAIL_CLEANUP_LABEL],
    },
    generated_at: now.toISOString(),
    counts: {
      inbox: {
        messages_total: inbox.messagesTotal ?? 0,
        messages_unread: inbox.messagesUnread ?? 0,
        threads_total: inbox.threadsTotal ?? 0,
        threads_unread: inbox.threadsUnread ?? 0,
      },
      unread: {
        messages_total: unread.messagesTotal ?? 0,
        messages_unread: unread.messagesUnread ?? 0,
        threads_total: unread.threadsTotal ?? 0,
        threads_unread: unread.threadsUnread ?? 0,
      },
    },
    cleanup_label_status: {
      name: cleanupLabel.name || GMAIL_CLEANUP_LABEL,
      id: cleanupLabel.id || null,
      messages_total: cleanupLabel.messagesTotal ?? 0,
      messages_unread: cleanupLabel.messagesUnread ?? 0,
      threads_total: cleanupLabel.threadsTotal ?? 0,
      threads_unread: cleanupLabel.threadsUnread ?? 0,
    },
    cleanup: {
      ...cleanup,
    },
    attention_notes: cleanup.applied
      ? [`Unread inbox changed by ${cleanup.messages_matched} after subscription-style cleanup.`]
      : ['No unread inbox messages matched the subscription-style cleanup query.'],
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
    const cachedCalendar = !force ? freshDirectSnapshot(paths.snapshots.dailyCalendarWeek, ['google-calendar-direct', 'Google Calendar'], now, maxAgeMs) : null;
    const calendar = cachedCalendar || await fetchCalendarWeek({ env, fetchFn, now });
    result.calendar = calendar;
    if (!cachedCalendar && (calendar.status === 'synced' || calendar.status === 'empty')) writeJson(paths.snapshots.dailyCalendarWeek, calendar);
  } catch (err) {
    result.errors.push({ integration: 'calendar', error: err.message });
  }

  try {
    const cachedGmail = !force ? freshDirectSnapshot(paths.snapshots.dailyGmailAttention, ['gmail-direct', 'Gmail'], now, maxAgeMs) : null;
    const gmail = cachedGmail || await fetchGmailAttention({ env, fetchFn, now });
    result.gmail = gmail;
    if (!cachedGmail && gmail.status === 'ok') writeJson(paths.snapshots.dailyGmailAttention, gmail);
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
  applyGmailCleanup,
  googleDirectConfigured,
  syncDirectDailyIntegrations,
};
