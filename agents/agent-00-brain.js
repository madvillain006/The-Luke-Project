'use strict';

const express = require('express');
const os = require('os');
const {
  answerInquiry,
  buildBrainSnapshot,
  buildTradingReport,
  recordSubagentReport,
} = require('../lib/brain/brain-core');
const {
  buildAutomationArtifact,
  buildAutomationBusinessSpine,
  evaluateNiche,
  recordAutomationEvent,
} = require('../lib/brain/automation-business-spine');
const { buildDailyBrief, fetchDailyNews } = require('../lib/brain/daily-brief');
const { buildDailySpine, fetchWeather, recordDailyCheckin } = require('../lib/brain/daily-spine');
const { buildDeveloperStackSpine, recordDeveloperStackEvent } = require('../lib/brain/developer-stack-spine');
const { buildHistoryCareerSpine, recordOpportunity } = require('../lib/brain/history-career-spine');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json(buildBrainSnapshot());
});

router.get('/brief', (req, res) => {
  const snapshot = buildBrainSnapshot();
  res.json({
    ok: true,
    brain: snapshot.label,
    generated_at: snapshot.generated_at,
    attention: snapshot.attention,
    next_actions: snapshot.next_actions,
    trading: snapshot.subagents.trading,
  });
});

router.get('/trading-report', (req, res) => {
  res.json(buildTradingReport());
});

router.get('/telemetry', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime_seconds: Math.round(process.uptime()),
      rss_bytes: memory.rss,
      heap_used_bytes: memory.heapUsed,
      heap_total_bytes: memory.heapTotal,
    },
    system: {
      platform: process.platform,
      cpu_count: os.cpus().length,
      load_average: os.loadavg(),
      free_memory_bytes: os.freemem(),
      total_memory_bytes: os.totalmem(),
    },
  });
});

router.get('/automation-business', (req, res) => {
  res.json(buildAutomationBusinessSpine());
});

router.get('/automation-business/plan', (req, res) => {
  const spine = buildAutomationBusinessSpine();
  res.json({
    ok: true,
    label: spine.label,
    recommended_start: spine.recommended_start,
    first_30_days: spine.first_30_days,
    operating_model: spine.operating_model,
    subagents: spine.subagents,
  });
});

router.get('/developer-stack', (req, res) => {
  res.json(buildDeveloperStackSpine());
});

router.get('/developer-stack/plan', (req, res) => {
  const spine = buildDeveloperStackSpine();
  res.json({
    ok: true,
    label: spine.label,
    provider_order: spine.provider_order,
    local_only_truth: spine.local_only_truth,
    setup_plan: spine.setup_plan,
    subagents: spine.subagents,
  });
});

router.post('/developer-stack/event', (req, res) => {
  try {
    res.json({ ok: true, event: recordDeveloperStackEvent(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.post('/automation-business/event', (req, res) => {
  try {
    res.json({ ok: true, event: recordAutomationEvent(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

function sendAutomationArtifact(kind) {
  return (req, res) => {
    try {
      res.json({ ok: true, ...buildAutomationArtifact({ ...(req.body || {}), kind }) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  };
}

router.post('/automation-business/artifact', (req, res) => {
  try {
    res.json({ ok: true, ...buildAutomationArtifact(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.post('/automation-business/context-file', sendAutomationArtifact('context-file'));
router.post('/automation-business/skill-file', sendAutomationArtifact('skill-file'));
router.post('/automation-business/mcp-workflow', sendAutomationArtifact('mcp-workflow'));
router.post('/automation-business/scheduled-automation', sendAutomationArtifact('scheduled-automation'));
router.post('/automation-business/niche-plan', sendAutomationArtifact('niche-plan'));
router.post('/automation-business/case-study', sendAutomationArtifact('case-study'));
router.post('/automation-business/offer', sendAutomationArtifact('offer'));
router.post('/automation-business/lead/qualify', sendAutomationArtifact('lead-qualify'));
router.post('/automation-business/outreach', sendAutomationArtifact('outreach'));
router.post('/automation-business/delivery-plan', sendAutomationArtifact('delivery-plan'));

router.post('/automation-business/niche/evaluate', (req, res) => {
  res.json({ ok: true, evaluation: evaluateNiche(req.body || {}) });
});

router.get('/daily', async (req, res) => {
  const weather = await fetchWeather({
    lat: req.query.lat || process.env.LUKE_WEATHER_LAT,
    lon: req.query.lon || process.env.LUKE_WEATHER_LON,
    timezone: req.query.tz || process.env.LUKE_WEATHER_TZ || 'America/New_York',
  });
  res.json(buildDailySpine({ weather }));
});

router.get('/daily/news', async (req, res) => {
  const limitPerCategory = Number(req.query.limit || 8);
  res.json(await fetchDailyNews({
    limitPerCategory: Number.isFinite(limitPerCategory) ? limitPerCategory : 8,
  }));
});

router.get('/daily/brief', async (req, res) => {
  const weather = await fetchWeather({
    lat: req.query.lat || process.env.LUKE_WEATHER_LAT,
    lon: req.query.lon || process.env.LUKE_WEATHER_LON,
    timezone: req.query.tz || process.env.LUKE_WEATHER_TZ || 'America/New_York',
  });
  const news = await fetchDailyNews({ limitPerCategory: 8 });
  res.json(buildDailyBrief({
    kind: req.query.kind || req.query.type || 'morning',
    weather,
    news,
  }));
});

router.post('/daily/checkin', (req, res) => {
  try {
    res.json({ ok: true, checkin: recordDailyCheckin(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.get('/history-career', (req, res) => {
  res.json(buildHistoryCareerSpine());
});

router.post('/history-career/opportunity', (req, res) => {
  try {
    res.json({ ok: true, opportunity: recordOpportunity(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.post('/report', (req, res) => {
  try {
    res.json({ ok: true, report: recordSubagentReport(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

router.post('/inquiry', (req, res) => {
  try {
    res.json({ ok: true, ...answerInquiry(req.body || {}) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
module.exports._internal = {
  answerInquiry,
  buildBrainSnapshot,
  buildTradingReport,
  buildDeveloperStackSpine,
  recordSubagentReport,
};
