import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from "dotenv";
import { KiteConnect } from "kiteconnect";

dotenv.config({ path: "src/.env" });

// Debug: check what env vars are actually loaded
console.log('KITE_API_KEY:', process.env.KITE_API_KEY);
console.log('KITE_API_SECRET:', process.env.KITE_API_SECRET ? '***' : '(missing)');
console.log('KITE_ACCESS_TOKEN:', process.env.KITE_ACCESS_TOKEN ? '***' : '(missing)');

const app = express();
const PORT = 5050;

app.use((req, res, next) => {
  console.log(`[Proxy] Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(cors());

app.get('/proxy', async (req, res) => {
  console.log('[Proxy] /proxy handler called');
  const symbol = req.query.symbol;

  if (!symbol) {
    console.log('[Proxy] Request missing symbol parameter.');
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  // Switch to Twelve Data API for better limits
  // IMPORTANT: Replace "demo" with your real Twelve Data API key for production use!
  const TWELVE_DATA_API_KEY = 'demo';
  const apiUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=5min&apikey=${TWELVE_DATA_API_KEY}`;

  try {
    console.log(`[Proxy] Alpha Vantage Request: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    console.log(`[Proxy] Alpha Vantage Response Status: ${response.status}`);
    for (const [key, value] of response.headers.entries()) {
      console.log(`[Proxy] Response header: ${key}: ${value}`);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');

    const body = await response.text();

    console.log(`[Proxy] Alpha Vantage Response Body (first 500 chars): ${body.substring(0, 500)}`);

    if (!response.ok) {
      console.error(`Proxy error: ${response.status} ${response.statusText}`);
      console.error(`Proxy error body: ${body}`);
    }

    res.status(response.status).send(body);
  } catch (e) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: 'Proxy fetch failed', message: e.message });
  }
});

/**
 * Zerodha Kite Connect proxy endpoint
 * Requires configuration of your individual API key, secret, and access token.
 * The access token must be refreshed daily via the login flow.
 * Place your credentials in environment variables for best security.
 *
 * Usage (frontend): fetch('/kite?symbol=NSE:RELIANCE')
 * Usage (curl): curl 'http://localhost:5050/kite?symbol=NSE:RELIANCE'
 */

/**
 * Generate a Kite Connect access_token from apiKey, secret, and request_token
 * GET /kite/generate-token?request_token=...
 * Response: { access_token: ..., ... }
 */
app.get('/kite/generate-token', async (req, res) => {
  const apiKey = process.env.KITE_API_KEY;
  const secret = process.env.KITE_API_SECRET;
  const requestToken = req.query.request_token;
  
  if (!apiKey || !secret || !requestToken) {
    return res.status(400).json({ error: "Missing apiKey, secret, or request_token" });
  }
  
  const kc = new KiteConnect({ api_key: apiKey });
  
  try {
    const session = await kc.generateSession(requestToken, secret);
    res.json({ access_token: session.access_token, ...session });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate access token", message: err.message });
  }
});

app.get('/kite', async (req, res) => {
  const symbol = req.query.symbol; // e.g., NSE:RELIANCE or BSE:532174

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  // Use credentials from environment variables set by .env file!
  const apiKey = process.env.KITE_API_KEY;
  const secret = process.env.KITE_API_SECRET;
  const access_token = process.env.KITE_ACCESS_TOKEN;

  // All credentials must be defined
  if (!apiKey || !secret || !access_token) {
    return res.status(500).json({
      error: "API credentials not configured. Check that KITE_API_KEY, KITE_API_SECRET, and KITE_ACCESS_TOKEN are all set in your .env file.",
    });
  }

  // FIX: Initialize KiteConnect with only api_key, then set access_token separately
  const kite = new KiteConnect({ api_key: apiKey });
  kite.setAccessToken(access_token);

  try {
    // Fetch LTP (last traded price) for the symbol
    const ltpResult = await kite.getLTP([symbol]);
    // ltpResult looks like: { "NSE:RELIANCE": { "instrument_token": ..., "last_price": ... } }
    res.set("Access-Control-Allow-Origin", "*");
    res.json(ltpResult);
  } catch (err) {
    // Log more detail to server console
    console.error('Kite getLTP error for', symbol);
    console.error('Error message:', err?.message || err);
    if (err?.response) {
      try {
        const text = await err.response.text();
        console.error('Kite API response:', text);
      } catch (e2) {}
    }
    res.set("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      error: "Failed to fetch from Kite Connect",
      message: err?.message || err,
      details: err?.stack || err
    });
  }
});

app.use((req, res, next) => {
  console.log(`[Proxy] Catch-all handler: ${req.method} ${req.url}`);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Proxy server listening at http://localhost:${PORT}`);
});
