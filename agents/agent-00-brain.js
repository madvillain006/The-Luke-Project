'use strict';

const express = require('express');
const {
  answerInquiry,
  buildBrainSnapshot,
  buildTradingReport,
  recordSubagentReport,
} = require('../lib/brain/brain-core');
const { buildDailySpine, fetchWeather, recordDailyCheckin } = require('../lib/brain/daily-spine');
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

router.get('/daily', async (req, res) => {
  const weather = await fetchWeather({
    lat: req.query.lat || process.env.LUKE_WEATHER_LAT,
    lon: req.query.lon || process.env.LUKE_WEATHER_LON,
    timezone: req.query.tz || process.env.LUKE_WEATHER_TZ || 'America/New_York',
  });
  res.json(buildDailySpine({ weather }));
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
  recordSubagentReport,
};
