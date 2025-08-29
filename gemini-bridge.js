/**
 * Gemini AI chat relay server.
 * Forwards chat requests from local dashboard to Google Gemini API.
 * Usage: node gemini-bridge.js
 * Loads API key from src/.env as GEMINI_API_KEY.
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Load GEMINI_API_KEY from src/.env
function loadEnvKey() {
  const envPath = path.resolve('src/.env');
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('GEMINI_API_KEY=')) {
      return line.split('=')[1].trim();
    }
  }
  return null;
}

const GEMINI_API_KEY = loadEnvKey();
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY not found in src/.env');
}

const app = express();
const PORT = 3002;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'ok', using_key: !!GEMINI_API_KEY });
});

/**
 * POST /v1/gemini/chat
 * Accepts: { messages: [{ role: 'user', parts: [{ text: 'Your prompt' }] }], ... }
 * Returns: Gemini API response.
 */
app.post('/v1/gemini/chat', async (req, res) => {
  try {
    // Minimal payload validation/proxying
    const payload = {
      contents: req.body?.messages,
      ...req.body?.options // Allow passing additional Gemini API options
    };

    const fetchFn = (globalThis.fetch || (await import('node-fetch')).default);
    const apiResp = await fetchFn(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return res.status(apiResp.status).send({ error: errText });
    }
    const data = await apiResp.json();
    res.send(data);
  } catch (e) {
    res.status(500).send({ error: e.message || e.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini AI Bridge running at http://localhost:${PORT} -> ${GEMINI_API_URL}`);
});
