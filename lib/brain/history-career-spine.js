'use strict';

const fs = require('fs');
const path = require('path');

const defaultPaths = require('../paths');

const EXCLUDED_TERMS = [
  'mlis',
  'm.l.i.s',
  'master of library',
  'library science',
  'ala-accredited',
  'ala accredited',
  'librarian',
];

const TRACKS = [
  {
    id: 'public-history-consulting',
    label: 'Public history consulting',
    searches: [
      '"public history" consultant contract remote',
      '"historical research" consultant archives contract',
      '"oral history" project consultant',
    ],
  },
  {
    id: 'museum-curatorial',
    label: 'Museum and curatorial roles',
    searches: [
      'museum curator public history job -MLIS',
      'assistant curator history museum job -MLIS',
      'collections researcher museum history job -MLIS',
    ],
  },
  {
    id: 'research-roles',
    label: 'Research and archives-adjacent roles',
    searches: [
      '"historical researcher" job remote',
      '"research associate" history museum',
      '"public historian" job',
    ],
  },
  {
    id: 'ai-engineering-adjacent',
    label: 'AI engineering adjacent history work',
    searches: [
      '"digital humanities" AI research job',
      '"historical data" annotation AI contract',
      '"cultural heritage" AI research engineer',
    ],
  },
];

const SOURCE_LINKS = [
  {
    label: 'National Council on Public History jobs',
    url: 'https://ncph.org/jobs/',
    use: 'Public history, consulting, museum, archive, and contract leads.',
  },
  {
    label: 'Archives Gig',
    url: 'https://archivesgig.com/',
    use: 'Archivist, digitization, public history, and project-based GLAM postings.',
  },
  {
    label: 'Oral History Association opportunities',
    url: 'https://oralhistory.org/category/jobs-and-professional-opportunities/',
    use: 'Oral history RFPs, vendor scans, and project contracts.',
  },
  {
    label: 'AAM job board',
    url: 'https://www.aam-us.org/programs/manage-your-career/jobHQ/',
    use: 'Museum roles and consultant-adjacent employer discovery.',
  },
];

const OUTREACH_BUILDS = [
  {
    id: 'anniversary-archive-board',
    label: 'Anniversary archive + timeline board kit',
    fit: 'Associations, schools, nonprofits, and local businesses near a 50/75/100-year milestone.',
    proof: 'Cape Fear REALTORS 100-year anniversary and meter-board style public history deliverables.',
  },
  {
    id: 'civil-rights-school-history',
    label: 'School civil-rights history research packet',
    fit: 'Schools, foundations, alumni groups, and local institutions with underused archival stories.',
    proof: 'Williston School civil-rights history research example.',
  },
  {
    id: 'small-museum-ai-research-assistant',
    label: 'Small museum research assistant',
    fit: 'Small museums with scattered PDFs, donor files, exhibit notes, oral histories, and board minutes.',
    proof: 'Luke can preserve citations, separate evidence from interpretation, and produce human-review drafts.',
  },
];

const LEAD_TITLE_PATTERN = /\b(job|position|opening|opportunit|rfp|contract|consultant|associate|assistant|manager|specialist|technician|director|curator|archivist|historian|researcher|coordinator|fellow|intern|digitiz|collections|oral history|public history|museum|heritage|humanities)\b/i;
const NAV_TITLE_PATTERN = /^(home|about|contact|search|subscribe|log in|login|sign in|rss|skip to content|older posts|newer posts|previous|next|read more|submit a job|post a job|jobhq)$/i;

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8212;|&mdash;/g, '-')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href || null;
  }
}

