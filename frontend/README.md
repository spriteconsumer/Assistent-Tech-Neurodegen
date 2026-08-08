# Saathi frontend (demo)

Plain HTML/CSS/JS — no build step, no framework. Talks to the Saathi backend over `fetch`.

## Run it

1. Start the backend first (see its own README) — by default it listens on `http://localhost:3001`.
2. Serve this folder as static files (opening `index.html` directly also works, but a local server avoids browser file:// quirks):
   ```bash
   npx serve .
   # or: python3 -m http.server 5173
   ```
3. Open it in your browser. Use the pill switcher at the top to flip between the **senior companion** view and the **family dashboard** view — in the real product these are two separate installs, bundled together here for demoing.

If your backend runs somewhere other than `http://localhost:3001`, change `API_BASE` at the top of `app.js`.

## What's wired up

| Screen | Endpoint |
|---|---|
| Senior → Talk | `POST /api/chat` (persists to a session; pass `session_id` back to continue it) |
| Senior → Talk → 📜 old conversations | `GET /api/chat/sessions`, `GET /api/chat/sessions/:id` |
| Senior → Talk → ⛶ expand | client-side only — toggles the full transcript view of the current session |
| Senior → Today (checklist) | `GET /api/routine/today`, `POST /api/routine/toggle` |
| Senior → Family (contacts) | `GET /api/lifegraph` |
| Senior → Memories | `GET /api/memories` |
| Senior → Breathe | client-side only — 2-minute box breathing timer, no backend call |
| Senior → Sounds | client-side only — plays looping files from `frontend/audio/` |
| Family → Overview | `GET /api/lifegraph`, `GET /api/routine-check`, `POST /api/family-update` |
| Both → demo day toggle | `POST /api/simulate-day` |

Voice input on the Talk screen now uses the real `SpeechRecognition` /
`webkitSpeechRecognition` Web Speech API — tap the mic, speak, and it sends
what you said. If the browser doesn't support it, the mic button falls back
to focusing the text field (same behaviour as before) instead of erroring.
Microphone permission denial and "no speech detected" both show a friendly
toast/caption instead of a crash.

## What's stubbed (no backend endpoint exists yet)

- **I need help** button — shows a toast only. Wire to a real emergency-contact call/SMS when that exists.
- **Call now / send photo** on the family dashboard — same, toasts only.
- Memory gallery photos are placeholder images (`picsum.photos`) tied to the seeded captions in `backend/data/memories.json` — there's no upload flow yet, just a read-only, grouped view.

## Design notes

The two views intentionally look and feel different — warm cream + teal + serif for the senior app (calm, oversized, low cognitive load), cool gray + indigo + small sans for the family app (dense, glanceable, standard mobile patterns). That split follows from the UI plan: these are two different products for two different users, not one app with a role switch.
