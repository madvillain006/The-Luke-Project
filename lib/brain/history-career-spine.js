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
  const byTrack = Object.fromEntries(TRACKS.map(track => [
    track.id,
    accepted.filter(item => item.track === track.id).length,
  ]));

  return {
    agent: 'history-career',
    label: 'Public history, research, and AI-engineering search spine',
    generated_at: now.toISOString(),
    status: accepted.length ? 'active' : 'searching',
    credential_filter: {
      exclude_mlis: true,
      excluded_terms: EXCLUDED_TERMS,
    },
    tracks: TRACKS,
    pipeline: {
      accepted: accepted.length,
      rejected_mlis: rejected.length,
      by_track: byTrack,
      recent: findings,
    },
    next_searches: TRACKS.flatMap(track => track.searches.map(query => ({ track: track.id, query }))),
  };
}

module.exports = {
  buildHistoryCareerSpine,
  classifyOpportunity,
  containsExcludedTerm,
  evaluateOpportunity,
  recordOpportunity,
};
