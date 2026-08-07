# Saathi (demo)

An AI eldercare companion — a warm, voice-first companion for the senior, and a calm status dashboard for family, both grounded in a shared "life graph."

```
saathi/
├── backend/    Express API — chat, routine anomaly detection, family updates
└── frontend/   Plain HTML/CSS/JS — senior companion view + family dashboard view
```

## Run both together

**1. Backend**
```bash
cd backend
npm install
cp .env.example .env   # add your GEMINI_API_KEY and GROQ_API_KEY — see backend/README.md
npm start
```
Runs at `http://localhost:3001`.

**2. Frontend** (separate terminal)
```bash
cd frontend
npx serve .
```
Open the URL it prints. Use the pill switcher at the top to flip between the senior and family views — CORS is already open on the backend, so no extra config is needed for them to talk to each other locally.

If you run the backend on a different port or host, update `API_BASE` at the top of `frontend/app.js` to match.

## AI provider

The backend calls **Gemini** first for every chat/family-update request, and automatically falls back to **Groq** if Gemini errors or hits a rate limit — no manual switching needed. Both have free tiers with no credit card or student ID required. See `backend/README.md` for setup links and details.

## What's real vs. stubbed

Wired end-to-end: companion chat, today's routine, family contacts, family status card, family-update narrative, and the demo day-simulation toggle — all backed by the actual API.

Stubbed (UI only, no backend yet): the senior's "I need help" button and the family app's "call now" / "send photo" buttons. Both apps' data is currently seeded from `backend/lifeGraph.json` and `backend/todayStatus.json` rather than a real device/sensor feed — see `backend/README.md` for what that would take to make real.

See `backend/README.md` and `frontend/README.md` for details specific to each half.
