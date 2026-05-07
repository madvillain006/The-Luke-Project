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
const {
  buildAutomationArtifact,
  buildAutomationBusinessSpine,
  buildCaseStudyPlan,
  buildContextFile,
  buildOfferPackage,
  buildMcpWorkflow,
  buildNichePlan,
  buildScheduledAutomation,
  buildSkillFile,
  draftOutreach,
  evaluateNiche,
  qualifyLead,
  recordAutomationEvent,
} = require('../lib/brain/automation-business-spine');
const {
  buildDailyBrief,
  fetchDailyNews,
  formatBriefForNotification,
  getDailyNewsConfig,
  parseFeedItems,
} = require('../lib/brain/daily-brief');
const {
  buildDeveloperStackSpine,
  recordDeveloperStackEvent,
} = require('../lib/brain/developer-stack-spine');
const {
  DEFAULT_LOCATION,
  DEFAULT_WEATHER_LOCATIONS,
  buildDailySpine,
  buildWeatherUrl,
  fetchWeatherForLocations,
  fetchWeather,
  recordDailyCheckin,
  summarizeWeather,
  weatherCodeText,
} = require('../lib/brain/daily-spine');
const {
  buildHistoryCareerSpine,
  evaluateOpportunity,
  fetchPublicHistoryJobLeads,
  recordOpportunity,
} = require('../lib/brain/history-career-spine');

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
      developerStackEvents: path.join(eventsDir, 'developer-stack-events.jsonl'),
      trades: path.join(eventsDir, 'trades.jsonl'),
      paperTrades: path.join(eventsDir, 'paper-trades.jsonl'),
      bobbyContext: path.join(eventsDir, 'bobby-context.jsonl'),
      discordHistory: path.join(eventsDir, 'discord-history.jsonl'),
      historyCareerFindings: path.join(eventsDir, 'history-career-findings.jsonl'),
      automationBusinessEvents: path.join(eventsDir, 'automation-business-events.jsonl'),
    },
    snapshots: {
      autonomousState: path.join(snapshotsDir, 'autonomous-state.json'),
      brainState: path.join(snapshotsDir, 'brain-state.json'),
      dailySpine: path.join(snapshotsDir, 'daily-spine.json'),
      developerStackSpine: path.join(snapshotsDir, 'developer-stack-spine.json'),
      historyCareerSpine: path.join(snapshotsDir, 'history-career-spine.json'),
      automationBusinessSpine: path.join(snapshotsDir, 'automation-business-spine.json'),
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
    expect(report.stale_data_warnings).toEqual([]);
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
    expect(snapshot.subagents.developer_stack.agent).toBe('developer-stack');
    expect(snapshot.subagents.history_career.agent).toBe('history-career');
    expect(snapshot.subagents.automation_business.agent).toBe('automation-business');
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

  it('builds a daily spine with static brief state and weather summary', () => {
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
    expect(Array.isArray(spine.blockers)).toBe(true);
    expect(spine.next_actions.length).toBeGreaterThan(0);
    expect(spine.pipeline.checkins_today).toBe(1);
    expect(spine.date_label).toContain('May');
    expect(spine.personal_note).toBe('I love Kat');
    expect(spine.move_prompt.label).toBe('Move to Tennessee');
    expect(spine.schedule.status).toBe('not_connected');
    expect(spine.mail_attention.cleanup.action).toContain('Label and archive');
    expect(spine.weather.summary).toContain('71F');
    expect(spine.weather.summary).toContain('unknown');
    expect(spine.checklist.find(item => item.id === 'daily-checkin').status).toBe('done');
    expect(buildDailySpine({ paths: makePaths(), now }).checklist.find(item => item.id === 'daily-checkin').status).toBe('static');
    expect(spine.briefs.morning.endpoint).toContain('kind=morning');
    expect(spine.live_news.social_watchlist.some(item => item.id === 'deitaone')).toBe(true);
    expect(buildWeatherUrl({ lat: 40, lon: -75 })).toContain('latitude=40');
  });

  it('extracts public history job leads from source pages', async () => {
    const leads = await fetchPublicHistoryJobLeads({
      sources: [{ label: 'Test public history source', url: 'https://example.test/jobs' }],
      fetchFn: async () => ({
        ok: true,
        text: async () => [
          '<a href="/">Test public history source</a>',
          '<a href="/submit">Submit a Job</a>',
          '<a href="/2026/05/05/project-archivist">May 5, 2026 May 5, 2026</a>',
          '<a href="/2026/05/05/project-archivist#more">Continue reading &#8220;Project Archivist&#8221;</a>',
          '<a href="/job/digitization-technician">Digitization Technician, Collections</a>',
          '<a href="/job/librarian">Assistant Librarian: Reference Archivist</a>',
          '<a href="/job/mlis">MLIS Librarian</a>',
        ].join(''),
      }),
    });

    expect(leads.status).toBe('ok');
    expect(leads.leads).toHaveLength(1);
    expect(leads.leads[0]).toMatchObject({ title: 'Digitization Technician, Collections', source: 'Test public history source' });
  });

  it('builds weather for the daily window locations', async () => {
    const calls = [];
    const weather = await fetchWeatherForLocations({
      locations: DEFAULT_WEATHER_LOCATIONS,
      fetchFn: async url => {
        calls.push(url);
        return {
          ok: true,
          json: async () => ({
            current: { temperature_2m: 60, apparent_temperature: 58, weather_code: 3, wind_speed_10m: 6 },
            daily: { temperature_2m_max: [66], temperature_2m_min: [48], precipitation_probability_max: [30] },
          }),
        };
      },
    });

    expect(weather.map(item => item.location)).toEqual(['Buffalo, NY', 'Knoxville, TN', 'Wilmington, NC']);
    expect(calls.length).toBe(3);
  });

  it('defaults weather to Buffalo through Open-Meteo when no location is supplied', async () => {
    let requestedUrl = null;
    const weather = await fetchWeather({
      fetchFn: async url => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => ({
            current: { temperature_2m: 41, apparent_temperature: 36, weather_code: 3, wind_speed_10m: 11 },
            daily: { temperature_2m_max: [43], temperature_2m_min: [34], precipitation_probability_max: [20] },
          }),
        };
      },
    });

    expect(DEFAULT_LOCATION.label).toBe('Buffalo, NY');
    expect(requestedUrl).toContain('latitude=42.8864');
    expect(requestedUrl).toContain('longitude=-78.8784');
    expect(weather.summary).toContain('41F and cloudy');
    expect(weather.location).toBe('Buffalo, NY');
    expect(weatherCodeText(3)).toBe('cloudy');
  });

  it('builds morning and afternoon briefs from live news feeds', async () => {
    const marketXml = `
      <rss><channel>
        <item>
          <title>Market&apos;s Fed headline moves S&amp;P futures</title>
          <link>https://example.com/markets</link>
          <description>Yields moved after a fresh policy headline.</description>
          <pubDate>Sat, 02 May 2026 13:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;
    const billsXml = `
      <rss><channel>
        <item>
          <title>Bills add receiver before camp</title>
          <link>https://example.com/bills</link>
          <description>Buffalo adds roster depth for Josh Allen.</description>
          <pubDate>Sat, 02 May 2026 14:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;
    const sources = [
      { id: 'mock-market', label: 'Mock Markets', category: 'markets', url: 'https://feed.test/markets', priority: 90, keywords: ['fed'] },
      { id: 'mock-bills', label: 'Mock Bills', category: 'bills', url: 'https://feed.test/bills', priority: 90, keywords: ['bills'] },
    ];
    const fetchFn = async url => ({
      ok: true,
      text: async () => String(url).includes('bills') ? billsXml : marketXml,
    });

    const news = await fetchDailyNews({
      sources,
      categories: ['markets', 'bills'],
      fetchFn,
      now: new Date('2026-05-02T15:00:00.000Z'),
    });
    const brief = buildDailyBrief({
      kind: 'afternoon',
      news,
      weather: { summary: '71F and clear' },
      now: new Date('2026-05-02T15:00:00.000Z'),
    });

    expect(news.status).toBe('ok');
    expect(news.by_category.markets[0].title).toContain("Market's Fed headline");
    expect(news.by_category.markets[0].title).not.toContain('&apos;');
    expect(news.by_category.bills[0].title).toContain('Bills add receiver');
    expect(brief.label).toBe('Afternoon brief');
    expect(brief.sections.find(section => section.category === 'markets').status).toBe('live');
    expect(formatBriefForNotification(brief)).toContain('AFTERNOON BRIEF');
  });

  it('keeps social wire feeds configurable without hard-coding X access', () => {
    const config = getDailyNewsConfig({
      env: {
        LUKE_DEITAONE_FEED_URL: 'https://feeds.test/deitaone.xml',
        LUKE_SCHEFTER_FEED_URL: 'https://feeds.test/schefter.xml',
      },
    });
    const items = parseFeedItems('<feed><entry><title>Adam Schefter: Bills injury update</title><link href="https://example.com/schefter"/></entry></feed>', {
      id: 'schefter-feed',
      label: 'Adam Schefter',
      category: 'nfl',
    });

    expect(config.sources.some(source => source.id === 'deitaone-feed')).toBe(true);
    expect(config.sources.some(source => source.id === 'schefter-feed')).toBe(true);
    expect(config.social_watchlist.find(source => source.id === 'schefter').configured).toBe(true);
    expect(items[0]).toEqual(expect.objectContaining({ source: 'Adam Schefter', category: 'nfl' }));
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

  it('builds the automation business spine as a large brain sub-agent', () => {
    const paths = makePaths();
    const spine = buildAutomationBusinessSpine({ paths, now: new Date('2026-05-02T15:00:00.000Z') });

    expect(spine.agent).toBe('automation-business');
    expect(spine.status).toBe('building');
    expect(spine.blockers).toEqual([]);
    expect(Object.keys(spine.subagents)).toEqual([
      'toolkit',
      'niche',
      'case-study',
      'offer',
      'leads',
      'outreach',
      'delivery',
      'revenue',
    ]);
    expect(spine.monthly_goal).toBe(10000);
    expect(spine.artifact_factory.status).toBe('available');
    expect(spine.capabilities.some(capability => capability.id === 'context-file')).toBe(true);
    expect(spine.capabilities.some(capability => capability.id === 'mcp-workflow')).toBe(true);
    expect(spine.capabilities.some(capability => capability.id === 'scheduled-automation')).toBe(true);
    expect(spine.recommended_start.niche).toContain('Public history');
    expect(spine.first_30_days).toHaveLength(4);
  });

  it('builds the developer stack spine with hosted and local fallback order', () => {
    const paths = makePaths();
    const spine = buildDeveloperStackSpine({
      paths,
      now: new Date('2026-05-02T18:00:00.000Z'),
      env: {
        ANTHROPIC_API_KEY: 'anthropic-test',
        GEMINI_API_KEY: 'gemini-test',
      },
    });

    expect(spine.agent).toBe('developer-stack');
    expect(spine.status).toBe('building');
    expect(spine.provider_order.map(provider => provider.id)).toEqual(['gemini', 'groq', 'deepseek', 'ollama', 'claude']);
    expect(spine.provider_order.find(provider => provider.id === 'claude').configured).toBe(true);
    expect(spine.provider_order.find(provider => provider.id === 'claude').lane).toBe('remote/API');
    expect(spine.provider_order.find(provider => provider.id === 'gemini').configured).toBe(true);
    expect(spine.provider_order.find(provider => provider.id === 'groq').configured).toBe(false);
    expect(spine.provider_order.find(provider => provider.id === 'deepseek').configured).toBe(false);
    expect(spine.provider_order.find(provider => provider.id === 'ollama').lane).toBe('local/private');
    expect(spine.local_only_truth).toContain('Only the Ollama/local-model lane');
    expect(Object.keys(spine.subagents)).toEqual([
      'provider-router',
      'local-runtime',
      'gemini-key',
      'cost-guard',
      'privacy-guard',
    ]);
  });

  it('records developer stack events and refreshes its snapshot', () => {
    const paths = makePaths();
    const now = new Date('2026-05-02T18:30:00.000Z');

    const event = recordDeveloperStackEvent({
      subagent: 'local-runtime',
      type: 'ollama_installed',
      summary: 'Ollama installed locally',
    }, { paths, now });

    expect(event).toEqual(expect.objectContaining({
      ts: now.toISOString(),
      subagent: 'local-runtime',
      type: 'ollama_installed',
    }));
    expect(fs.existsSync(paths.events.developerStackEvents)).toBe(true);
    expect(fs.existsSync(paths.snapshots.developerStackSpine)).toBe(true);

    const spine = buildDeveloperStackSpine({ paths, now });
    expect(spine.pipeline.events).toBe(1);
    expect(spine.subagents['local-runtime'].completed_event_types).toContain('ollama_installed');
  });

  it('reports developer stack blockers without halting the brain when no provider lane is configured', () => {
    const paths = makePaths();
    const spine = buildDeveloperStackSpine({
      paths,
      now: new Date('2026-05-02T18:45:00.000Z'),
      env: {},
    });

    expect(spine.status).toBe('degraded');
    expect(spine.blockers).toContain('no developer LLM providers configured');
    expect(spine.health_checks.ollama_runtime).toBe('not_checked');
  });

  it('records automation business events and refreshes its snapshot', () => {
    const paths = makePaths();
    const now = new Date('2026-05-02T16:00:00.000Z');

    const event = recordAutomationEvent({
      subagent: 'toolkit',
      type: 'context_file',
      summary: 'Museum context file drafted',
    }, { paths, now });

    expect(event).toEqual(expect.objectContaining({
      ts: now.toISOString(),
      subagent: 'toolkit',
      type: 'context_file',
    }));
    expect(fs.existsSync(paths.events.automationBusinessEvents)).toBe(true);
    expect(fs.existsSync(paths.snapshots.automationBusinessSpine)).toBe(true);

    const spine = buildAutomationBusinessSpine({ paths, now });
    expect(spine.pipeline.events).toBe(1);
    expect(spine.subagents.toolkit.completed_event_types).toContain('context_file');
  });

  it('flags automation ideas that have no next action', () => {
    const paths = makePaths();
    appendJsonl(paths.events.automationBusinessEvents, {
      ts: '2026-05-02T16:00:00.000Z',
      subagent: 'niche',
      type: 'automation_idea',
      summary: 'Automate museum newsletters somehow',
      data: {},
    });

    const spine = buildAutomationBusinessSpine({ paths, now: new Date('2026-05-02T16:05:00.000Z') });

    expect(spine.status).toBe('attention');
    expect(spine.blockers[0]).toContain('idea needs next action');
    expect(spine.pipeline.ideas_without_next_action).toBe(1);
  });

  it('scores automation niches with a conservative recommendation', () => {
    expect(evaluateNiche({
      niche: 'museum research automation',
      scores: {
        workflow_fit: 5,
        budget: 4,
        domain_advantage: 5,
        low_compliance_drag: 5,
        not_too_technical: 4,
      },
    }).recommendation).toBe('strong');

    expect(evaluateNiche({
      niche: 'small local group',
      scores: {
        workflow_fit: 2,
        budget: 1,
        domain_advantage: 4,
        low_compliance_drag: 4,
        not_too_technical: 4,
      },
    }).recommendation).toBe('park');
  });

  it('generates usable automation business artifacts', () => {
    const input = {
      organization: 'City History Museum',
      workflow: 'exhibit research brief production',
      signals: ['weekly research backlog', 'grant deadline', 'director contact'],
      manual_minutes: 180,
      automated_minutes: 25,
      weekly_saved_hours: 8,
    };

    const context = buildContextFile(input);
    const skill = buildSkillFile(input);
    const mcp = buildMcpWorkflow(input);
    const schedule = buildScheduledAutomation(input);
    const niche = buildNichePlan();
    const caseStudy = buildCaseStudyPlan(input);
    const offer = buildOfferPackage(input);
    const lead = qualifyLead(input);
    const outreach = draftOutreach({ ...input, contact_name: 'Alex' });

    expect(context.filename).toBe('city-history-museum-context.md');
    expect(context.markdown).toContain('## Quality Standards');
    expect(skill.markdown).toContain('## Process');
    expect(mcp.tool_chain.length).toBeGreaterThan(2);
    expect(schedule.missing_data_behavior).toContain('Do not hallucinate missing source facts.');
    expect(niche.first_10_leads).toContain('regional history museums');
    expect(caseStudy.metrics.weekly_saved_hours).toBeGreaterThan(0);
    expect(offer.value_case.recommended_build_price).toBeGreaterThanOrEqual(3000);
    expect(lead.priority).toBe('high');
    expect(outreach.cold_email).toContain('Alex');
  });

  it('dispatches and records generated automation artifacts', () => {
    const paths = makePaths();
    const result = buildAutomationArtifact({
      kind: 'outreach',
      organization: 'City History Museum',
      workflow: 'donor newsletter drafting',
      contact_name: 'Morgan',
    }, { paths, now: new Date('2026-05-02T18:00:00.000Z') });

    expect(result.artifact.kind).toBe('outreach_draft');
    expect(result.event.subagent).toBe('outreach');
    expect(result.event.type).toBe('outreach_sent');

    const spine = buildAutomationBusinessSpine({ paths, now: new Date('2026-05-02T18:01:00.000Z') });
    expect(spine.pipeline.artifacts).toBe(1);
    expect(spine.pipeline.recent_artifacts[0].kind).toBe('outreach_draft');
  });

  it('routes automation business inquiries to the automation-business sub-agent', () => {
    const paths = makePaths();
    const answer = answerInquiry({
      message: 'what niche and outreach should the AI automation business do next?',
    }, { paths, now: new Date('2026-05-02T17:00:00.000Z') });

    expect(answer.routed_to).toBe('automation-business');
    expect(answer.reply).toContain('Automation-business sub-agent');
    expect(answer.reply).toContain('Public history');
    expect(answer.snapshot.subagents.automation_business.agent).toBe('automation-business');
  });

  it('flags closed history-career opportunities that are missing a reason', () => {
    const paths = makePaths();
    appendJsonl(paths.events.historyCareerFindings, {
      ts: '2026-05-02T14:00:00.000Z',
      title: 'Museum Research Lead',
      accepted: true,
      track: 'museum-curatorial',
      status: 'closed',
    });

    const spine = buildHistoryCareerSpine({ paths, now: new Date('2026-05-02T14:10:00.000Z') });

    expect(spine.status).toBe('attention');
    expect(spine.blockers[0]).toContain('closed opportunity missing reason');
    expect(spine.pipeline.closed_without_reason).toBe(1);
  });

  it('routes Claude, Gemini, and Ollama inquiries to the developer-stack sub-agent', () => {
    const paths = makePaths();
    const answer = answerInquiry({
      message: 'make a Claude Code fallback ladder with Gemini and Ollama local model',
    }, {
      paths,
      now: new Date('2026-05-02T19:00:00.000Z'),
    });

    expect(answer.routed_to).toBe('developer-stack');
    expect(answer.reply).toContain('Developer stack spine');
    expect(answer.reply).toContain('Regular Claude');
    expect(answer.reply).toContain('Gemini API');
    expect(answer.reply).toContain('Ollama local open model');
  });

  it('rejects reports without an agent name', () => {
    const paths = makePaths();
    expect(() => recordSubagentReport({ summary: 'missing agent' }, { paths })).toThrow('agent is required');
  });
});
