// Point this at wherever the backend from the Saathi repo is running.
const API_BASE = 'http://localhost:3001/api';

// -----------------------------------------------------------------------
// Persona switch (senior app vs family app — two installs, one demo page)
// -----------------------------------------------------------------------
document.querySelectorAll('.persona-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.persona-btn').forEach((b) => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');
    document.body.dataset.app = btn.dataset.persona;
    if (btn.dataset.persona === 'family') loadFamilyOverview();
  });
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

// -----------------------------------------------------------------------
// Senior app — screen navigation
// -----------------------------------------------------------------------
function showSeniorScreen(id) {
  document.querySelectorAll('#senior-app .screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'senior-today') loadTodayScreen();
  if (id === 'senior-family') loadFamilyContacts();
  if (id === 'senior-gallery') loadGallery();
  if (id === 'senior-chat-history') loadChatHistoryScreen();
  if (id === 'senior-breathing') resetBreathingScreen();
  if (id === 'senior-sounds') loadSounds();
}
document.querySelectorAll('.senior-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showSeniorScreen(btn.dataset.screen));
});
document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.id === 'breathing-back') stopBreathingExercise();
    showSeniorScreen(btn.dataset.back);
  });
});

function updateClock() {
  const el = document.getElementById('senior-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString(undefined, { weekday: 'long' }) + ', ' +
    now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
updateClock();
setInterval(updateClock, 30000);

// -----------------------------------------------------------------------
// Senior app — Talk screen: POST /api/chat, with persisted session +
// expandable transcript (Feature: expandable chat with history)
// -----------------------------------------------------------------------
let chatHistory = [];       // [{role, content}] — sent back on every turn for context
let currentSessionId = null; // null = a new session will be created on first message
let isChatExpanded = false;
let pendingContext = null;   // set by "wanna talk about it?" deep-links

const talkForm = document.getElementById('talk-form');
const talkInput = document.getElementById('talk-input');
const lastSaid = document.getElementById('last-said');
const chatTranscript = document.getElementById('chat-transcript');
const micBtn = document.getElementById('mic-btn');
const micCaption = document.getElementById('mic-caption');

function renderTranscript() {
  if (!chatHistory.length) {
    chatTranscript.innerHTML = '<p class="transcript-empty">No messages yet in this conversation.</p>';
    return;
  }
  chatTranscript.innerHTML = chatHistory.map((m) => `
    <div class="transcript-row ${m.role}">
      <p class="transcript-bubble">${escapeHtml(m.content)}</p>
    </div>
  `).join('');
  chatTranscript.scrollTop = chatTranscript.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('expand-btn').addEventListener('click', () => {
  isChatExpanded = !isChatExpanded;
  document.getElementById('senior-talk').classList.toggle('chat-expanded', isChatExpanded);
  lastSaid.hidden = isChatExpanded;
  chatTranscript.hidden = !isChatExpanded;
  if (isChatExpanded) renderTranscript();
});

document.getElementById('history-btn').addEventListener('click', () => {
  showSeniorScreen('senior-chat-history');
});

async function sendMessage(message) {
  talkInput.value = '';
  lastSaid.textContent = 'let me think about that…';

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory, session_id: currentSessionId }),
    });
    if (!res.ok) throw new Error('chat request failed');
    const data = await res.json();
    chatHistory = data.updatedHistory || chatHistory;
    currentSessionId = data.session_id || currentSessionId;
    lastSaid.textContent = data.reply || "sorry, I didn't quite catch that.";
    if (isChatExpanded) renderTranscript();
  } catch (err) {
    console.error(err);
    lastSaid.textContent =
      "I couldn't reach the server. Make sure the backend is running at " + API_BASE + '.';
  }
}

talkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = talkInput.value.trim();
  if (!message) return;
  await sendMessage(message);
});

// Opens the Talk screen with a preset first message (used by the "wanna
// talk about it?" flow from the daily checklist).
function presetChatContext(text) {
  showSeniorScreen('senior-talk');
  sendMessage(text);
}

