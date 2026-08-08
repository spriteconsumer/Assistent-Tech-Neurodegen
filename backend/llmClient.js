const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Calls Gemini's generateContent endpoint.
 * messages: [{ role: 'user'|'assistant', content: string }]
 */
async function callGemini(system, messages, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError('GEMINI_API_KEY not set', 0);

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new ProviderError(`Gemini error ${response.status}: ${errText}`, response.status);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new ProviderError('Gemini returned no text (likely blocked by safety filters)', 0);
  return text;
}

/**
 * Calls Groq's OpenAI-compatible chat completions endpoint.
 */
async function callGroq(system, messages, maxTokens) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ProviderError('GROQ_API_KEY not set', 0);

  const chatMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: chatMessages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new ProviderError(`Groq error ${response.status}: ${errText}`, response.status);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new ProviderError('Groq returned no text', 0);
  return text;
}

/**
 * generateReply({ system, messages, maxTokens })
 * Tries Gemini first. On any failure (rate limit, quota, network, missing key),
 * falls back to Groq. Throws only if both fail.
 * Returns { text, provider } so callers/logs can see which one actually answered.
 */
async function generateReply({ system, messages, maxTokens = 300 }) {
  try {
    const text = await callGemini(system, messages, maxTokens);
    return { text, provider: 'gemini' };
  } catch (geminiErr) {
    console.warn(`[llmClient] Gemini failed (${geminiErr.message}), falling back to Groq`);
    try {
      const text = await callGroq(system, messages, maxTokens);
      return { text, provider: 'groq' };
    } catch (groqErr) {
      throw new Error(
        `Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`
      );
    }
  }
}

module.exports = { generateReply };
