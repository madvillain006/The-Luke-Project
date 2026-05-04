'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');

const SUBAGENTS = [
  {
    id: 'toolkit',
    label: 'Automation Toolkit',
    owns: ['context files', 'skill files', 'MCP workflows', 'scheduled automations'],
    done_events: ['context_file', 'skill_file', 'mcp_workflow', 'scheduled_automation'],
  },
  {
    id: 'niche',
    label: 'Niche Selection',
    owns: ['niche scoring', 'pain mapping', 'buying power', 'first market choice'],
    done_events: ['niche_candidate', 'niche_selected'],
  },
  {
    id: 'case-study',
    label: 'Case Study',
    owns: ['free proof client', 'time saved', 'testimonial', 'before after proof'],
    done_events: ['case_study_client', 'case_study_result'],
  },
  {
    id: 'offer',
    label: 'Offer Packaging',
    owns: ['scope', 'pricing', 'proposal', 'support terms'],
    done_events: ['offer_package', 'proposal_template'],
  },
  {
    id: 'leads',
    label: 'Lead Research',
    owns: ['qualified leads', 'pain hypotheses', 'contact path'],
    done_events: ['lead'],
  },
  {
    id: 'outreach',
    label: 'Outreach',
    owns: ['daily outbound', 'content hooks', 'referrals', 'booked calls'],
    done_events: ['outreach_sent', 'call_booked', 'referral'],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    owns: ['discovery', 'workflow map', 'build plan', 'handoff docs', 'support'],
    done_events: ['client_delivery', 'handoff'],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    owns: ['closed builds', 'maintenance MRR', 'monthly target'],
    done_events: ['deal_closed', 'maintenance_mrr'],
  },
];

const NICHE_RULES = [
  { id: 'workflow_fit', label: 'Repeatable workflow fit', weight: 3 },
  { id: 'budget', label: 'Can pay 3000-5000+', weight: 3 },
  { id: 'domain_advantage', label: 'Conor has domain advantage', weight: 2 },
  { id: 'low_compliance_drag', label: 'Low compliance drag', weight: 2 },
  { id: 'not_too_technical', label: 'Buyer will not just build it themselves', weight: 2 },
];

const DEFAULT_NICHES = [
  {
    id: 'public-history-museums',
    label: 'Public history, museums, and cultural orgs',
    strengths: ['domain credibility', 'research workflows', 'under-resourced teams', 'differentiated offer'],
    automation_ideas: ['grant draft prep', 'exhibit research briefs', 'collections summary workflows', 'donor/newsletter drafts', 'oral history processing'],
    score: 11,
  },
  {
    id: 'marketing-agencies',
    label: 'Marketing agencies',
    strengths: ['high pain', 'clear reporting workflows', 'strong budget'],
    automation_ideas: ['client reports', 'SEO briefs', 'content repurposing', 'competitive scans'],
    score: 9,
  },
  {
    id: 'professional-services',
    label: 'Professional services',
    strengths: ['repeatable documents', 'proposal workflows', 'client onboarding'],
    automation_ideas: ['proposal drafts', 'SOP generation', 'billing narratives', 'client prep'],
    score: 8,
  },
];

