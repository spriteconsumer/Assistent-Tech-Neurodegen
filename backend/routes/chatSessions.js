const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, '../data/chat_history.json');

function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch (err) {
    return { sessions: {} };
  }
}

/**
 * GET /api/chat/sessions
 * Lists past conversations, most recently updated first. Does NOT include
 * full message bodies — just enough to render a list (title, last update).
 * returns: { sessions: [{ id, title, lastUpdated, messageCount }] }
 */
router.get('/chat/sessions', (req, res) => {
  const { sessions } = readHistory();
  const list = Object.values(sessions)
    .map((s) => ({
      id: s.id,
      title: s.title,
      lastUpdated: s.lastUpdated,
      messageCount: s.messages.length,
    }))
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  res.json({ sessions: list });
});

/**
 * GET /api/chat/sessions/:id
 * Returns one full session (all messages) so it can be resumed with
 * complete context.
 * returns: { session } | 404 if not found
 */
router.get('/chat/sessions/:id', (req, res) => {
  const { sessions } = readHistory();
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: 'conversation not found' });
  }
  res.json({ session });
});

module.exports = router;
