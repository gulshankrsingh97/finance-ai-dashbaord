/**
 * Minimal Node.js AI chat relay server.
 * Forwards /v1/chat/completions POSTs from local dashboard to real AI backend (LM Studio/OSS LLM).
 * Usage: node ai-bridge.js
 * Default AI backend: http://localhost:1234
 */

import express from 'express';
import cors from 'cors';

// Node.js v18+ has fetch globally; polyfill for older versions:
let fetchFn;
try { fetchFn = fetch; } catch { fetchFn = undefined; }
if (!fetchFn) {
  // Dynamically import node-fetch if needed
  import('node-fetch').then(({default: _fetch}) => { global.fetch = _fetch; });
}

const app = express();
const PORT = process.env.PORT || 3001;
const AI_BACKEND = process.env.AI_BACKEND || 'http://localhost:1234';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/health', (req, res) => {
  res.send({ status: 'ok', ai_backend: AI_BACKEND });
});

// Relay OpenAI-style chat completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const url = `${AI_BACKEND}/v1/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).send({ error: text });
    }
    const data = await resp.json();
    res.send(data);
  } catch (e) {
    res.status(500).send({ error: e.message || e.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`AI Bridge server running at http://localhost:${PORT} -> ${AI_BACKEND}`);
});