const CAPABILITIES = [
  {
    id: 'context-file',
    label: 'Context File Draft',
    endpoint: '/agent/brain/automation-business/context-file',
    subagent: 'toolkit',
    event_type: 'context_file',
  },
  {
    id: 'skill-file',
    label: 'Skill File Draft',
    endpoint: '/agent/brain/automation-business/skill-file',
    subagent: 'toolkit',
    event_type: 'skill_file',
  },
  {
    id: 'mcp-workflow',
    label: 'MCP Workflow Design',
    endpoint: '/agent/brain/automation-business/mcp-workflow',
    subagent: 'toolkit',
    event_type: 'mcp_workflow',
  },
  {
    id: 'scheduled-automation',
    label: 'Scheduled Automation Design',
    endpoint: '/agent/brain/automation-business/scheduled-automation',
    subagent: 'toolkit',
    event_type: 'scheduled_automation',
  },
  {
    id: 'niche-plan',
    label: 'Niche Plan',
    endpoint: '/agent/brain/automation-business/niche-plan',
    subagent: 'niche',
    event_type: 'niche_candidate',
  },
  {
    id: 'case-study',
    label: 'Case Study Plan',
    endpoint: '/agent/brain/automation-business/case-study',
    subagent: 'case-study',
    event_type: 'case_study_result',
  },
  {
    id: 'offer',
    label: 'Offer Package',
    endpoint: '/agent/brain/automation-business/offer',
    subagent: 'offer',
    event_type: 'offer_package',
  },
  {
    id: 'lead-qualify',
    label: 'Lead Qualification',
    endpoint: '/agent/brain/automation-business/lead/qualify',
    subagent: 'leads',
    event_type: 'lead',
  },
  {
    id: 'outreach',
    label: 'Outreach Draft',
    endpoint: '/agent/brain/automation-business/outreach',
    subagent: 'outreach',
    event_type: 'outreach_sent',
  },
  {
    id: 'delivery-plan',
    label: 'Delivery Plan',
    endpoint: '/agent/brain/automation-business/delivery-plan',
    subagent: 'delivery',
    event_type: 'client_delivery',
  },
];

const DEFAULT_PROFILE = {
  organization: 'regional history museum',
  niche: 'public history, museums, cultural orgs, and research teams',
  workflow: 'research brief and public-facing content preparation',
  audience: ['museum director', 'curator', 'public historian', 'development lead'],
  voice: 'clear, competent, practical, and evidence-driven',
  pain_points: [
    'research takes too long to turn into usable briefs',
    'grant, donor, and exhibit copy gets rewritten from scratch',
    'institutional knowledge is scattered across documents and inboxes',
  ],
  quality_standards: [
    'preserve citations and uncertainty',
    'separate evidence from interpretation',
    'write in the client voice',
    'surface missing inputs instead of inventing facts',
  ],
};

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function asList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
  }
  return [...fallback];
}

