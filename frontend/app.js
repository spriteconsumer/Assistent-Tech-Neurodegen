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
}
document.querySelectorAll('.senior-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showSeniorScreen(btn.dataset.screen));
});
document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => showSeniorScreen(btn.dataset.back));
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
// Senior app — Talk screen: POST /api/chat
// -----------------------------------------------------------------------
let chatHistory = [];

const talkForm = document.getElementById('talk-form');
const talkInput = document.getElementById('talk-input');
const lastSaid = document.getElementById('last-said');
const micBtn = document.getElementById('mic-btn');

micBtn.addEventListener('click', () => talkInput.focus());

talkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = talkInput.value.trim();
  if (!message) return;
  talkInput.value = '';
  micBtn.classList.add('listening');
  lastSaid.textContent = 'let me think about that…';

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory }),
    });
    if (!res.ok) throw new Error('chat request failed');
    const data = await res.json();
    chatHistory = data.updatedHistory || chatHistory;
    lastSaid.textContent = data.reply || "sorry, I didn't quite catch that.";
  } catch (err) {
    console.error(err);
    lastSaid.textContent =
      "I couldn't reach the server. Make sure the backend is running at " + API_BASE + '.';
  } finally {
    micBtn.classList.remove('listening');
  }
});

// -----------------------------------------------------------------------
// Senior app — Today screen: GET /api/routine-check
// -----------------------------------------------------------------------
async function loadTodayScreen() {
  const summaryEl = document.getElementById('today-summary');
  const listEl = document.getElementById('today-list');
  summaryEl.textContent = 'loading today\u2019s routine\u2026';
  listEl.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/routine-check`);
    const data = await res.json();
    renderTodaySummary(data);
    renderTodayList(data);
  } catch (err) {
    console.error(err);
    summaryEl.textContent = 'Could not load today\u2019s routine — is the backend running?';
  }
}

function renderTodaySummary(data) {
  const summaryEl = document.getElementById('today-summary');
  if (data.anomalies && data.anomalies.length) {
    summaryEl.textContent = 'a couple of things looked different today: ' +
      data.anomalies.map((a) => a.toLowerCase()).join(' ');
  } else {
    summaryEl.textContent = 'today has been following your usual routine so far.';
  }
}

function renderTodayList(data) {
  const listEl = document.getElementById('today-list');
  const today = data.today || {};
  const routine = data.routine || {};

  const rows = [
    { label: 'morning walk', done: today.walk_done, time: routine.walk },
    { label: 'breakfast', done: today.breakfast_done, time: routine.breakfast },
    { label: 'blood pressure medicine', done: today.medicine_taken, time: 'with breakfast' },
  ];

  listEl.innerHTML = rows.map((r) => `
    <div class="today-row">
      <span class="today-dot">${r.done ? '✅' : '⭕️'}</span>
      <div>
        <p class="t-title">${r.label}</p>
        <p class="t-sub">${r.time || ''}</p>
      </div>
    </div>
  `).join('');
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
