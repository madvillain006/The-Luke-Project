---
component_id: 2.2
component_name: Cognitive Core & Memory Spines
---

# Cognitive Core & Memory Spines

## Component Description

The state-aggregation engine that builds a unified Brain snapshot. It transforms raw agent events into structured Spines (Automation, Career, Daily) to provide long-term context and persistent memory across the system.

---

## Key References:

### c:\Users\conor\luke\lib\brain\brain-core.js (lines 220-269)
```
function buildBrainSnapshot(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const reports = readJsonlTail(paths.events.brainReports, options.reportLimit || 20);
  const trading = buildTradingReport(paths, now);
  const automationBusiness = buildAutomationBusinessSpine({ paths, now });
  const daily = buildDailySpine({ paths, now });
  const developerStack = buildDeveloperStackSpine({ paths, now });
  const historyCareer = buildHistoryCareerSpine({ paths, now });
  const attention = [];

  if (trading.status !== 'nominal') attention.push({ agent: 'trading', blockers: trading.blockers });
  if (automationBusiness.blockers?.length) attention.push({ agent: 'automation-business', blockers: automationBusiness.blockers });
  if (developerStack.blockers?.length) attention.push({ agent: 'developer-stack', blockers: developerStack.blockers });
  if (daily.status === 'open') attention.push({ agent: 'daily', blockers: daily.checklist.filter(item => item.status === 'open').map(item => item.label) });
  if (historyCareer.blockers?.length) attention.push({ agent: 'history-career', blockers: historyCareer.blockers });
  if (!reports.length) attention.push({ agent: 'brain', blockers: ['no sub-agent reports received yet'] });

  return {
    id: 'luke-brain',
    label: 'Luke local brain',
    generated_at: now.toISOString(),
    role: 'Top-level local orchestration brain for machine/server resident Luke agents.',
    mission: [
      'Coordinate sub-agents without bypassing their safety contracts.',
      'Keep trading as a reporting sub-agent with human-gated execution.',
      'Maintain an auditable local report inbox before adding broader autonomy.',
    ],
    safety_contract: {
      local_first: true,
      human_gate_required_for_trading: true,
      unattended_broker_execution: false,
    },
    subagents: {
      trading,
      automation_business: automationBusiness,
      developer_stack: developerStack,
      daily,
      history_career: historyCareer,
    },
    report_inbox: {
      count: reports.length,
      recent: reports,
    },
    attention,
    next_actions: attention.length
      ? attention.map(item => `${item.agent}: ${item.blockers.join('; ')}`)
      : ['No immediate brain-level blocker detected.'],
  };
}
```

