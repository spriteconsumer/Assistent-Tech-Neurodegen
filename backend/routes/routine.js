const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const lifeGraph = require('../lifeGraph.json');
const { generateReply } = require('../llmClient');

const LOG_PATH = path.join(__dirname, '../data/routine_logs.json');

const TASKS = [
  { id: 'tea', label: 'morning tea', time: lifeGraph.routine.tea },
  { id: 'walk', label: 'morning walk', time: lifeGraph.routine.walk },
  { id: 'breakfast', label: 'breakfast', time: lifeGraph.routine.breakfast },
  { id: 'medicine', label: 'blood pressure medicine', time: 'with breakfast' },
];
const TASK_IDS = TASKS.map((t) => t.id);

function todayKey() {
  // YYYY-MM-DD in local server time
  return new Date().toISOString().slice(0, 10);
}

function readLogs() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch (err) {
    return {};
  }
}

function writeLogs(logs) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

function getTodayLog(logs) {
  const key = todayKey();
  if (!logs[key]) {
    logs[key] = {
      date: key,
      completions: Object.fromEntries(TASK_IDS.map((id) => [id, false])),
      updatedAt: new Date().toISOString(),
    };
  }
  return logs[key];
}

/**
 * GET /api/routine/today
 * returns: { tasks: [{id,label,time}], log: { date, completions, updatedAt } }
 */
router.get('/routine/today', (req, res) => {
  const logs = readLogs();
  const log = getTodayLog(logs);
  // getTodayLog may have created today's entry — persist that so the date
  // key exists next time even if nothing gets toggled yet.
  writeLogs(logs);
  res.json({ tasks: TASKS, log });
});

/**
 * POST /api/routine/toggle
 * body: { task_id: string, status: boolean }
 * returns: { log, ai_prompt?, provider?, fallback_used? }
 *
 * When a task is toggled OFF (status === false), a warm one-sentence
 * "wanna talk about it?" prompt is generated so the senior app can offer
 * a gentle check-in without pressuring or diagnosing anything.
 */
router.post('/routine/toggle', async (req, res) => {
  const { task_id, status } = req.body;
  if (!TASK_IDS.includes(task_id) || typeof status !== 'boolean') {
    return res.status(400).json({
      error: `task_id must be one of ${TASK_IDS.join(', ')} and status must be a boolean`,
    });
  }

  const logs = readLogs();
  const log = getTodayLog(logs);
  log.completions[task_id] = status;
  log.updatedAt = new Date().toISOString();
  writeLogs(logs);

  if (status === true) {
    return res.json({ log });
  }

  // status === false: offer a gentle, non-clinical check-in
  const task = TASKS.find((t) => t.id === task_id);
  try {
    const prompt = `${lifeGraph.name} (${lifeGraph.age}, from ${lifeGraph.birthplace}) chose not to mark "${task.label}" done today. In exactly one warm sentence, gently ask if she'd like to talk about it. Never pressure her. Never diagnose anything. Never use the word "skip" — she chose, she didn't skip. Speak as Saathi, her warm companion.`;

    const { text: ai_prompt, provider } = await generateReply({
      system: null,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 60,
    });

    res.json({ log, ai_prompt, provider, fallback_used: provider === 'groq' });
  } catch (err) {
    console.warn('Routine check-in AI failed, using generic fallback:', err.message);
    res.json({ log, ai_prompt: 'Wanna talk about it? 💛', provider: null, fallback_used: false });
  }
});

module.exports = router;