function slug(value) {
  return String(value || 'automation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'automation';
}

function money(value) {
  const amount = Number(value) || 0;
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function section(title, lines) {
  const body = asList(lines).map(line => `- ${line}`).join('\n');
  return `## ${title}\n${body || '- None provided'}`;
}

function buildClientProfile(input = {}) {
  return {
    organization: input.organization || input.client || DEFAULT_PROFILE.organization,
    niche: input.niche || DEFAULT_PROFILE.niche,
    workflow: input.workflow || input.task || DEFAULT_PROFILE.workflow,
    audience: asList(input.audience, DEFAULT_PROFILE.audience),
    voice: input.voice || DEFAULT_PROFILE.voice,
    pain_points: asList(input.pain_points || input.pains, DEFAULT_PROFILE.pain_points),
    current_projects: asList(input.current_projects || input.projects, [
      'pilot automation for one recurring workflow',
      'case-study measurement for time saved and quality lift',
    ]),
    quality_standards: asList(input.quality_standards || input.standards, DEFAULT_PROFILE.quality_standards),
    tools: asList(input.tools, ['Claude or Codex', 'Google Drive', 'email', 'web research']),
  };
}

function artifactEnvelope(kind, profile, body) {
  return {
    kind,
    generated_at: new Date().toISOString(),
    profile,
    ...body,
  };
}

function buildContextFile(input = {}) {
  const profile = buildClientProfile(input);
  const filename = `${slug(profile.organization)}-context.md`;
  const markdown = [
    `# Context File: ${profile.organization}`,
    '',
    `Business description: ${profile.organization} operates in ${profile.niche}.`,
    '',
    section('Audience Profile', profile.audience),
    '',
    section('Current Workflow', [profile.workflow]),
    '',
    section('Pain Points', profile.pain_points),
    '',
    section('Current Projects', profile.current_projects),
    '',
    section('Voice And Tone', [profile.voice]),
    '',
    section('Quality Standards', profile.quality_standards),
    '',
    section('Tooling Assumptions', profile.tools),
    '',
    '## Automation Boundaries',
    '- Ask for missing source material before drafting factual claims.',
    '- Preserve citations, source names, dates, and uncertainty.',
    '- Produce review-ready drafts, not final publication without human approval.',
  ].join('\n');

  return artifactEnvelope('context_file', profile, {
    filename,
    summary: `Context file for ${profile.organization}`,
    markdown,
    quality_checks: [
      'Does it identify the buyer and audience?',
      'Does it preserve citation and uncertainty standards?',
      'Does it state what the automation must not invent?',
    ],
  });
}

function buildSkillFile(input = {}) {
  const profile = buildClientProfile(input);
  const task = input.task || profile.workflow;
  const filename = `${slug(task)}-skill.md`;
  const processSteps = asList(input.process_steps, [
    'Inspect the client context file and identify missing inputs.',
    'Ingest source documents, notes, URLs, transcripts, or emails.',
    'Extract facts, dates, names, claims, and open questions.',
    'Draft the requested artifact in the client voice.',
    'Run quality checks before returning the final answer.',
  ]);
  const outputSections = asList(input.output_sections, [
    'Executive summary',
    'Source-backed findings',
    'Draft output',
    'Open questions',
    'Quality check result',
  ]);
  const markdown = [
    `# Skill File: ${task}`,
    '',
    `Use this skill when asked to automate ${task} for ${profile.organization}.`,
    '',
    section('Inputs Required', asList(input.inputs_required, [
      'client context file',
      'source material or URLs',
      'desired output format',
      'deadline or use case',
    ])),
    '',
    section('Process', processSteps.map((step, index) => `${index + 1}. ${step}`)),
    '',
    section('Output Format', outputSections),
    '',
    section('Edge Cases', asList(input.edge_cases, [
      'If source material is missing, ask for it.',
      'If a claim lacks support, mark it as unverified.',
      'If the output conflicts with the context file, follow the context file.',
    ])),
    '',
    section('Quality Checks', asList(input.quality_checks, profile.quality_standards)),
  ].join('\n');

  return artifactEnvelope('skill_file', profile, {
    filename,
    summary: `Skill file for ${task}`,
    markdown,
    test_inputs: [
      'Draft an exhibit research brief from three source links.',
      'Turn a donor update outline into a polished email.',
      'Summarize an oral-history transcript with uncertain claims separated.',
    ],
  });
}

function buildMcpWorkflow(input = {}) {
  const profile = buildClientProfile(input);
  const workflow = input.workflow || profile.workflow;
  const tools = asList(input.tools, ['web search', 'Google Drive', 'email', 'Slack or Teams']);
  const trigger = input.trigger || 'manual request or scheduled run';
  return artifactEnvelope('mcp_workflow', profile, {
    summary: `MCP workflow design for ${workflow}`,
    trigger,
    tool_chain: tools.map((toolName, index) => ({
      order: index + 1,
      tool: toolName,
      purpose: {
        'web search': 'collect current outside context and source links',
        'Google Drive': 'read source docs and save finished artifacts',
        email: 'draft or send approved client-facing updates',
        'Slack or Teams': 'post completion and exception notices',
      }[toolName] || `support ${workflow}`,
    })),
    setup_steps: [
      'Confirm which external accounts the client will authorize.',
      'Create least-privilege access for file, email, and messaging tools.',
      'Run one dry-run with synthetic data before touching client records.',
      'Log source URLs, file IDs, and output destinations on each run.',
      'Stop and ask for human input when required data is missing.',
    ],
    failure_handling: [
      'If web search fails, continue with client-provided docs and flag stale context.',
      'If Drive access fails, return the draft inline and mark storage failed.',
      'If email or Slack fails, save the output and return a resend instruction.',
    ],
    security_notes: [
      'Do not request broad account access if a narrower folder or channel works.',
      'Do not send externally until the client has approved the output path.',
      'Store secrets outside context files and skill files.',
    ],
  });
}

function buildScheduledAutomation(input = {}) {
  const profile = buildClientProfile(input);
  const cadence = input.cadence || 'weekly';
  const time = input.time || 'Monday 8:00 AM local time';
  const workflow = input.workflow || profile.workflow;
  return artifactEnvelope('scheduled_automation', profile, {
    summary: `Scheduled automation design for ${workflow}`,
    schedule: { cadence, time },
    runbook: [
      'Load the client context file.',
      'Check whether required source files or feeds are present.',
      'Generate the draft artifact.',
      'Run quality checks and cite missing inputs.',
      'Save the output to the agreed destination.',
      'Notify the owner with status, link, and review notes.',
    ],
    required_inputs: asList(input.required_inputs, [
      'current source folder',
      'prior accepted example',
      'target audience',
      'review owner',
    ]),
    missing_data_behavior: [
      'Do not hallucinate missing source facts.',
      'Return a blocked status with exactly what is missing.',
      'Notify the owner instead of silently skipping the run.',
    ],
    success_metrics: [
      'run completed on schedule',
      'draft required less than 15 minutes of human editing',
      'all sources and uncertainties were preserved',
    ],
  });
}

function buildNichePlan(input = {}) {
  const candidates = Array.isArray(input.candidates) && input.candidates.length
    ? input.candidates
    : DEFAULT_NICHES.map(niche => ({
      niche: niche.label,
      scores: {
        workflow_fit: niche.id === 'public-history-museums' ? 5 : 4,
        budget: niche.id === 'public-history-museums' ? 3 : 4,
        domain_advantage: niche.id === 'public-history-museums' ? 5 : 2,
        low_compliance_drag: 4,
        not_too_technical: 4,
      },
    }));
  const evaluations = candidates.map(candidate => evaluateNiche(candidate));
  const ranked = [...evaluations].sort((a, b) => b.total - a.total);
  const selected = ranked[0];
  return artifactEnvelope('niche_plan', buildClientProfile({ niche: selected.niche }), {
    summary: `Niche plan for ${selected.niche}`,
    selected,
    ranked,
    first_offer: {
      name: 'Research-to-output automation pilot',
      buyer: 'director, curator, development lead, or research lead',
      promise: 'turn one recurring research/document workflow into a reliable draft system with citations and review checks',
    },
    first_10_leads: [
      'regional history museums',
      'historic house museums',
      'state humanities councils',
      'local historical societies with paid staff',
      'museum consulting firms',
      'public-history centers at universities',
      'grant-funded cultural nonprofits',
      'archives-adjacent teams that do not require MLIS work',
      'oral-history projects',
      'exhibit design studios',
    ],
    validation_tasks: [
      'Interview three target buyers about their most repetitive document workflow.',
      'Build one demo using public source material.',
      'Ask for one free case-study pilot in exchange for measured results.',
    ],
  });
}

function buildCaseStudyPlan(input = {}) {
  const profile = buildClientProfile(input);
  const manualMinutes = Number(input.manual_minutes || input.manualMinutes || 180);
  const automatedMinutes = Number(input.automated_minutes || input.automatedMinutes || 20);
  const weeklyRuns = Number(input.weekly_runs || input.weeklyRuns || 2);
  const savedPerRun = Math.max(0, manualMinutes - automatedMinutes);
  const weeklySavedHours = Math.round((savedPerRun * weeklyRuns / 60) * 10) / 10;
  const hourlyValue = Number(input.hourly_value || input.hourlyValue || 75);
  const monthlyValue = Math.round(weeklySavedHours * hourlyValue * 4);

  return artifactEnvelope('case_study_plan', profile, {
    summary: `Case study plan for ${profile.workflow}`,
    metrics: {
      manual_minutes: manualMinutes,
      automated_minutes: automatedMinutes,
      weekly_runs: weeklyRuns,
      weekly_saved_hours: weeklySavedHours,
      estimated_monthly_value: monthlyValue,
    },
    discovery_questions: [
      'What recurring task wastes the most time each week?',
      'What does good output look like today?',
      'What examples should the automation copy or avoid?',
      'Who reviews the output before it is used?',
      'How will time saved and quality be measured?',
    ],
    proof_plan: [
      'Record the manual baseline on one real task.',
      'Build context and skill files for that task only.',
      'Run the same task through the automation 5 times.',
      'Measure elapsed time, edits needed, and reviewer confidence.',
      'Package before/after examples and testimonial language.',
    ],
    testimonial_prompt: `Before this automation, ${profile.workflow} took about ${manualMinutes} minutes. Now it takes about ${automatedMinutes} minutes while preserving our standards.`,
  });
}

function buildOfferPackage(input = {}) {
  const profile = buildClientProfile(input);
  const weeklySavedHours = Number(input.weekly_saved_hours || input.weeklySavedHours || 8);
  const hourlyValue = Number(input.hourly_value || input.hourlyValue || 75);
  const monthlyValue = Math.round(weeklySavedHours * hourlyValue * 4);
  const recommendedBuild = monthlyValue >= 3500 ? 5000 : 3000;

  return artifactEnvelope('offer_package', profile, {
    summary: `Automation build package for ${profile.organization}`,
    value_case: {
      weekly_saved_hours: weeklySavedHours,
      hourly_value: hourlyValue,
      estimated_monthly_value: monthlyValue,
      recommended_build_price: recommendedBuild,
      roi_note: `${money(recommendedBuild)} one-time against about ${money(monthlyValue)} monthly time value.`,
    },
    packages: [
      {
        name: 'Pilot Build',
        price: '$3,000-$5,000',
        scope: ['one workflow', 'one context file', 'one skill file', 'two-week refinement', 'handoff documentation'],
      },
      {
        name: 'Operating System Build',
        price: '$5,000-$15,000',
        scope: ['three to five workflows', 'tool connections', 'scheduled automations', 'dashboard/reporting', '30 days support'],
      },
      {
        name: 'Maintenance',
        price: '$500-$1,000/month',
        scope: ['monitor failures', 'refine outputs', 'add small workflow improvements', 'monthly performance report'],
      },
    ],
    proposal_outline: [
      'Problem and current weekly cost',
      'Automation scope',
      'Deliverables',
      'Timeline',
      'Success metrics',
      'Price and support terms',
    ],
  });
}

function qualifyLead(input = {}) {
  const profile = buildClientProfile(input);
  const signals = asList(input.signals || input.evidence, []);
  const text = signals.join(' ').toLowerCase();
  const score = {
    workflow_pain: Math.min(5, signals.length + (/(manual|weekly|hours|spreadsheet|report|copy|research)/.test(text) ? 2 : 0)),
    budget_fit: /(museum|agency|firm|foundation|university|funded|grant|director)/.test(text) ? 4 : 2,
    urgency: /(hiring|backlog|deadline|launch|grant|audit|board)/.test(text) ? 4 : 2,
    access: input.contact || input.referral ? 4 : 2,
  };
  const total = Object.values(score).reduce((sum, value) => sum + value, 0);
  return artifactEnvelope('lead_qualification', profile, {
    lead: {
      organization: input.organization || profile.organization,
      contact: input.contact || null,
      url: input.url || null,
      signals,
    },
    score,
    total,
    priority: total >= 15 ? 'high' : total >= 11 ? 'medium' : 'low',
    pain_hypothesis: input.pain_hypothesis || `${profile.organization} likely has repeatable ${profile.workflow} work that can be templated and quality-checked.`,
    next_step: total >= 11
      ? 'Send a specific 15-minute call ask tied to the suspected recurring workflow.'
      : 'Park until a clearer pain signal or warmer intro appears.',
  });
}

function draftOutreach(input = {}) {
  const profile = buildClientProfile(input);
  const lead = input.lead || input.organization || profile.organization;
  const task = input.task || profile.workflow;
  const proof = input.proof || 'save 5-10 hours per week on a recurring research or reporting workflow';
  const subject = input.subject || `Idea for automating ${task}`;
  return artifactEnvelope('outreach_draft', profile, {
    lead,
    subject,
    cold_email: [
      `Hi ${input.contact_name || 'there'},`,
      '',
      `I build AI automations for ${profile.niche} teams. I noticed ${lead} may have recurring ${task} work that likely takes staff time every week.`,
      '',
      `I can map one workflow and show whether it can ${proof}. If it is not a fit, I will say so quickly.`,
      '',
      'Would you be open to a 15-minute call this week?',
      '',
      'Conor',
    ].join('\n'),
    referral_ask: `Do you know one or two ${profile.audience[0] || 'operators'} who spend too much time on ${task}? I am building a case study and can help with one workflow first.`,
    follow_up: `Quick follow-up on the ${task} automation idea. The first useful step is just identifying one repetitive task, the current time cost, and what good output looks like.`,
    call_agenda: [
      'Identify the painful recurring task.',
      'Measure current manual time.',
      'Review examples of good output.',
      'Confirm tools and source material.',
      'Decide whether a pilot build is worth scoping.',
    ],
  });
}

function buildDeliveryPlan(input = {}) {
  const profile = buildClientProfile(input);
  return artifactEnvelope('delivery_plan', profile, {
    summary: `Two-week delivery plan for ${profile.workflow}`,
    days: [
      { day: 1, work: 'Discovery call, workflow map, success metric definition' },
      { day: 2, work: 'Collect source examples, voice samples, and failure examples' },
      { day: 3, work: 'Draft context file and get client review' },
      { day: 4, work: 'Draft skill file and first test cases' },
      { day: 5, work: 'Run first real task and measure baseline delta' },
      { day: 6, work: 'Refine edge cases and output format' },
      { day: 7, work: 'Add tool connection or scheduled run if required' },
      { day: 8, work: 'Run five input variations and log failures' },
      { day: 9, work: 'Patch failure modes and quality checks' },
      { day: 10, work: 'Client review and handoff documentation' },
    ],
    handoff_assets: [
      'context file',
      'skill file',
      'workflow map',
      'test input set',
      'maintenance checklist',
      'before/after case study notes',
    ],
  });
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function summarizeEvents(events) {
  const byType = {};
  const byAgent = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    byAgent[event.subagent] = (byAgent[event.subagent] || 0) + 1;
  }
  return { byType, byAgent };
}

function eventTimeMs(event) {
  const ms = new Date(event?.ts || event?.timestamp || event?.date || 0).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isStaleEvent(event, now, days = 7) {
  const ms = eventTimeMs(event);
  return ms != null && now.getTime() - ms > days * 24 * 60 * 60 * 1000;
}

function buildSubagentStatus(subagent, events) {
  const owned = events.filter(event => event.subagent === subagent.id);
  const doneKinds = new Set(owned.map(event => event.type));
  const missing = subagent.done_events.filter(type => !doneKinds.has(type));
  const blockers = owned
    .filter(event => event.status === 'blocked')
    .map(event => event.summary || `${event.type} blocked`);
  return {
    id: subagent.id,
    label: subagent.label,
    status: blockers.length ? 'blocked' : missing.length ? 'open' : 'ready',
    owns: subagent.owns,
    completed_event_types: [...doneKinds],
    missing_event_types: missing,
    blockers,
    count: owned.length,
    recent: owned.slice(-5),
  };
}

function evaluateNiche(input = {}) {
  const scores = input.scores || {};
  let total = 0;
  const factors = NICHE_RULES.map(rule => {
    const raw = Number(scores[rule.id] ?? input[rule.id] ?? 0);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : 0;
    const weighted = value * rule.weight;
    total += weighted;
    return { ...rule, value, weighted };
  });
  return {
    niche: input.niche || input.label || 'unnamed niche',
    total,
    max: NICHE_RULES.reduce((sum, rule) => sum + 5 * rule.weight, 0),
    recommendation: total >= 45 ? 'strong' : total >= 34 ? 'test' : 'park',
    factors,
  };
}

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

function recordAutomationEvent(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const subagent = String(input.subagent || '').trim();
  const type = String(input.type || '').trim();
  if (!SUBAGENTS.some(agent => agent.id === subagent)) {
    const err = new Error('known subagent is required');
    err.statusCode = 400;
    throw err;
  }
  if (!type) {
    const err = new Error('event type is required');
    err.statusCode = 400;
    throw err;
  }

  const entry = {
    ts: now.toISOString(),
    subagent,
    type,
    status: input.status || 'recorded',
    summary: input.summary || null,
    value: input.value == null ? null : Number(input.value),
    data: input.data || {},
  };
  ensureParent(paths.events.automationBusinessEvents);
  fs.appendFileSync(paths.events.automationBusinessEvents, JSON.stringify(entry) + '\n', 'utf8');
  ensureParent(paths.snapshots.automationBusinessSpine);
  fs.writeFileSync(paths.snapshots.automationBusinessSpine, JSON.stringify(buildAutomationBusinessSpine({ paths, now }), null, 2), 'utf8');
  return entry;
}

function capabilityForKind(kind) {
  return CAPABILITIES.find(capability => capability.id === kind || capability.event_type === kind);
}

function buildAutomationArtifact(input = {}, options = {}) {
  const kind = input.kind || input.type || 'context-file';
  const builders = {
    'context-file': buildContextFile,
    context_file: buildContextFile,
    'skill-file': buildSkillFile,
    skill_file: buildSkillFile,
    'mcp-workflow': buildMcpWorkflow,
    mcp_workflow: buildMcpWorkflow,
    'scheduled-automation': buildScheduledAutomation,
    scheduled_automation: buildScheduledAutomation,
    'niche-plan': buildNichePlan,
    niche_candidate: buildNichePlan,
    'case-study': buildCaseStudyPlan,
    case_study: buildCaseStudyPlan,
    'offer': buildOfferPackage,
    offer_package: buildOfferPackage,
    'lead-qualify': qualifyLead,
    lead: qualifyLead,
    outreach: draftOutreach,
    'delivery-plan': buildDeliveryPlan,
    client_delivery: buildDeliveryPlan,
  };
  const builder = builders[kind];
  if (!builder) {
    const err = new Error(`unsupported automation artifact kind: ${kind}`);
    err.statusCode = 400;
    throw err;
  }
  const artifact = builder(input);
  const capability = capabilityForKind(kind) || capabilityForKind(artifact.kind);
  let event = null;
  if (options.record !== false && input.record !== false && capability) {
    event = recordAutomationEvent({
      subagent: capability.subagent,
      type: capability.event_type,
      summary: artifact.summary,
      value: input.value,
      data: {
        artifact,
      },
    }, options);
  }
  return { artifact, event };
}

module.exports = {
  CAPABILITIES,
  SUBAGENTS,
  buildAutomationBusinessSpine,
  buildAutomationArtifact,
  buildCaseStudyPlan,
  buildClientProfile,
  buildContextFile,
  buildDeliveryPlan,
  buildMcpWorkflow,
  buildNichePlan,
  buildOfferPackage,
  buildScheduledAutomation,
  buildSkillFile,
  draftOutreach,
  evaluateNiche,
  qualifyLead,
  recordAutomationEvent,
  _internal: {
    readJsonl,
  },
};
