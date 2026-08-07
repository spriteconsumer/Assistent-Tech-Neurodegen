# Saathi backend (demo)

Backend-only. No UI here — these are the endpoints for whoever builds the frontend.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then paste your ANTHROPIC_API_KEY into .env
npm start
```

Requires Node 18+ (uses the built-in `fetch`).

## Data

- `lifeGraph.json` — the seeded "life graph" for the demo persona (Kamala Devi): family, memories, preferences, routine, health. In the real product this gets built up over time; for the demo it's hand-written.
- `todayStatus.json` — two hardcoded scenarios (`normal_day` / `anomaly_day`) standing in for real activity/sensor data.

## Endpoints

### `POST /api/chat`
Companion chat. The system prompt is built from `lifeGraph.json` so replies reference real facts about the person.

Request:
```json
{ "message": "I'm feeling a bit low today.", "history": [] }
```
Response:
```json
{ "reply": "...", "updatedHistory": [ /* pass this back in as history next turn */ ] }
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
{ "draft": "...", "anomalies": [...], "isAlert": true }
```

## Notes for the UI

- CORS is open for the demo.
- All responses are plain JSON — no auth layer, this is hackathon-scoped.
- `/api/chat` is stateless server-side: the frontend owns the conversation history and passes it back in `history` each call.
