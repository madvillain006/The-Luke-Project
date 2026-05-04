---
component_id: 2.1
component_name: Agent Execution Runtime
---

# Agent Execution Runtime

## Component Description

The primary worker layer consisting of specialized autonomous agents (00-14). Each agent manages a specific domain (e.g., Trading, Health, Workflows) and executes logic based on incoming commands or scheduled triggers.

---

## Key References:

### c:\Users\conor\luke\agents\agent-13-workflows.js (lines 264-353)
```
async function runWorkflow(name, vars = {}, opts = {}) {
  if (_activeRun) return { error: "Workflow already running: " + _activeRun.name };

  const wf = loadWorkflow(name);

  // Three-strike check (A7)
  if (isDisabled(name)) return { error: "Workflow disabled (3-strike): " + name + " — review required" };

  // Dry-run qualification check (A6)
  const dryRuns = getDryRunCount(name);
  const reqDryRuns = parseInt(wf.required_dry_runs || 0);
  const isDryRun = opts.dry_run === true || wf.dry_run === "true";
  if (!isDryRun && reqDryRuns > 0 && dryRuns < reqDryRuns) {
    return { error: `Workflow needs ${reqDryRuns} dry runs, only ${dryRuns} completed` };
  }

  // Preflight (A3)
  const preflightResults = await runPreflight(wf.preflight || []);
  const preflightFail = preflightResults.find(r => !r.ok);
  if (preflightFail) {
    return { error: "Preflight failed: " + preflightFail.check + " — " + preflightFail.detail };
  }

  // Recording dir (A8)
  const runTs = new Date().toISOString().replace(/[:.]/g, "-");
  const dateDir = new Date().toISOString().slice(0, 10);
  const recDir = path.join(RECORDINGS_DIR, dateDir, name + "-" + runTs);
  fs.mkdirSync(recDir, { recursive: true });

  const runMeta = { ts: new Date().toISOString(), workflow: name, dry_run: isDryRun, vars: Object.keys(vars) };
  try { fs.writeFileSync(path.join(recDir, "meta.json"), JSON.stringify(runMeta, null, 2)); } catch {}

  _activeRun = { name, startTs: Date.now(), recDir };
  saveState({ running: true, workflow: name, step: null, paused: false, killed: false, dry_run: isDryRun });

  // Start mouse override monitor (A4)
  const bcFn = global.broadcast;
  startMouseMonitor(bcFn);

  let verifyFails = 0;
  const steps = wf.steps || [];
  let stepResults = [];

  try {
    for (const step of steps) {
      // Kill check
      const st = loadState();
      if (st.killed || _mouseOverride) {
        const reason = st.killed ? "kill_signal" : "mouse_override";
        saveState({ ...loadState(), running: false, killed: true });
        logQual(name, "aborted", { reason, step: step.id });
        return { aborted: true, reason, step: step.id };
      }

      saveState({ ...loadState(), step: step.id });
      if (bcFn) bcFn({ type: "workflow_step", workflow: name, step: step.id });

      const { ok, stepLog } = await executeStep(step, vars, isDryRun, recDir);
      stepResults.push(stepLog);

      if (!ok && step.checkpoint) {
        verifyFails++;
        if (!isDryRun) recordStrike(name);
        if (verifyFails >= 3 || step.checkpoint) {
          saveState({ ...loadState(), running: false });
          stopMouseMonitor();
          logQual(name, "fail", { step: step.id, verdict: stepLog.verdict });
          if (bcFn) bcFn({ type: "notification", message: "WORKFLOW FAILED at checkpoint: " + step.id + " — " + stepLog.verdict });
          return { ok: false, failed_step: step.id, verdict: stepLog.verdict };
        }
      }
    }
  } finally {
    stopMouseMonitor();
    _activeRun = null;
    saveState({ running: false, workflow: name, step: "complete", paused: false, killed: false });
  }

  // 30-day recording cleanup (A8)
  cleanOldRecordings();

  if (isDryRun) {
    logQual(name, "pass", { steps: steps.length });
    if (bcFn) bcFn({ type: "notification", message: "DRY RUN PASSED: " + name + " (" + getDryRunCount(name) + "/" + reqDryRuns + ")" });
  } else {
    logQual(name, "live_pass", { steps: steps.length });
  }

  return { ok: true, dry_run: isDryRun, steps: stepResults.length };
}
```

