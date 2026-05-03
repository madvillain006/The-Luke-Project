'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  answerInquiry,
  buildBrainSnapshot,
  buildTradingReport,
  recordSubagentReport,
} = require('../lib/brain/brain-core');
const { buildDailySpine, buildWeatherUrl, recordDailyCheckin, summarizeWeather } = require('../lib/brain/daily-spine');
const { buildHistoryCareerSpine, evaluateOpportunity, recordOpportunity } = require('../lib/brain/history-career-spine');

function makePaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luke-brain-'));
  const state = path.join(root, 'state');
  const eventsDir = path.join(state, 'events');
  const snapshotsDir = path.join(state, 'snapshots');
  fs.mkdirSync(eventsDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  return {
    ROOT: root,
    STATE_DIR: state,
    EVENTS_DIR: eventsDir,
    SNAPSHOTS_DIR: snapshotsDir,
    events: {
      brainReports: path.join(eventsDir, 'brain-reports.jsonl'),
      dailyCheckins: path.join(eventsDir, 'daily-checkins.jsonl'),
      trades: path.join(eventsDir, 'trades.jsonl'),
      paperTrades: path.join(eventsDir, 'paper-trades.jsonl'),
      bobbyContext: path.join(eventsDir, 'bobby-context.jsonl'),
      discordHistory: path.join(eventsDir, 'discord-history.jsonl'),
      historyCareerFindings: path.join(eventsDir, 'history-career-findings.jsonl'),
    },
    snapshots: {
      autonomousState: path.join(snapshotsDir, 'autonomous-state.json'),
      brainState: path.join(snapshotsDir, 'brain-state.json'),
      dailySpine: path.join(snapshotsDir, 'daily-spine.json'),
      historyCareerSpine: path.join(snapshotsDir, 'history-career-spine.json'),
      schedulerHeartbeat: path.join(snapshotsDir, 'scheduler-heartbeat.json'),
      schedulerJobs: path.join(snapshotsDir, 'scheduler-jobs.json'),
    },
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
}

describe('Luke brain agent core', () => {
  it('summarizes trading as a human-gated sub-agent', () => {
    const paths = makePaths();
    const now = new Date('2026-05-02T20:00:00.000Z');
    writeJson(path.join(paths.SNAPSHOTS_DIR, 'trading-state.json'), {
      mode: 'paper',
      running: true,
      kill_day: false,
      kill_week: false,
      open_position: null,
      pending_signal: { ticker: 'ES', direction: 'LONG' },
    });
    writeJson(paths.snapshots.schedulerJobs, { jobs: [{ name: 'heartbeat' }] });
    writeJson(paths.snapshots.schedulerHeartbeat, { ts: now.toISOString() });
    appendJsonl(paths.events.bobbyContext, { ts: now.toISOString(), bias: 'BULLISH' });
    appendJsonl(paths.events.discordHistory, { date: now.toISOString(), ticker: 'ES' });

    const report = buildTradingReport(paths, now);

    expect(report.agent).toBe('trading');
    expect(report.status).toBe('nominal');
    expect(report.mode).toBe('paper');
    expect(report.staged_only).toBe(true);
    expect(report.recommendation_only).toBe(true);
    expect(report.human_gate).toBe('required');
    expect(report.pending_signal).toEqual(expect.objectContaining({ ticker: 'ES' }));
    expect(report.counts.bobby_context).toBe(1);
    expect(report.scheduler.known_jobs).toBe(1);
  });

  it('records sub-agent reports into the brain inbox and snapshot', () => {
    const paths = makePaths();
    const now = new Date('2026-05-02T21:00:00.000Z');

    const report = recordSubagentReport({
      agent: 'trading',
      status: 'reported',
      summary: 'Trading checked in',
      data: { mode: 'paper' },
    }, { paths, now });

    expect(report).toEqual(expect.objectContaining({
      ts: now.toISOString(),
      agent: 'trading',
      summary: 'Trading checked in',
    }));
    expect(fs.existsSync(paths.events.brainReports)).toBe(true);
    expect(fs.existsSync(paths.snapshots.brainState)).toBe(true);

    const snapshot = buildBrainSnapshot({ paths, now });
    expect(snapshot.report_inbox.count).toBe(1);
    expect(snapshot.report_inbox.recent[0].agent).toBe('trading');
    expect(snapshot.subagents.daily.agent).toBe('daily');
    expect(snapshot.subagents.history_career.agent).toBe('history-career');
  });

  it('routes trading inquiries to trading status without execution authority', () => {
    const paths = makePaths();
    writeJson(path.join(paths.SNAPSHOTS_DIR, 'trading-state.json'), {
      mode: 'shadow',
      running: true,
      kill_day: true,
      kill_week: false,
      open_position: null,
      pending_signal: null,
    });

    const answer = answerInquiry({ message: 'what is trading doing?' }, { paths, now: new Date('2026-05-02T22:00:00.000Z') });

    expect(answer.routed_to).toBe('trading');
    expect(answer.reply).toContain('Trading is attention');
    expect(answer.reply).toContain('Human gate: required');
    expect(answer.reply).toContain('recommendation-only: yes');
    expect(answer.reply).toContain('daily kill active');
  });

  it('builds a daily spine with check-ins and weather summary', () => {
    const paths = makePaths();
    const now = new Date('2026-05-02T13:00:00.000Z');
    recordDailyCheckin({
      summary: 'Errands and writing block',
      priorities: ['write proposal'],
      commitments: ['call at 3'],
    }, { paths, now });

    const weather = summarizeWeather({
      current: { temperature_2m: 71.2, apparent_temperature: 70.8, wind_speed_10m: 8 },
      daily: { temperature_2m_max: [76.4], temperature_2m_min: [58.1], precipitation_probability_max: [20] },
    });
    const spine = buildDailySpine({ paths, now, weather });

    expect(spine.agent).toBe('daily');
    expect(spine.weather.summary).toContain('71F');
    expect(spine.checklist.find(item => item.id === 'daily-checkin').status).toBe('done');
    expect(buildWeatherUrl({ lat: 40, lon: -75 })).toContain('latitude=40');
  });

  it('filters MLIS opportunities and keeps public-history adjacent tracks', () => {
    const paths = makePaths();
    const accepted = recordOpportunity({
      title: 'Museum Collections Researcher',
      organization: 'City History Museum',
      description: 'Public history research and exhibit support.',
    }, { paths, now: new Date('2026-05-02T14:00:00.000Z') });
    const rejected = recordOpportunity({
      title: 'Archivist',
      description: 'Requires MLIS from an ALA-accredited program.',
    }, { paths, now: new Date('2026-05-02T14:05:00.000Z') });

    expect(accepted.accepted).toBe(true);
    expect(rejected.accepted).toBe(false);
    expect(evaluateOpportunity({ title: 'Digital humanities AI researcher' }).track).toBe('ai-engineering-adjacent');

    const spine = buildHistoryCareerSpine({ paths, now: new Date('2026-05-02T14:10:00.000Z') });
    expect(spine.credential_filter.exclude_mlis).toBe(true);
    expect(spine.pipeline.accepted).toBe(1);
    expect(spine.pipeline.rejected_mlis).toBe(1);
    expect(spine.next_searches.some(item => item.query.includes('public history'))).toBe(true);
  });

  it('rejects reports without an agent name', () => {
    const paths = makePaths();
    expect(() => recordSubagentReport({ summary: 'missing agent' }, { paths })).toThrow('agent is required');
  });
});