// --- Old conversations: list + resume with full context ---
async function loadChatHistoryScreen() {
  const el = document.getElementById('chat-history-list');
  el.textContent = 'loading conversations…';
  try {
    const res = await fetch(`${API_BASE}/chat/sessions`);
    const data = await res.json();
    const sessions = data.sessions || [];
    if (!sessions.length) {
      el.innerHTML = '<p class="chat-history-empty">No past conversations yet — everything you say to Saathi will show up here.</p>';
      return;
    }
    el.innerHTML = sessions.map((s) => `
      <button class="chat-history-card" data-id="${s.id}">
        <p class="chc-title">${escapeHtml(s.title)}</p>
        <p class="chc-meta">${new Date(s.lastUpdated).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${s.messageCount} messages</p>
      </button>
    `).join('');
    el.querySelectorAll('.chat-history-card').forEach((card) => {
      card.addEventListener('click', () => resumeSession(card.dataset.id));
    });
  } catch (err) {
    console.error(err);
    el.textContent = 'Could not load conversations — is the backend running?';
  }
}

async function resumeSession(id) {
  try {
    const res = await fetch(`${API_BASE}/chat/sessions/${id}`);
    if (!res.ok) {
      showToast('This conversation was removed.');
      return;
    }
    const data = await res.json();
    chatHistory = data.session.messages.map((m) => ({ role: m.role, content: m.content }));
    currentSessionId = data.session.id;
    const lastAssistant = [...chatHistory].reverse().find((m) => m.role === 'assistant');
    lastSaid.textContent = lastAssistant ? lastAssistant.content : "let's keep talking.";
    showSeniorScreen('senior-talk');
    isChatExpanded = true;
    document.getElementById('senior-talk').classList.add('chat-expanded');
    lastSaid.hidden = true;
    chatTranscript.hidden = false;
    renderTranscript();
  } catch (err) {
    console.error(err);
    showToast('Could not reach the backend.');
  }
}

// -----------------------------------------------------------------------
// Senior app — real microphone input (Web Speech API)
// -----------------------------------------------------------------------
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript) {
      micCaption.textContent = "didn't catch that — try again?";
      return;
    }
    micCaption.textContent = 'tap and talk to me';
    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      showToast('Please enable microphone access in your browser settings.');
      micCaption.textContent = 'tap and talk to me';
      talkInput.focus();
    } else if (event.error === 'no-speech') {
      micCaption.textContent = "didn't catch that — try again?";
    } else {
      micCaption.textContent = 'voice input is unavailable right now';
    }
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.abort();
      isListening = false;
      micBtn.classList.remove('listening');
      micCaption.textContent = 'tap and talk to me';
      return;
    }
    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add('listening');
      micCaption.textContent = 'listening…';
    } catch (err) {
      // start() throws if called twice in quick succession — ignore.
    }
  });
} else {
  // Unsupported browser: fall back to focusing the text field, as before.
  micCaption.textContent = 'tap to type (voice not supported here)';
  micBtn.addEventListener('click', () => talkInput.focus());
}

// -----------------------------------------------------------------------
// Senior app — Today screen: persisted daily routine checklist
// GET/POST /api/routine/*  (separate from the anomaly-detection endpoint
// used by the family dashboard's /api/routine-check)
// -----------------------------------------------------------------------
async function loadTodayScreen() {
  const summaryEl = document.getElementById('today-summary');
  const listEl = document.getElementById('today-list');
  summaryEl.textContent = 'loading today\u2019s routine\u2026';
  listEl.innerHTML = '';
  hideWannaTalkCard();

  try {
    const res = await fetch(`${API_BASE}/routine/today`);
    const data = await res.json();
    renderChecklist(data);
  } catch (err) {
    console.error(err);
    summaryEl.textContent = 'Could not load today\u2019s routine — is the backend running?';
  }
}

function renderChecklist(data) {
  const summaryEl = document.getElementById('today-summary');
  const listEl = document.getElementById('today-list');
  const { tasks, log } = data;
  const doneCount = tasks.filter((t) => log.completions[t.id]).length;
  summaryEl.textContent = doneCount === tasks.length
    ? 'everything is checked off for today — well done!'
    : `${doneCount} of ${tasks.length} done so far today.`;

  listEl.innerHTML = tasks.map((t) => `
    <label class="today-row routine-row">
      <input type="checkbox" class="routine-checkbox" data-task="${t.id}" ${log.completions[t.id] ? 'checked' : ''} />
      <div>
        <p class="t-title">${t.label}</p>
        <p class="t-sub">${t.time || ''}</p>
      </div>
    </label>
  `).join('');

  listEl.querySelectorAll('.routine-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => toggleRoutineItem(cb.dataset.task, cb.checked, cb));
  });
}

