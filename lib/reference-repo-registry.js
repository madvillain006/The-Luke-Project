'use strict';

const REGISTRY = [
  {
    key: 'mempalace',
    local_path: 'tools/reference-repos/mempalace',
    upstream_url: 'https://github.com/MemPalace/mempalace.git',
    commit: '018ded5',
    category: 'memory',
    allowed_surfaces: ['memory', 'radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Local-first semantic memory, pluggable backend, hybrid keyword+temporal retrieval.',
  },
  {
    key: 'hermes-agent',
    local_path: 'tools/reference-repos/hermes-agent',
    upstream_url: 'https://github.com/NousResearch/hermes-agent.git',
    commit: '81928f0',
    category: 'agent',
    allowed_surfaces: ['memory', 'radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Long-running agent with skill persistence, session recall, and multi-channel gateway patterns.',
  },
  {
    key: 'autoresearch',
    local_path: 'tools/reference-repos/autoresearch',
    upstream_url: 'https://github.com/karpathy/autoresearch.git',
    commit: '228791f',
    category: 'quant',
    allowed_surfaces: ['radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Experiment loop reference: keep/discard iteration, research sweeps, structured backtest vocabulary.',
  },
  {
    key: 'qlib',
    local_path: 'tools/reference-repos/qlib',
    upstream_url: 'https://github.com/microsoft/qlib.git',
    commit: 'd5379c5',
    category: 'quant',
    allowed_surfaces: ['radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Quant research architecture: factor pipelines, backtest evaluation, portfolio risk vocabulary.',
  },
  {
    key: 'mattpocock-skills',
    local_path: 'tools/reference-repos/mattpocock-skills',
    upstream_url: 'https://github.com/mattpocock/skills.git',
    commit: '733d312',
    category: 'workflow',
    allowed_surfaces: ['context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Coder workflow patterns: planning, testing, issue triage, shared language, agent alignment.',
  },
  {
    key: 'andrej-karpathy-skills',
    local_path: 'tools/reference-repos/andrej-karpathy-skills',
    upstream_url: 'https://github.com/forrestchang/andrej-karpathy-skills.git',
    commit: '2c60614',
    category: 'workflow',
    allowed_surfaces: ['context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Agent discipline: explicit assumptions, surgical edits, simple changes, verifiable goals.',
  },
  {
    key: 'SuperClaude_Framework',
    local_path: 'tools/reference-repos/SuperClaude_Framework',
    upstream_url: 'https://github.com/SuperClaude-Org/SuperClaude_Framework.git',
    commit: '226c45c',
    category: 'workflow',
    allowed_surfaces: ['context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Structured workflow and command-system reference. Idea source only — not installed into runtime.',
  },
  {
    key: 'ai-agents-for-beginners',
    local_path: 'tools/reference-repos/ai-agents-for-beginners',
    upstream_url: 'https://github.com/microsoft/ai-agents-for-beginners.git',
    commit: 'e145657',
    category: 'agent',
    allowed_surfaces: ['memory', 'radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Production agent curriculum: tool use, trustworthy agents, context engineering, memory, security.',
  },
  {
    key: 'awesome-claude-code',
    local_path: 'tools/reference-repos/awesome-claude-code',
    upstream_url: 'https://github.com/hesreallyhim/awesome-claude-code.git',
    commit: '614f102',
    category: 'catalog',
    allowed_surfaces: ['context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Catalog of skills, hooks, slash commands, orchestrators, and tooling for Claude Code.',
  },
  {
    key: 'awesome-llm-apps',
    local_path: 'tools/reference-repos/awesome-llm-apps',
    upstream_url: 'https://github.com/Shubhamsaboo/awesome-llm-apps.git',
    commit: '20381f9',
    category: 'catalog',
    allowed_surfaces: ['radar', 'context'],
    banned_surfaces: ['trading_execution', 'broker'],
    description: 'Runnable agent, RAG, MCP, memory, and multi-agent app templates. Borrow patterns, not dependencies.',
  },
];

function getRegistry() {
  return REGISTRY.slice().sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}

function getByCategory(category) {
  return REGISTRY.filter(entry => entry.category === category);
}

function getContextSummary() {
  const lines = ['Reference repos (ideas only, not runtime deps):'];
  const byCategory = {};
  for (const entry of REGISTRY) {
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(`${entry.key}: ${entry.description}`);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`[${cat}] ${items.join(' | ')}`);
  }
  const result = lines.join('\n');
  return result.length <= 400 ? result : result.slice(0, 397) + '...';
}

module.exports = { getRegistry, getByCategory, getContextSummary };