### c:\Users\conor\luke\lib\brain\automation-business-spine.js (lines 693-784)
```
function buildAutomationBusinessSpine(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const events = readJsonl(paths.events.automationBusinessEvents);
  const summary = summarizeEvents(events);
  const subagents = Object.fromEntries(SUBAGENTS.map(agent => [
    agent.id,
    buildSubagentStatus(agent, events),
  ]));
  const readyCount = Object.values(subagents).filter(agent => agent.status === 'ready').length;
  const blocked = Object.values(subagents).filter(agent => agent.status === 'blocked');
  const acceptedNiches = events.filter(event => event.type === 'niche_selected');
  const closedDeals = events.filter(event => event.type === 'deal_closed');
  const mrrEvents = events.filter(event => event.type === 'maintenance_mrr');
  const artifactEvents = events.filter(event => event.data?.artifact);
  const latestEvent = events
    .map(event => ({ event, ms: eventTimeMs(event) }))
    .filter(item => item.ms != null)
    .sort((a, b) => b.ms - a.ms)[0]?.event || null;
  const vagueIdeas = events.filter(event => (
    ['idea', 'vague_idea', 'automation_idea'].includes(event.type)
    && !event.data?.next_action
    && !event.data?.artifact
  ));
  const blockers = [
    ...blocked.flatMap(agent => agent.blockers),
    ...(latestEvent && isStaleEvent(latestEvent, now) ? ['automation pipeline stale for more than 7 days'] : []),
    ...vagueIdeas.map(event => `idea needs next action: ${event.summary || event.data?.idea || event.type}`),
  ];
  const buildRevenue = closedDeals.reduce((sum, event) => sum + (Number(event.value) || 0), 0);
  const maintenanceMrr = mrrEvents.reduce((sum, event) => sum + (Number(event.value) || 0), 0);

  return {
    agent: 'automation-business',
    label: 'AI Automation Business Spine',
    generated_at: now.toISOString(),
    status: blocked.length ? 'blocked' : blockers.length ? 'attention' : readyCount >= SUBAGENTS.length ? 'operational' : 'building',
    blockers,
    monthly_goal: 10000,
    operating_model: {
      starter_build_range: '$3k-$5k',
      complex_build_range: '$5k-$15k',
      maintenance_range: '$500-$1k/month',
      target_mix: '2 builds/month plus 5 maintenance clients',
    },
    recommended_start: {
      niche: 'Public history, museums, cultural orgs, and research teams',
      reason: 'Conor has domain credibility and the buyer workflows are research-heavy, repeatable, and under-automated.',
      avoid_first: ['healthcare compliance-heavy builds', 'financial advisor compliance-heavy builds', 'generic undifferentiated agency automation'],
    },
    subagents,
    capabilities: CAPABILITIES,
    default_niches: DEFAULT_NICHES,
    artifact_factory: {
      status: 'available',
      default_profile: DEFAULT_PROFILE,
      supported_outputs: CAPABILITIES.map(capability => capability.id),
    },
    pipeline: {
      events: events.length,
      by_type: summary.byType,
      by_subagent: summary.byAgent,
      selected_niche: acceptedNiches.at(-1)?.summary || acceptedNiches.at(-1)?.data?.label || null,
      build_revenue: buildRevenue,
      maintenance_mrr: maintenanceMrr,
      monthly_run_rate: buildRevenue + maintenanceMrr,
      artifacts: artifactEvents.length,
      last_event_at: latestEvent?.ts || null,
      stale_pipeline: Boolean(latestEvent && isStaleEvent(latestEvent, now)),
      ideas_without_next_action: vagueIdeas.length,
      recent_artifacts: artifactEvents.slice(-6).map(event => ({
        ts: event.ts,
        subagent: event.subagent,
        type: event.type,
        kind: event.data.artifact.kind,
        summary: event.data.artifact.summary,
      })),
      recent: events.slice(-12),
    },
    first_30_days: [
      'Week 1: build 3 context files and 5 skill files; validate one MCP workflow.',
      'Week 2: pick one niche and create one demo automation.',
      'Week 3: find one free case-study client and measure the before state.',
      'Week 4: finish case study, package offer, start daily outreach.',
    ],
    next_actions: Object.values(subagents)
      .filter(agent => agent.status !== 'ready')
      .slice(0, 4)
      .map(agent => `${agent.label}: ${agent.missing_event_types[0] || agent.blockers[0]}`)
      .concat(vagueIdeas.slice(0, 2).map(event => `Map idea to next action: ${event.summary || event.data?.idea || event.type}`)),
  };
}
```

### c:\Users\conor\luke\lib\brain\daily-spine.js (lines 124-235)
```
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
    label: 'Daily check-in spine',
    generated_at: now.toISOString(),
    date: today,
    status: checklist.some(item => item.status === 'open') ? 'open' : 'nominal',
    blockers,
    weather: options.weather || {
      status: 'needs_location',
      summary: 'Weather needs latitude and longitude',
      source: 'open-meteo',
    },
    checklist,
    pipeline: {
      checkins_today: todaysCheckins.length,
      recent_checkins: checkins.length,
      carryover_commitments: carryoverCommitments.length,
    },
    carryover_commitments: carryoverCommitments,
    next_actions: nextActions,
    things_to_know: [
      'Hard commitments and errands belong here before the day starts.',
      'Weather is advisory only; it does not drive trading decisions.',
      'Trading remains a separate human-gated sub-agent.',
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
```


## Source Files:

- `lib\brain\automation-business-spine.js`
- `lib\brain\brain-core.js`
- `lib\brain\daily-brief.js`
- `lib\brain\daily-spine.js`
- `lib\brain\developer-stack-spine.js`
- `lib\brain\history-career-spine.js`

