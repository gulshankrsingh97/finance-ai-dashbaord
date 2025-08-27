// Express backend bridge - Direct Kite Connect integration
import express from "express";
import bodyParser from "body-parser";
import { KiteConnect } from "kiteconnect";
import dotenv from "dotenv";

dotenv.config({ path: "src/.env" });

const app = express();
const PORT = 5055;

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Global variables for token management
let generatedAccessToken = null;

async function getValidAccessToken() {
  // Return existing access_token from env if available
  if (process.env.KITE_ACCESS_TOKEN) {
    return process.env.KITE_ACCESS_TOKEN;
  }
  
  // Return generated access_token if available
  if (generatedAccessToken) {
    return generatedAccessToken;
  }
  
  // Generate new access_token from request_token if available
  if (process.env.KITE_REQUEST_TOKEN) {
    const apiKey = process.env.KITE_API_KEY;
    const secret = process.env.KITE_API_SECRET;
    const requestToken = process.env.KITE_REQUEST_TOKEN;
    
    if (!apiKey || !secret) {
      throw new Error("Missing API credentials");
    }
    
    const kc = new KiteConnect({ api_key: apiKey });
    
    try {
      const session = await kc.generateSession(requestToken, secret);
      generatedAccessToken = session.access_token;
      console.log('Generated new access_token from request_token');
      return generatedAccessToken;
    } catch (err) {
      throw new Error(`Failed to generate access_token: ${err.message}`);
    }
  }
  
  throw new Error("No access_token or request_token available");
}

// POST /mcp/tool/kite-mcp-server/get_ltp { symbol }
app.post("/mcp/tool/kite-mcp-server/get_ltp", async (req, res) => {
  const symbol = req.body?.arguments?.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol argument in body" });
  }
  
  try {
    const apiKey = process.env.KITE_API_KEY;
    // Prefer access_token from frontend, fallback to old logic
    const reqAccessToken = req.body?.arguments?.access_token;
    const accessToken = reqAccessToken || await getValidAccessToken();

    const kite = new KiteConnect({ api_key: apiKey });
    kite.setAccessToken(accessToken);

    const result = await kite.getLTP([symbol]);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Kite Connect error",
      details: err?.message || err
    });
  }
});

// POST /mcp/tool/kite-mcp-server/get_quote { symbol }
app.post("/mcp/tool/kite-mcp-server/get_quote", async (req, res) => {
  const symbol = req.body?.arguments?.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol argument" });
  }
  
  try {
    const apiKey = process.env.KITE_API_KEY;
    const accessToken = await getValidAccessToken();
    
    const kite = new KiteConnect({ api_key: apiKey });
    kite.setAccessToken(accessToken);
    
    const result = await kite.getQuote([symbol]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      error: "Kite Connect error", 
      details: err?.message || err 
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Kite Connect bridge server running at http://localhost:${PORT}/`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
// Add this comprehensive test endpoint
app.post("/debug-kite", async (req, res) => {
  try {
    console.log('=== KITE DEBUG START ===');
    
    const apiKey = process.env.KITE_API_KEY;
    const accessToken = await getValidAccessToken();
    
    console.log('API Key:', apiKey);
    console.log('Access Token:', accessToken ? accessToken.substring(0, 15) + '...' : 'null');
    
    const kite = new KiteConnect({ api_key: apiKey });
    kite.setAccessToken(accessToken);
    
    const results = {};
    
    // Test 1: Profile (should work if token is valid)
    try {
      console.log('Testing getProfile...');
      const profile = await kite.getProfile();
      results.profile = { status: "SUCCESS", user_id: profile.user_id, user_name: profile.user_name };
      console.log('✅ Profile success:', profile.user_id);
    } catch (err) {
      results.profile = { status: "FAILED", error: err.message };
      console.log('❌ Profile failed:', err.message);
    }
    
    // Test 2: Margins (another basic read operation)
    try {
      console.log('Testing getMargins...');
      const margins = await kite.getMargins();
      results.margins = { status: "SUCCESS", equity: margins.equity?.available?.live_balance };
      console.log('✅ Margins success');
    } catch (err) {
      results.margins = { status: "FAILED", error: err.message };
      console.log('❌ Margins failed:', err.message);
    }
    
    // Test 3: Try different LTP calls
    const testSymbols = [
      "NSE:RELIANCE",
      "NSE:SBIN", 
      "NSE:INFY",
      "738561"  // RELIANCE instrument token
    ];
    
    results.ltp_tests = [];
    
    for (const symbol of testSymbols) {
      try {
        console.log(`Testing LTP for ${symbol}...`);
        const ltp = await kite.getLTP([symbol]);
        results.ltp_tests.push({ 
          symbol, 
          status: "SUCCESS", 
          data: ltp 
        });
        console.log(`✅ LTP ${symbol} success:`, Object.keys(ltp));
        break; // If one works, we're good
      } catch (err) {
        results.ltp_tests.push({ 
          symbol, 
          status: "FAILED", 
          error: err.message 
        });
        console.log(`❌ LTP ${symbol} failed:`, err.message);
      }
    }
    
    console.log('=== KITE DEBUG END ===');
    res.json(results);
    
  } catch (err) {
    res.status(500).json({ 
      error: "Debug failed", 
      details: err?.message || err 
    });
  }
});

// Add this endpoint BEFORE the app.listen() line
app.post("/convert-token", async (req, res) => {
  try {
    // Use the request_token from browser POST body, OR fallback to env
    const requestToken = req.body?.request_token || process.env.KITE_REQUEST_TOKEN;

    const apiKey = process.env.KITE_API_KEY;
    const secret = process.env.KITE_API_SECRET;

    console.log('Converting request_token to access_token...');
    console.log('API Key:', apiKey);
    console.log('Secret exists:', !!secret);
    console.log('Request Token:', requestToken);

    if (!apiKey || !secret) {
      return res.json({
        error: "Missing credentials",
        api_key: apiKey || "MISSING",
        secret_exists: !!secret
      });
    }

    if (!requestToken) {
      return res.json({
        error: "Missing request_token."
      });
    }

    const kc = new KiteConnect({ api_key: apiKey });
    const session = await kc.generateSession(requestToken, secret);

    res.json({
      success: true,
      message: "✅ ACCESS TOKEN GENERATED!",
      access_token: session.access_token,
      user_id: session.user_id,
      instruction: `Add to your .env: KITE_ACCESS_TOKEN=${session.access_token}`
    });

  } catch (err) {
    res.json({
      error: "Token conversion failed",
      message: err.message,
      suggestion: "Check if KITE_API_SECRET is correct in .env"
    });
  }
});
