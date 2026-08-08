const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const lifeGraph = require('../lifeGraph.json');
const { generateReply } = require('../llmClient');

const HISTORY_PATH = path.join(__dirname, '../data/chat_history.json');

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch (err) {
    return { sessions: {} };
  }
}

function writeHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// Short, readable title from the first user message — no extra AI call,
// just a plain truncation so a new session shows up in the history list
// with something more useful than "Untitled".
function titleFromMessage(message) {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  return trimmed.length > 42 ? trimmed.slice(0, 42).trim() + '…' : trimmed;
}

/**
 * Turns the life graph into a system prompt that grounds the companion's
 * replies in this specific person's facts, routines, and memories.
 */
function buildSystemPrompt(graph) {
  return `You are "Saathi", a warm, gentle AI companion for ${graph.name}, an elderly person from ${graph.birthplace}.

You have long-term knowledge about them. Use it naturally in conversation — don't recite it like a form, weave it in the way a close family friend would.

FAMILY:
- Late husband: ${graph.family.husband}
- Daughter: ${graph.family.daughter.name} (lives in ${graph.family.daughter.location})
- Son: ${graph.family.son.name} (lives in ${graph.family.son.location})
- Grandson: ${graph.family.grandson.name}, ${graph.family.son.name}'s son, age ${graph.family.grandson.age}

MEMORIES THEY HAVE SHARED:
${graph.memories.map((m) => `- ${m}`).join('\n')}

PREFERENCES:
- Favourite singer: ${graph.preferences.singer}
- Favourite food: ${graph.preferences.food}
- Enjoys: ${graph.preferences.activity}
- Visits ${graph.preferences.temple}

DAILY ROUTINE:
- Wakes around ${graph.routine.wake}, tea at ${graph.routine.tea}, walk at ${graph.routine.walk}, breakfast at ${graph.routine.breakfast}
- ${graph.routine.medicine}

RULES:
- Keep replies short and warm: 2-4 sentences.
- Reference specific facts above when it fits naturally — don't force it into every message.
- Never quiz, test, or correct their memory. Reinforce identity gently instead of interrogating it.
- Never give medical advice or diagnose anything. If health comes up, gently suggest checking with family or a doctor.
- Speak the way a caring companion would, not a clinical assistant.`;
}

/**
 * POST /api/chat
 * body: {
 *   message: string,
 *   history?: Array<{role: 'user'|'assistant', content: string}>,
 *   session_id?: string   // omit to start a new conversation
 * }
 * returns: { reply, provider, updatedHistory, session_id }
 *
 * Every turn is appended to backend/data/chat_history.json under
 * `session_id`, so the conversation can be listed and resumed later with
 * full context (Feature: expandable chat with history).
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [], session_id } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }

    const messages = [...history, { role: 'user', content: message }];

    const { text: reply, provider } = await generateReply({
      system: buildSystemPrompt(lifeGraph),
      messages,
      maxTokens: 300,
    });

    const updatedHistory = [...messages, { role: 'assistant', content: reply }];

    // Persist this turn to the session store.
    const historyStore = readHistory();
    const id = session_id || crypto.randomUUID();
    const now = new Date().toISOString();
    if (!historyStore.sessions[id]) {
      historyStore.sessions[id] = {
        id,
        title: titleFromMessage(message),
        lastUpdated: now,
        messages: [],
      };
    }
    historyStore.sessions[id].messages.push(
      { role: 'user', content: message, timestamp: now },
      { role: 'assistant', content: reply, timestamp: now }
    );
    historyStore.sessions[id].lastUpdated = now;
    // Cap a single session at 100 messages so the JSON file can't grow
    // without bound in a long-running demo.
    if (historyStore.sessions[id].messages.length > 100) {
      historyStore.sessions[id].messages = historyStore.sessions[id].messages.slice(-100);
    }
    writeHistory(historyStore);

    res.json({ reply, provider, updatedHistory, session_id: id });
  } catch (err) {
    console.error('Chat route error:', err);
    res.status(502).json({ error: err.message || 'Both AI providers failed' });
  }
});

module.exports = router;