async function toggleRoutineItem(taskId, status, checkboxEl) {
  try {
    const res = await fetch(`${API_BASE}/routine/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, status }),
    });
    if (!res.ok) throw new Error('toggle failed');
    const data = await res.json();

    if (status === false && data.ai_prompt) {
      showWannaTalkCard(data.ai_prompt, taskId);
    } else {
      hideWannaTalkCard();
    }

    // Re-render the summary line to reflect the new count.
    const doneCount = Object.values(data.log.completions).filter(Boolean).length;
    const total = Object.keys(data.log.completions).length;
    document.getElementById('today-summary').textContent = doneCount === total
      ? 'everything is checked off for today — well done!'
      : `${doneCount} of ${total} done so far today.`;
  } catch (err) {
    console.error(err);
    showToast("Couldn't save — try again");
    if (checkboxEl) checkboxEl.checked = !status; // revert
  }
}

function showWannaTalkCard(text, taskId) {
  const card = document.getElementById('wanna-talk-card');
  document.getElementById('wanna-talk-text').textContent = text;
  card.hidden = false;
  document.getElementById('wanna-talk-btn').onclick = () => {
    presetChatContext(text);
  };
}

function hideWannaTalkCard() {
  document.getElementById('wanna-talk-card').hidden = true;
}

// -----------------------------------------------------------------------
// Senior app — Family (contacts) screen: GET /api/lifegraph
// -----------------------------------------------------------------------
async function loadFamilyContacts() {
  const el = document.getElementById('family-contacts');
  el.textContent = 'loading family\u2026';
  try {
    const res = await fetch(`${API_BASE}/lifegraph`);
    const graph = await res.json();
    const people = [
      graph.family?.daughter && { name: graph.family.daughter.name, rel: 'daughter' },
      graph.family?.son && { name: graph.family.son.name, rel: 'son' },
      graph.family?.grandson && { name: graph.family.grandson.name, rel: 'grandson' },
    ].filter(Boolean);

    el.innerHTML = people.map((p) => `
      <div class="contact-tile">
        <div class="contact-avatar">${p.name.charAt(0)}</div>
        <div>
          <p class="c-name">${p.name}</p>
          <p class="t-sub" style="margin:0;">${p.rel}</p>
        </div>
      </div>
    `).join('') || '<p>No family added yet.</p>';
  } catch (err) {
    console.error(err);
    el.textContent = 'Could not load family — is the backend running?';
  }
}

// -----------------------------------------------------------------------
// Senior app — Memory gallery screen: GET /api/memories
// -----------------------------------------------------------------------
async function loadGallery() {
  const el = document.getElementById('gallery-groups');
  el.textContent = 'loading memories…';
  try {
    const res = await fetch(`${API_BASE}/memories`);
    const data = await res.json();
    const groupNames = Object.keys(data.groups || {});
    if (!groupNames.length) {
      el.innerHTML = '<p class="gallery-empty">No memories shared yet 💛</p>';
      return;
    }
    el.innerHTML = groupNames.map((group) => `
      <div class="gallery-group">
        <h3 class="gallery-group-title">${escapeHtml(group)}</h3>
        <div class="gallery-grid">
          ${data.groups[group].map((m) => `
            <figure class="memory-card">
              <img src="${m.url}" alt="${escapeHtml(m.caption)}" loading="lazy"
                   onerror="this.onerror=null;this.src='';this.classList.add('broken');" />
              <figcaption>${escapeHtml(m.caption)}</figcaption>
            </figure>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    el.textContent = 'Could not load memories — is the backend running?';
  }
}

// -----------------------------------------------------------------------
// Senior app — Two-minute box breathing exercise
// 4 phases (breathe in / hold / breathe out / hold), 4 seconds each,
// cycling for 2 minutes total, with a visual pacing circle.
// -----------------------------------------------------------------------
const BREATHING_PHASES = [
  { label: 'breathe in', className: 'inhale' },
  { label: 'hold', className: 'hold-full' },
  { label: 'breathe out', className: 'exhale' },
  { label: 'hold', className: 'hold-empty' },
];
const PHASE_SECONDS = 4;
const TOTAL_SECONDS = 120;

let breathingInterval = null;
let breathingSecondsLeft = TOTAL_SECONDS;
let breathingPhaseIndex = 0;
let breathingIsRunning = false;

function resetBreathingScreen() {
  stopBreathingExercise();
  breathingSecondsLeft = TOTAL_SECONDS;
  breathingPhaseIndex = 0;
  updateBreathingUI();
  document.getElementById('breathing-start-btn').textContent = 'start';
}

function updateBreathingUI() {
  const circle = document.getElementById('breathing-circle');
  const phaseEl = document.getElementById('breathing-phase');
  const timerEl = document.getElementById('breathing-timer');

  const phase = BREATHING_PHASES[breathingPhaseIndex];
  circle.className = 'breathing-circle ' + phase.className;
  phaseEl.textContent = phase.label;

  const mins = Math.floor(breathingSecondsLeft / 60);
  const secs = breathingSecondsLeft % 60;
  timerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

function startBreathingExercise() {
  if (breathingIsRunning) return;
  breathingIsRunning = true;
  document.getElementById('breathing-start-btn').textContent = 'pause';
  updateBreathingUI();

  breathingInterval = setInterval(() => {
    breathingSecondsLeft -= 1;
    if (breathingSecondsLeft % PHASE_SECONDS === 0) {
      breathingPhaseIndex = (breathingPhaseIndex + 1) % BREATHING_PHASES.length;
    }
    updateBreathingUI();
    if (breathingSecondsLeft <= 0) {
      stopBreathingExercise();
      document.getElementById('breathing-phase').textContent = 'well done 💛';
      document.getElementById('breathing-start-btn').textContent = 'start again';
      breathingSecondsLeft = TOTAL_SECONDS;
      breathingPhaseIndex = 0;
    }
  }, 1000);
}

function stopBreathingExercise() {
  breathingIsRunning = false;
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
  }
}

document.getElementById('breathing-start-btn').addEventListener('click', () => {
  if (breathingIsRunning) {
    stopBreathingExercise();
    document.getElementById('breathing-start-btn').textContent = 'resume';
  } else {
    startBreathingExercise();
  }
});

// -----------------------------------------------------------------------
// Senior app — Soothing sounds player (rain, temple bells, river, birds,
// soft tanpura hum). Only one plays at a time; explicit tap to start.
// -----------------------------------------------------------------------
const SOUNDS = [
  { id: 'rain', label: '🌧 Rain', file: 'audio/rain.mp3' },
  { id: 'temple_bells', label: '🔔 Temple Bells', file: 'audio/temple_bells.mp3' },
  { id: 'river', label: '🏞 River', file: 'audio/river.mp3' },
  { id: 'birds', label: '🐦 Morning Birds', file: 'audio/birds.mp3' },
  { id: 'bhajan_hum', label: '🎶 Soft Hum', file: 'audio/bhajan_hum.mp3' },
];
let currentAudio = null;
let currentSoundId = null;

function loadSounds() {
  const el = document.getElementById('sound-list');
  el.innerHTML = SOUNDS.map((s) => `
    <div class="sound-card">
      <span class="sound-label">${s.label}</span>
      <button class="sound-play-btn" data-id="${s.id}">▶</button>
    </div>
  `).join('');
  el.querySelectorAll('.sound-play-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleSound(btn.dataset.id, btn));
  });
}

function toggleSound(id, btnEl) {
  const sound = SOUNDS.find((s) => s.id === id);

  // Stop whatever is currently playing first — only one sound at a time.
  if (currentAudio) {
    currentAudio.pause();
    document.querySelectorAll('.sound-play-btn').forEach((b) => { b.textContent = '▶'; });
    const wasSameSound = currentSoundId === id;
    currentAudio = null;
    currentSoundId = null;
    if (wasSameSound) return; // tapping the playing sound again just stops it
  }

  currentAudio = new Audio(sound.file);
  currentAudio.loop = true;
  currentAudio.play().catch((err) => {
    console.error('Playback failed:', err);
    showToast('Could not play that sound.');
  });
  currentSoundId = id;
  btnEl.textContent = '⏸';
}

// -----------------------------------------------------------------------
// Senior app — help button (placeholder for a real emergency-contact call)
// -----------------------------------------------------------------------
document.getElementById('help-btn').addEventListener('click', () => {
  showToast('Connecting you with your emergency contact…');
});

// -----------------------------------------------------------------------
// Family app — Overview: GET /api/routine-check + POST /api/family-update
// -----------------------------------------------------------------------
async function loadFamilyOverview() {
  const nameEl = document.getElementById('family-person-name');
  const avatarEl = document.getElementById('family-avatar');
  const updatedEl = document.getElementById('family-updated');
  const statusCard = document.getElementById('status-card');
  const recentList = document.getElementById('recent-list');

  statusCard.className = 'status-card';
  statusCard.innerHTML = '<p class="status-line">checking in\u2026</p>';

  try {
    const [graphRes, routineRes] = await Promise.all([
      fetch(`${API_BASE}/lifegraph`),
      fetch(`${API_BASE}/routine-check`),
    ]);
    const graph = await graphRes.json();
    const routine = await routineRes.json();

    nameEl.textContent = graph.name || 'your family member';
    avatarEl.textContent = (graph.name || '?').charAt(0);
    updatedEl.textContent = 'last update: just now';

    renderRecent(routine);

    // Ask the backend to draft a warm, human summary grounded in today's data.
    const updateRes = await fetch(`${API_BASE}/family-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const update = await updateRes.json();
    renderStatusCard(update);
  } catch (err) {
    console.error(err);
    statusCard.className = 'status-card alert';
    statusCard.innerHTML =
      '<p class="status-line">Could not reach the backend. Make sure it\u2019s running at ' + API_BASE + '.</p>';
  }
}

function renderStatusCard(update) {
  const statusCard = document.getElementById('status-card');
  const isAlert = update.isAlert;
  statusCard.className = 'status-card ' + (isAlert ? 'alert' : 'ok');
  statusCard.innerHTML = `
    <div class="status-line-top">${isAlert ? '⚠ worth a check-in' : '✓ everything looks normal today'}</div>
    <p class="status-line">${update.draft || ''}</p>
  `;
}

function renderRecent(routine) {
  const recentList = document.getElementById('recent-list');
  const today = routine.today || {};
  const rows = [
    today.medicine_taken && { title: 'took blood pressure medicine', time: 'this morning' },
    today.walk_done && { title: 'morning walk completed', time: 'this morning' },
    today.breakfast_done === false && { title: 'breakfast not yet recorded', time: 'today' },
  ].filter(Boolean);

  recentList.innerHTML = rows.map((r) => `
    <div class="recent-row">
      <p class="r-title">${r.title}</p>
      <p class="r-time">${r.time}</p>
    </div>
  `).join('') || '<p class="r-title">No activity recorded yet today.</p>';
}

document.getElementById('call-btn').addEventListener('click', () => showToast('Calling…'));
document.getElementById('photo-btn').addEventListener('click', () => showToast('Opening photo picker…'));

// -----------------------------------------------------------------------
// Shared — demo controls: POST /api/simulate-day
// -----------------------------------------------------------------------
document.querySelectorAll('.demo-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll(`.demo-btn[data-day]`).forEach((b) => {
      if (b.closest('.app') === btn.closest('.app')) b.classList.remove('active');
    });
    btn.classList.add('active');
    try {
      await fetch(`${API_BASE}/simulate-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: btn.dataset.day }),
      });
      showToast(`Simulating: ${btn.dataset.day.replace('_', ' ')}`);
      if (document.body.dataset.app === 'senior' &&
          document.getElementById('senior-today').classList.contains('active')) {
        loadTodayScreen();
      }
      if (document.body.dataset.app === 'family') {
        loadFamilyOverview();
      }
    } catch (err) {
      console.error(err);
      showToast('Could not reach the backend.');
    }
  });
});

// Initial load
loadFamilyOverview();
