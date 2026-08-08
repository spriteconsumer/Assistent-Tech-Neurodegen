const express = require('express');
const router = express.Router();
const lifeGraph = require('../lifeGraph.json');
const todayStatus = require('../todayStatus.json');
const { generateReply } = require('../llmClient');

// In-memory toggle so a demo can flip between a normal day and an anomaly day
// without needing real activity data. Defaults to the anomaly day for the demo.
let currentDayKey = 'anomaly_day';

/**
 * Compares today's observed status against the person's usual routine
 * and returns a plain list of what's different. This does not diagnose
 * anything — it only flags deviations from the established pattern.
 */
function detectAnomalies(graph, today) {
  const anomalies = [];

  if (today.walk_done === false) {
    anomalies.push(`Usually takes a walk around ${graph.routine.walk} — no walk today.`);
  }
  if (today.breakfast_done === false) {
    anomalies.push(`Usually has breakfast around ${graph.routine.breakfast} — breakfast was skipped today.`);
  }
  if (today.medicine_taken === false) {
    anomalies.push(`Usually takes their BP medicine after breakfast — it was not taken today.`);
  }
  if (today.phone_activity === 'low') {
    anomalies.push(`Phone activity is lower than usual today.`);
  }
  if (today.wake && today.wake !== graph.routine.wake) {
    anomalies.push(`Usually wakes around ${graph.routine.wake} — woke later today (${today.wake}).`);
  }

  return anomalies;
}

/**
 * GET /api/routine-check
 * returns: { routine, today, anomalies, isAlert }
 */
router.get('/routine-check', (req, res) => {
  const today = todayStatus[currentDayKey];
  const anomalies = detectAnomalies(lifeGraph, today);
  res.json({
    routine: lifeGraph.routine,
    today,
    anomalies,
    isAlert: anomalies.length > 0,
  });
});

/**
 * POST /api/simulate-day
 * body: { day: 'normal_day' | 'anomaly_day' }
 * Lets a demo flip between scenarios without wiring up real sensors.
 */
router.post('/simulate-day', (req, res) => {
  const { day } = req.body;
  if (!todayStatus[day]) {
    return res.status(400).json({ error: "day must be 'normal_day' or 'anomaly_day'" });
  }
  currentDayKey = day;
  res.json({ ok: true, day: currentDayKey });
});

/**
 * POST /api/family-update
 * Generates a short, human, context-rich update for a family member —
 * the "richer than a metrics dashboard" notification described in the brief.
 * body: { relation?: string } e.g. "son Rohan"
 */
router.post('/family-update', async (req, res) => {
  try {
    const today = todayStatus[currentDayKey];
    const anomalies = detectAnomalies(lifeGraph, today);
    const relation = req.body.relation || `${lifeGraph.family.daughter.name} (daughter)`;

    const prompt = `Write a short update (2-3 sentences) for ${relation} about ${lifeGraph.name}, their family member.

Today's observations: ${JSON.stringify(today)}
Deviations from the usual routine: ${anomalies.length ? anomalies.join(' ') : 'None — today matched their normal routine.'}
Usual routine for context: ${JSON.stringify(lifeGraph.routine)}

Write it the way a thoughtful caregiver would phrase it to family — specific and warm, not a robotic metrics readout. Do not diagnose any medical condition. If there are deviations, note them plainly and suggest checking in, without alarming language.`;

    const { text: draft, provider } = await generateReply({
      system: null,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 200,
    });

    res.json({ draft, provider, anomalies, isAlert: anomalies.length > 0 });
  } catch (err) {
    console.error('Family update route error:', err);
    res.status(502).json({ error: err.message || 'Both AI providers failed' });
  }
});

/**
 * GET /api/lifegraph
 * Exposes the full graph, e.g. for a UI to render family tree / preferences.
 */
router.get('/lifegraph', (req, res) => {
  res.json(lifeGraph);
});

module.exports = router;
