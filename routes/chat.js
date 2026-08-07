const express = require('express');
const router = express.Router();
const lifeGraph = require('../lifeGraph.json');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

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
 * body: { message: string, history?: Array<{role: 'user'|'assistant', content: string}> }
 * returns: { reply: string }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }

    const messages = [...history, { role: 'user', content: message }];

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: buildSystemPrompt(lifeGraph),
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const reply = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ reply, updatedHistory: [...messages, { role: 'assistant', content: reply }] });
  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
