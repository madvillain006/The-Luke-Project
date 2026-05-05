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
        const text = String(url);
        if (text.includes('/messages?')) return response({ messages: [{ id: 'm1' }, { id: 'm2' }] });
        if (text.includes('/labels')) return response({ labels: [{ id: 'Label_6', name: 'Luke/Cleanup/Unread Non-Substack Subscriptions' }] });
        if (text.includes('/messages/batchModify')) return response({});
        if (text.includes('/labels/INBOX')) return response({ name: 'INBOX', messagesUnread: 10, messagesTotal: 20, threadsTotal: 4, threadsUnread: 2 });
        if (text.includes('/labels/UNREAD')) return response({ name: 'UNREAD', messagesUnread: 50, messagesTotal: 50, threadsTotal: 10, threadsUnread: 10 });
        if (text.includes('/labels/Luke%2FCleanup%2FUnread%20Non-Substack%20Subscriptions')) return response({ id: 'Label_6', name: 'Luke/Cleanup/Unread Non-Substack Subscriptions', messagesUnread: 7, messagesTotal: 7, threadsTotal: 3, threadsUnread: 3 });
        return response({});
      },
    });

    expect(gmail.status).toBe('ok');
    expect(gmail.counts.inbox.messages_unread).toBe(10);
    expect(gmail.cleanup.applied).toBe(true);
    expect(gmail.cleanup.archived).toBe(true);
    expect(gmail.cleanup.messages_matched).toBe(2);
    expect(gmail.attention_notes[0]).toContain('2 after subscription-style cleanup');
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
        const text = String(url);
        if (text.includes('calendar')) return response({ items: [] });
        if (text.includes('/messages?')) return response({ messages: [] });
        if (text.includes('/labels/INBOX')) return response({ name: 'INBOX', messagesUnread: 2, messagesTotal: 2, threadsTotal: 1, threadsUnread: 1 });
        if (text.includes('/labels/UNREAD')) return response({ name: 'UNREAD', messagesUnread: 4, messagesTotal: 4, threadsTotal: 2, threadsUnread: 2 });
        if (text.includes('/labels/Luke%2FCleanup%2FUnread%20Non-Substack%20Subscriptions')) return response({ id: 'Label_6', name: 'Luke/Cleanup/Unread Non-Substack Subscriptions', messagesUnread: 0, messagesTotal: 0, threadsTotal: 0, threadsUnread: 0 });
        return response({});
      },
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths.snapshots.dailyCalendarWeek, 'utf8')).source.app).toBe('Google Calendar');
    expect(JSON.parse(fs.readFileSync(paths.snapshots.dailyGmailAttention, 'utf8')).source.app).toBe('Gmail');
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
    expect(calls).toBe(5);
    fs.rmSync(paths.root, { recursive: true, force: true });
  });
});
