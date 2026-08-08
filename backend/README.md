# Saathi backend (demo)

Backend-only. No UI here — these are the endpoints for whoever builds the frontend.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then paste your GEMINI_API_KEY and GROQ_API_KEY into .env
npm start
```

Requires Node 18+ (uses the built-in `fetch`).

### Getting free keys (no credit card, no student ID)
- Gemini (primary): https://aistudio.google.com — sign in with any Google account, create an API key.
- Groq (fallback): https://console.groq.com — sign up with email, create an API key.

## How the AI provider fallback works

`llmClient.js` is the single place that talks to an AI provider. Every route calls `generateReply({ system, messages, maxTokens })` — it doesn't know or care which provider actually answers.

1. It tries **Gemini** first.
2. If Gemini fails for any reason (rate limit, quota exceeded, network error, missing key), it automatically retries the same request on **Groq**.
3. It only throws an error if both fail.

The response includes `provider: 'gemini' | 'groq'` so you can see (and log, or show in a UI) which one answered — handy for noticing when you've burned through the Gemini free tier.

## Data

- `lifeGraph.json` — the seeded "life graph" for the demo persona (Kamala Devi): family, memories, preferences, routine, health. In the real product this gets built up over time; for the demo it's hand-written.
- `todayStatus.json` — two hardcoded scenarios (`normal_day` / `anomaly_day`) standing in for real activity/sensor data.
- `data/memories.json` — seeded family photo memories for the gallery (placeholder images).
- `data/routine_logs.json` — persisted daily checklist state, keyed by date. Created empty; fills in as the checklist is used.
- `data/chat_history.json` — persisted chat sessions, keyed by a generated session id. Created empty; fills in as conversations happen.

## Endpoints

### `POST /api/chat`
Companion chat. The system prompt is built from `lifeGraph.json` so replies reference real facts about the person.

Request:
```json
{ "message": "I'm feeling a bit low today.", "history": [] }
```
Response:
```json
{ "reply": "...", "provider": "gemini", "updatedHistory": [ /* pass this back in as history next turn */ ] }
```

### `GET /api/lifegraph`
Returns the full life graph — useful for rendering a family tree / preferences view.

### `GET /api/routine-check`
Returns `{ routine, today, anomalies, isAlert }` — today's status compared against the usual routine, and a plain-language list of deviations.

### `POST /api/simulate-day`
Body: `{ "day": "normal_day" }` or `{ "day": "anomaly_day" }`. Flips which scenario `/api/routine-check` and `/api/family-update` use — lets you demo both states live without needing real sensor data.

### `POST /api/family-update`
Generates a short, warm, human update for a family member (the "richer than a metrics dashboard" notification from the brief), grounded in the current anomalies and routine. Optional body: `{ "relation": "son Rohan" }` (defaults to the daughter).

Response:
```json
{ "draft": "...", "provider": "gemini", "anomalies": [...], "isAlert": true }
```

### `GET /api/memories`
Returns the seeded family photo memories, grouped by person/event.
Response: `{ "groups": { "Rohan": [ { id, url, caption, date, group }, ... ], ... } }`
Data lives in `data/memories.json`.

### `GET /api/routine/today`
Returns today's persisted checklist state (separate from the anomaly-detection
`/api/routine-check` above — this one is user-toggled, not simulated).
Response: `{ "tasks": [ { id, label, time }, ... ], "log": { date, completions, updatedAt } }`

### `POST /api/routine/toggle`
Body: `{ "task_id": "walk", "status": false }`
Persists the toggle to `data/routine_logs.json` (keyed by date). When a task is
turned **off**, the response also includes a warm, one-sentence, non-clinical
check-in prompt: `{ "log": {...}, "ai_prompt": "...", "provider": "gemini", "fallback_used": false }`.

### `GET /api/chat/sessions`
Lists past conversations (title + last-updated + message count), most recent
first. Titles are taken from the first message of each session.

### `GET /api/chat/sessions/:id`
Returns one full conversation (`{ session: { id, title, lastUpdated, messages } }`)
so it can be resumed with complete context. 404 if the id doesn't exist.

`POST /api/chat` now also accepts an optional `session_id` in the body — omit
it to start a new conversation, or pass one back to continue an existing
thread. Every turn is appended to `data/chat_history.json`, capped at 100
messages per session.

## Notes for the UI

- CORS is open for the demo.
- All responses are plain JSON — no auth layer, this is hackathon-scoped.
- `/api/chat` is stateless server-side: the frontend owns the conversation history and passes it back in `history` each call.
- If a response's `provider` field says `"groq"`, it means Gemini was rate-limited or failed and the fallback kicked in — worth knowing during a demo if replies suddenly feel different in tone.
