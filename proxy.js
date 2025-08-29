/* eslint-env node */
/* global process */
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

// In-memory cache for crypto prices to avoid rate limits
const cryptoCache = new Map(); // key: `${symbol}:${vs}` -> { price, currency, ts }

// Simple crypto price proxy via CoinGecko (with short-term caching)
// Usage: /crypto-price?symbol=bitcoin&vs=inr
app.get('/crypto-price', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString().trim();
    const vs = (req.query.vs || 'usd').toString().trim().toLowerCase();
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol parameter' });
    }
    const cacheKey = `${symbol}:${vs}`;
    const now = Date.now();
    const cached = cryptoCache.get(cacheKey);
    if (cached && now - cached.ts < 20000) { // 20s cache
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({ symbol, currency: vs, price: cached.price, cached: true });
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(symbol)}&vs_currencies=${encodeURIComponent(vs)}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const json = await r.json();
    if (!r.ok) {
      if (cached) {
        // Serve stale cache on error to smooth intermittent failures
        res.set('Access-Control-Allow-Origin', '*');
        return res.json({ symbol, currency: vs, price: cached.price, cached: true, stale: true });
      }
      return res.status(r.status).json({ error: 'CoinGecko error', details: json });
    }

    const price = json?.[symbol]?.[vs];
    if (typeof price !== 'number') {
      return res.status(404).json({ error: 'Price not found for symbol/vs', data: json });
    }

    res.set('Access-Control-Allow-Origin', '*');
    cryptoCache.set(cacheKey, { price, currency: vs, ts: now });
    return res.json({ symbol, currency: vs, price });
  } catch (e) {
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch crypto price', message: e.message });
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
      } catch (e2) { void e2; }
    }
    res.set("Access-Control-Allow-Origin", "*");
    res.status(500).json({
      error: "Failed to fetch from Kite Connect",
      message: err?.message || err,
      details: err?.stack || err
    });
  }
});

// Yahoo Finance real-time quote proxy (free fallback)
// Usage: /yahoo/stock-price?symbol=RELIANCE.NS
app.get('/yahoo/stock-price', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString().trim();
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    console.log(`[Yahoo] Fetching real-time quote for ${symbol}`);
    
    // Use the v7 quote endpoint for real-time data
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    
    const r = await fetch(url, { 
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      } 
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[Yahoo] Error ${r.status}: ${errorText}`);
      return res.status(r.status).json({ error: 'Yahoo Finance error', details: errorText });
    }

    const json = await r.json();
    const quote = json.quoteResponse?.result?.[0];
    
    if (!quote) {
      return res.status(404).json({ error: 'Symbol not found', symbol });
    }
    
    const price = quote.regularMarketPrice || quote.marketPrice || 0;
    const prevClose = quote.regularMarketPreviousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const volume = quote.regularMarketVolume || 0;
    const marketCap = quote.marketCap || 0;

    console.log(`[Yahoo] Success for ${symbol}: Price=${price}, Change=${change}, Volume=${volume}`);

    res.set('Access-Control-Allow-Origin', '*');
    return res.json({ 
      price, 
      change, 
      changePercent, 
      symbol,
      volume,
      marketCap,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error(`[Yahoo] Exception:`, e);
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch stock price', message: e.message });
  }
});

// Yahoo Finance historical data proxy
// Usage: /yahoo/stock-history?symbol=RELIANCE.NS&range=1mo&interval=1d
app.get('/yahoo/stock-history', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString().trim();
    const range = req.query.range || '1mo';
    const interval = req.query.interval || '1d';
    
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    console.log(`[Yahoo] Fetching historical data for ${symbol}, range=${range}, interval=${interval}`);
    
    // Use the v8 chart endpoint for historical data
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=true&events=div|split|earn`;
    
    const r = await fetch(url, { 
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      } 
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[Yahoo] Error ${r.status}: ${errorText}`);
      return res.status(r.status).json({ error: 'Yahoo Finance error', details: errorText });
    }

    const json = await r.json();
    const result = json.chart.result?.[0];
    
    if (!result) {
      return res.status(404).json({ error: 'Historical data not found', symbol });
    }
    
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote?.[0] || {};
    const closes = quotes.close || [];
    
    // Convert to chart format: {x: Date, y: price}
    const chartData = timestamps.map((timestamp, index) => ({
      x: new Date(timestamp * 1000),
      y: closes[index] || 0
    })).filter(point => point.y > 0); // Filter out invalid data points

    console.log(`[Yahoo] Historical data success for ${symbol}: ${chartData.length} data points`);

    res.set('Access-Control-Allow-Origin', '*');
    return res.json({ 
      symbol,
      range,
      interval,
      data: chartData,
      count: chartData.length
    });
  } catch (e) {
    console.error(`[Yahoo] Historical data exception:`, e);
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch historical data', message: e.message });
  }
});

// Delta Exchange OAuth authentication flow
// Step 1: Generate authentication URL
app.get('/delta/auth-url', async (req, res) => {
  try {
    const clientId = process.env.DELTA_CLIENT_ID;
    const redirectBase = process.env.DELTA_REDIRECT_URI || 'http://localhost:5173/'; // Set to your frontend origin for production
    const redirectUri = encodeURIComponent(`${redirectBase}?delta_callback=true`);
    const scope = 'read write';
    if (clientId) {
      // REAL Delta Exchange OAuth endpoint
      const authUrl = `https://auth.delta.exchange/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${Date.now()}`;
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({ auth_url: authUrl });
    } else {
      // Fallback to demo
      const demoAuthUrl = `https://auth.delta.exchange/oauth/authorize?client_id=demo_client_id&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${Date.now()}`;
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({ auth_url: demoAuthUrl, warning: "Missing DELTA_CLIENT_ID in env. Using demo mode." });
    }
  } catch (e) {
    console.error('[Delta OAuth] Error generating auth URL:', e);
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to generate auth URL', message: e.message });
  }
});

