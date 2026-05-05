'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  fetchCalendarWeek,
  fetchGmailAttention,
  googleDirectConfigured,
  syncDirectDailyIntegrations,
} = require('../lib/google-direct');

function response(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return body; },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  };
}

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-google-direct-'));
  return {
    root,
    snapshots: {
      dailyCalendarWeek: path.join(root, 'state', 'snapshots', 'daily-calendar-week.json'),
      dailyGmailAttention: path.join(root, 'state', 'snapshots', 'daily-gmail-attention.json'),
    },
  };
}

describe('direct Google integrations', () => {
  it('reports calendar/gmail direct availability from OAuth or API key env', () => {
    expect(googleDirectConfigured({})).toMatchObject({ calendar: false, gmail: false });
    expect(googleDirectConfigured({ GOOGLE_API_KEY: 'key' })).toMatchObject({ calendar: true, gmail: false, api_key_calendar: true });
    expect(googleDirectConfigured({ GOOGLE_ACCESS_TOKEN: 'token' })).toMatchObject({ calendar: true, gmail: true, oauth: true });
  });

  it('fetches a direct Google Calendar week and normalizes events', async () => {
    const seen = [];
    const calendar = await fetchCalendarWeek({
      env: { GOOGLE_ACCESS_TOKEN: 'token', GOOGLE_CALENDAR_ID: 'primary' },
      now: new Date('2026-05-05T12:00:00.000Z'),
      fetchFn: async (url, options) => {
        seen.push({ url, options });
        return response({
          items: [{
            id: 'event-1',
            summary: 'Museum call',
            start: { dateTime: '2026-05-06T10:00:00-04:00' },
            end: { dateTime: '2026-05-06T10:30:00-04:00' },
            location: 'Knoxville',
          }],
        });
      },
    });

    expect(calendar.status).toBe('synced');
    expect(calendar.source).toBe('google-calendar-direct');
    expect(calendar.events[0]).toMatchObject({ title: 'Museum call', location: 'Knoxville' });
    expect(seen[0].options.headers.Authorization).toBe('Bearer token');
  });

  it('fetches Gmail unread counts and cleanup estimate without deleting mail', async () => {
    const gmail = await fetchGmailAttention({
      env: { GOOGLE_ACCESS_TOKEN: 'token' },
      fetchFn: async url => {
        if (String(url).includes('/labels/INBOX')) return response({ messagesUnread: 10 });
        if (String(url).includes('/labels/UNREAD')) return response({ messagesTotal: 50 });
        return response({ resultSizeEstimate: 7 });
      },
    });

    expect(gmail.status).toBe('synced');
    expect(gmail.unread_inbox).toBe(10);
    expect(gmail.cleanup.status).toBe('estimate_only');
    expect(gmail.cleanup.action).toContain('not permanent deletion');
    expect(gmail.attention[0]).toContain('7 unread');
  });

  it('writes direct daily snapshots only for synced integrations', async () => {
    const paths = makePaths();
    let calls = 0;
    const result = await syncDirectDailyIntegrations({
      paths,
      env: { GOOGLE_ACCESS_TOKEN: 'token' },
      now: new Date('2026-05-05T12:00:00.000Z'),
      fetchFn: async url => {
        calls += 1;
        if (String(url).includes('calendar')) return response({ items: [] });
        if (String(url).includes('/labels/INBOX')) return response({ messagesUnread: 2 });
        if (String(url).includes('/labels/UNREAD')) return response({ messagesTotal: 4 });
        return response({ resultSizeEstimate: 0 });
      },
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths.snapshots.dailyCalendarWeek, 'utf8')).source).toBe('google-calendar-direct');
    expect(JSON.parse(fs.readFileSync(paths.snapshots.dailyGmailAttention, 'utf8')).source).toBe('gmail-direct');
    const cached = await syncDirectDailyIntegrations({
      paths,
      env: { GOOGLE_ACCESS_TOKEN: 'token' },
      now: new Date('2026-05-05T12:05:00.000Z'),
      fetchFn: async () => {
        throw new Error('should use fresh cache');
      },
    });
    expect(cached.calendar.cached).toBe(true);
    expect(cached.gmail.cached).toBe(true);
    expect(calls).toBe(4);
    fs.rmSync(paths.root, { recursive: true, force: true });
  });
});