function sourceSlug(label) {
  return String(label || 'source').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isLikelyNavigationLink(title, href, source) {
  const normalized = String(title || '').trim().toLowerCase();
  const sourceTitle = String(source?.label || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === sourceTitle) return true;
  if (NAV_TITLE_PATTERN.test(normalized)) return true;
  if (/^(mailto:|tel:|javascript:|#)/i.test(String(href || '').trim())) return true;
  if (/^continue reading\b/i.test(normalized)) return true;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4}/i.test(normalized)) return true;
  if (/\b(follow|subscribe|privacy|terms|advertis|sponsor|comment|category|tag|archive page)\b/i.test(normalized)) return true;
  return false;
}

function extractLeadLinks(html, source) {
  const leads = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || '')))) {
    const href = match[1];
    const title = stripHtml(match[2]);
    if (!title || title.length < 8 || title.length > 180) continue;
    if (isLikelyNavigationLink(title, href, source)) continue;
    const combined = `${title} ${href}`;
    if (containsExcludedTerm(combined)) continue;
    if (!LEAD_TITLE_PATTERN.test(title)) continue;
    const url = absoluteUrl(source.url, href);
    const key = `${title}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const evaluation = evaluateOpportunity({ title, url, description: source.label });
    leads.push({
      id: `${sourceSlug(source.label)}-${leads.length + 1}`,
      title,
      url,
      source: source.label,
      track: evaluation.track,
      reason: evaluation.reason,
      accepted: evaluation.accepted,
    });
    if (leads.length >= 8) break;
  }
  return leads;
}

async function fetchPublicHistoryJobLeads(options = {}) {
  const fetchFn = options.fetchFn || fetch;
  const sources = options.sources || SOURCE_LINKS;
  const perSourceLimit = options.perSourceLimit || 5;
  const result = {
    status: 'ok',
    generated_at: new Date().toISOString(),
    leads: [],
    source_links: sources,
    errors: [],
  };

  await Promise.all(sources.map(async source => {
    try {
      const response = await fetchFn(source.url, {
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      result.leads.push(...extractLeadLinks(html, source).slice(0, perSourceLimit));
    } catch (err) {
      result.errors.push({ source: source.label, url: source.url, error: err.message });
    }
  }));

  const seen = new Set();
  result.leads = result.leads
    .filter(lead => {
      const key = `${lead.title}|${lead.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return lead.accepted;
    })
    .slice(0, options.limit || 12);
  if (!result.leads.length && result.errors.length) result.status = 'degraded';
  if (!result.leads.length && !result.errors.length) result.status = 'empty';
  return result;
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJsonlTail(file, limit = 20) {
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

function containsExcludedTerm(text) {
  const lower = String(text || '').toLowerCase();
  return EXCLUDED_TERMS.some(term => lower.includes(term));
}

function classifyOpportunity(text) {
  const lower = String(text || '').toLowerCase();
  if (/digital humanities|ai|machine learning|data annotation|cultural heritage/.test(lower)) return 'ai-engineering-adjacent';
  if (/curator|curatorial|collections|museum/.test(lower)) return 'museum-curatorial';
  if (/research|archives|archive|historian/.test(lower)) return 'research-roles';
  return 'public-history-consulting';
}

function evaluateOpportunity(input = {}) {
  const text = [
    input.title,
    input.organization,
    input.description,
    input.url,
  ].filter(Boolean).join(' ');
  const excluded = containsExcludedTerm(text);
  return {
    accepted: !excluded,
    reason: excluded ? 'requires or strongly signals MLIS/library-science credential' : 'matches allowed history/research scope',
    track: classifyOpportunity(text),
  };
}

function recordOpportunity(input = {}, options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const evaluation = evaluateOpportunity(input);
  const entry = {
    ts: now.toISOString(),
    title: input.title || null,
    organization: input.organization || null,
    url: input.url || null,
    location: input.location || null,
    description: input.description || null,
    ...evaluation,
  };
  ensureParent(paths.events.historyCareerFindings);
  fs.appendFileSync(paths.events.historyCareerFindings, JSON.stringify(entry) + '\n', 'utf8');
  ensureParent(paths.snapshots.historyCareerSpine);
  fs.writeFileSync(paths.snapshots.historyCareerSpine, JSON.stringify(buildHistoryCareerSpine({ paths, now }), null, 2), 'utf8');
  return entry;
}

function buildHistoryCareerSpine(options = {}) {
  const paths = options.paths || defaultPaths;
  const now = options.now || new Date();
  const findings = readJsonlTail(paths.events.historyCareerFindings, 30);
  const accepted = findings.filter(item => item.accepted);
  const rejected = findings.filter(item => !item.accepted);
  const closedWithoutReason = findings.filter(item => (
    String(item.status || '').toLowerCase() === 'closed'
    && !item.reason
  ));
  const byTrack = Object.fromEntries(TRACKS.map(track => [
    track.id,
    accepted.filter(item => item.track === track.id).length,
  ]));
  const blockers = closedWithoutReason.map(item => `closed opportunity missing reason: ${item.title || item.organization || 'untitled'}`);
  const nextSearches = TRACKS.flatMap(track => track.searches.map(query => ({ track: track.id, query })));

  return {
    agent: 'history-career',
    label: 'Public history, research, and AI-engineering search spine',
    generated_at: now.toISOString(),
    status: blockers.length ? 'attention' : accepted.length ? 'active' : 'searching',
    blockers,
    credential_filter: {
      exclude_mlis: true,
      excluded_terms: EXCLUDED_TERMS,
    },
    tracks: TRACKS,
    source_links: SOURCE_LINKS,
    job_leads: {
      status: accepted.length ? 'local' : 'needs_sync',
      leads: accepted.slice(-8).reverse(),
      source_links: SOURCE_LINKS,
      note: accepted.length ? 'Showing saved local leads.' : 'No saved local history-career leads yet; use direct lead sync for live source scans.',
    },
    outreach_builds: OUTREACH_BUILDS,
    pipeline: {
      accepted: accepted.length,
      rejected_mlis: rejected.length,
      by_track: byTrack,
      active_applications: findings.filter(item => ['saved', 'applied', 'interviewing'].includes(String(item.status || '').toLowerCase())).length,
      closed_without_reason: closedWithoutReason.length,
      accepted_reasons: accepted.slice(-6).map(item => ({ title: item.title, reason: item.reason })),
      rejected_reasons: rejected.slice(-6).map(item => ({ title: item.title, reason: item.reason })),
      recent: findings,
    },
    next_searches: nextSearches,
    next_actions: blockers.length
      ? blockers
      : [
        ...OUTREACH_BUILDS.slice(0, 2).map(item => `Build lead angle: ${item.label}`),
        ...nextSearches.slice(0, 4).map(item => `Search ${item.track}: ${item.query}`),
      ],
  };
}

module.exports = {
  buildHistoryCareerSpine,
  classifyOpportunity,
  containsExcludedTerm,
  extractLeadLinks,
  evaluateOpportunity,
  fetchPublicHistoryJobLeads,
  recordOpportunity,
};
