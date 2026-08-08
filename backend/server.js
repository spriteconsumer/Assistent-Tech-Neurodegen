require('dotenv').config();
const express = require('express');
const cors = require('cors');

const chatRoutes = require('./routes/chat');
const familyRoutes = require('./routes/family');
const chatSessionsRoutes = require('./routes/chatSessions');
const memoriesRoutes = require('./routes/memories');
const routineRoutes = require('./routes/routine');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', chatRoutes);
app.use('/api', familyRoutes);
app.use('/api', chatSessionsRoutes);
app.use('/api', memoriesRoutes);
app.use('/api', routineRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. Primary AI provider will fail until it is.');
  }
  if (!process.env.GROQ_API_KEY) {
    console.warn('WARNING: GROQ_API_KEY is not set. There will be no fallback if Gemini hits a rate limit.');
  }
});
