const express = require('express');
const router = express.Router();
const memories = require('../data/memories.json');

/**
 * GET /api/memories
 * Returns every memory photo, grouped by its `group` field (person/event
 * label chosen when the memory was seeded). No pagination — the seed set
 * is small by design for a family gallery.
 *
 * returns: { groups: { [groupName]: Memory[] } }
 */
router.get('/memories', (req, res) => {
  const groups = {};
  for (const memory of memories) {
    const key = memory.group || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(memory);
  }
  // newest first within each group
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  res.json({ groups });
});

module.exports = router;