// Step 2: Handle OAuth callback and exchange code for token
app.get('/delta/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('[Delta OAuth] Authorization error:', error);
      return res.redirect(`/?delta_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      console.error('[Delta OAuth] No authorization code received');
      return res.redirect('/?delta_error=no_code');
    }
    const clientId = process.env.DELTA_CLIENT_ID;
    const clientSecret = process.env.DELTA_CLIENT_SECRET;
    const redirectBase = process.env.DELTA_REDIRECT_URI || 'http://localhost:5173/';
    const realRedirectUri = `${redirectBase}?delta_callback=true`;

    if (clientId && clientSecret) {
      // Exchange code for access token (REAL)
      const params = new URLSearchParams();
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("code", code);
      params.append("grant_type", "authorization_code");
      params.append("redirect_uri", realRedirectUri);

      try {
        const tokenResp = await fetch("https://auth.delta.exchange/oauth/token", {
          method: "POST",
          body: params,
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const tokenData = await tokenResp.json();
        if (tokenResp.ok && tokenData.access_token) {
          // Success!
          res.redirect(`/?delta_token=${encodeURIComponent(tokenData.access_token)}`);
        } else {
          // Show error
          res.redirect(`/?delta_error=${encodeURIComponent(tokenData.error_description || "Token exchange failed")}`);
        }
      } catch (tokenEx) {
        res.redirect(`/?delta_error=${encodeURIComponent(tokenEx.message)}`);
      }
    } else {
      // DEMO fallback
      const mockToken = `delta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.redirect(`/?delta_token=${mockToken}`);
    }
  } catch (e) {
    console.error('[Delta OAuth] Callback error:', e);
    res.redirect(`/?delta_error=${encodeURIComponent(e.message)}`);
  }
});

// Delta Exchange crypto price proxy (premium)
// Usage: /delta/crypto-price?symbol=BTCUSDT
app.get('/delta/crypto-price', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString().trim();
    const authHeader = req.headers.authorization;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol parameter' });
    }
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    console.log(`[Delta] Fetching crypto price for ${symbol}`);
    const url = `https://api.delta.exchange/v2/tickers/${encodeURIComponent(symbol)}`;
    
    const r = await fetch(url, { 
      headers: { 
        'Accept': 'application/json',
        'Authorization': authHeader
      } 
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[Delta] Error ${r.status}: ${errorText}`);
      return res.status(r.status).json({ error: 'Delta Exchange error', details: errorText });
    }

    const json = await r.json();
    const price = parseFloat(json.result.price) || 0;
    const change = parseFloat(json.result.change_24h) || 0;
    const changePercent = parseFloat(json.result.change_24h_percent) || 0;

    res.set('Access-Control-Allow-Origin', '*');
    return res.json({ price, change, changePercent, symbol });
  } catch (e) {
    console.error(`[Delta] Exception:`, e);
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch crypto price', message: e.message });
  }
});

// Crypto historical data proxy via CoinGecko
// Usage: /crypto-history?symbol=bitcoin&vs=usd&days=1
app.get('/crypto-history', async (req, res) => {
  try {
    const symbol = (req.query.symbol || '').toString().trim();
    const vs = (req.query.vs || 'usd').toString().trim().toLowerCase();
    const days = parseInt(req.query.days) || 1;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    console.log(`[Crypto History] Fetching ${symbol} vs ${vs} for ${days} days`);
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(symbol)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=${days}`;
    console.log(`[Crypto History] URL: ${url}`);
    
    const r = await fetch(url, { 
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      } 
    });
    
    console.log(`[Crypto History] Response status: ${r.status}`);
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`[Crypto History] Error ${r.status}: ${errorText}`);
      return res.status(r.status).json({ 
        error: 'CoinGecko error', 
        status: r.status,
        details: errorText,
        url: url
      });
    }

    const json = await r.json();
    console.log(`[Crypto History] Success for ${symbol}, data points: ${json.prices?.length || 0}`);
    
    res.set('Access-Control-Allow-Origin', '*');
    return res.json(json);
  } catch (e) {
    console.error(`[Crypto History] Exception:`, e);
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to fetch crypto history', message: e.message });
  }
});

app.use((req, res) => {
  console.log(`[Proxy] Catch-all handler: ${req.method} ${req.url}`);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Proxy server listening at http://localhost:${PORT}`);
});