### c:\Users\conor\luke\agents\agent-02-trader.js (lines 15-17)
```
function logTrade(trade) {
  fs.appendFileSync(TRADES_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...trade }) + "\n");
}
```

### c:\Users\conor\luke\agents\agent-14-kat.js (lines 571-678)
```
async function processLiveVision(entry, parsedSignal) {
  try {
    const Anthropic  = require('@anthropic-ai/sdk');
    const https      = require('https');
    const { buildHeatseekerReferencePrompt } = require('../lib/heatseeker-reference');
    const att        = entry.attachments[0];
    if (!att || !att.url) return;

    // Fetch image
    const imageBuffer = await new Promise((resolve, reject) => {
      const req = https.get(att.url, (res) => {
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const mediaType = resolveAttachmentMediaType(att, imageBuffer);
    const base64 = imageBuffer.toString('base64');

    const client   = new Anthropic();
    const heatseekerReference = buildHeatseekerReferencePrompt();
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      system: 'You are analyzing a financial chart or heatmap image posted by a trader. ' +
              'Extract key price levels and directional bias. ' +
              'For heatmap images, apply the Heatseeker node reference below. Treat it as confluence only, not a trade trigger. ' +
              '\n\nHEATSEEKER NODE REFERENCE:\n' + heatseekerReference + '\n\n' +
              'Return ONLY valid JSON: ' +
              '{"chart_type":"candlestick"|"heatmap"|"technical"|"unknown",' +
              '"ticker":string|null,"key_levels":[numbers],' +
              '"support_levels":[numbers],"resistance_levels":[numbers],' +
              '"heatmap_context":{"king_nodes":[numbers],"gatekeeper_nodes":[numbers],"air_pockets":[numbers],"node_read":string|null},' +
              '"bias":"BULLISH"|"BEARISH"|"NEUTRAL","patterns":[strings],' +
              '"notes":string}. ' +
              'Return empty arrays if not identifiable. No markdown.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64',
            media_type: mediaType,
            data: base64 } },
          { type: 'text',
            text: 'Analyst: ' + entry.username +
                  '\nPosted text: ' + (entry.content || '') }
        ]
      }]
    });

    const rawText = response.content[0]?.text || '';
    let vision = null;
    try {
      vision = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch (e) {
      console.error('[kat-vision] parse error:', rawText.slice(0, 80));
      return;
    }

    if (!vision) return;

    console.log('[kat-vision] Live:', entry.username,
      '', vision.chart_type, '| bias:', vision.bias,
      '| levels:', (vision.key_levels || []).length);

    const allLevels = [
      ...(vision.key_levels        || []),
      ...(vision.support_levels    || []),
      ...(vision.resistance_levels || [])
    ].filter(l => l > 50);

    if (allLevels.length > 0 && typeof global.broadcast === 'function') {
      global.broadcast({
        type:       'kat_vision',
        analyst:    entry.username,
        ticker:     vision.ticker || parsedSignal?.ticker,
        bias:       vision.bias,
        levels:     allLevels,
        chart_type: vision.chart_type,
        heatmap_context: vision.heatmap_context || null,
        notes:      vision.notes,
        ts:         entry.ts,
        message_id: entry.message_id,
        channel:    entry.channel_name,
        image_evidence: entry.attachments.map(att => ({
          id: att.id || null,
          filename: att.filename || null,
          content_type: att.content_type || null,
          url: att.url || null
        })),
        provenance: {
          server: 'Elevated Charts',
          channel: entry.channel_name,
          analyst: entry.username,
          message_id: entry.message_id,
          captured_at: new Date().toISOString()
        },
        human_gate_required: true
      });
      console.log('[kat-vision] Broadcast to Luke:', allLevels.length, 'levels from', entry.username);
    }

  } catch (e) {
    console.error('[kat-vision] processLiveVision error:', e.message);
  }
}
```


## Source Files:

- `agents\agent-00-brain.js`
- `agents\agent-02-trader.js`
- `agents\agent-03-income.js`
- `agents\agent-04-health.js`
- `agents\agent-05-finance.js`
- `agents\agent-06-research.js`
- `agents\agent-07-opportunity.js`
- `agents\agent-08-sienna.js`
- `agents\agent-09-architect.js`
- `agents\agent-10-sweeper.js`
- `agents\agent-11-tokens.js`
- `agents\agent-12-fallback.js`
- `agents\agent-13-workflows.js`
- `agents\agent-14-kat.js`

