import express from 'express';
import cors from 'cors';
import { KiteConnect } from "kiteconnect";
import dotenv from "dotenv";

dotenv.config({ path: "src/.env" });

const app = express();
const PORT = 5050;

app.use(cors());

console.log('=== SERVER STARTUP DEBUG ===');
console.log('KITE_API_KEY:', process.env.KITE_API_KEY);
console.log('KITE_API_SECRET exists:', !!process.env.KITE_API_SECRET);
console.log('==============================');

// Step 1: Redirect to Kite login page to get request_token
app.get('/kite/login', (req, res) => {
  const apiKey = process.env.KITE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "KITE_API_KEY not configured in .env" });
  }
  
  console.log('Redirecting to Kite login with API Key:', apiKey);
  
  // Redirect to Kite login page
  const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}`;
  res.redirect(loginUrl);
});

// Step 2: Enhanced callback with detailed error reporting
app.get('/kite/callback', async (req, res) => {
  const requestToken = req.query.request_token;
  const status = req.query.status;
  
  console.log('=== CALLBACK DEBUG ===');
  console.log('Status:', status);
  console.log('Request Token:', requestToken);
  console.log('API Key:', process.env.KITE_API_KEY);
  console.log('API Secret exists:', !!process.env.KITE_API_SECRET);
  
  if (status !== 'success' || !requestToken) {
    return res.json({ 
      error: "Login failed or missing request_token",
      status,
      request_token: requestToken 
    });
  }

  const apiKey = process.env.KITE_API_KEY;
  const secret = process.env.KITE_API_SECRET;
  
  // Check if credentials exist
  if (!apiKey) {
    return res.json({
      error: "KITE_API_KEY missing in .env file",
      request_token: requestToken,
      instruction: "Add KITE_API_KEY=your_key to src/.env"
    });
  }
  
  if (!secret) {
    return res.json({
      error: "KITE_API_SECRET missing in .env file", 
      request_token: requestToken,
      instruction: "Add KITE_API_SECRET=your_secret to src/.env",
      current_env: {
        api_key: apiKey,
        secret_exists: false
      }
    });
  }
  
  const kc = new KiteConnect({ api_key: apiKey });
  
  try {
    console.log('Attempting to generate session...');
    const session = await kc.generateSession(requestToken, secret);
    console.log('✅ Session generated successfully!');
    
    res.json({ 
      success: true,
      message: "SUCCESS! Copy these to your .env file:",
      request_token: requestToken,
      access_token: session.access_token,
      user_id: session.user_id,
      user_name: session.user_name,
      instructions: [
        "Add this line to your src/.env file:",
        `KITE_ACCESS_TOKEN=${session.access_token}`,
        "",
        "Then test with your bridge server!"
      ]
    });
    
  } catch (err) {
    console.error('❌ Session generation failed:', err);
    res.json({
      error: "Failed to generate access_token",
      request_token: requestToken,
      error_details: err.message,
      debug_info: {
        api_key_length: apiKey?.length,
        secret_length: secret?.length,
        request_token_length: requestToken?.length
      },
      suggestions: [
        "1. Check if KITE_API_KEY matches your Kite Connect app",
        "2. Check if KITE_API_SECRET matches your Kite Connect app", 
        "3. Make sure request_token is fresh (< 2 minutes old)",
        "4. Verify redirect URL in Kite app: http://localhost:5050/kite/callback"
      ]
    });
  }
});

/**
 * GET /crypto-price?symbol=ethereum
 * Returns: { price: number, currency: string, symbol: string }
 */
import fetch from 'node-fetch';
app.get('/crypto-price', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'ethereum').toLowerCase();
    const vsCurrency = (req.query.vs || 'usd').toLowerCase();

    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(symbol)}&vs_currencies=${encodeURIComponent(vsCurrency)}`;
    const response = await fetch(cgUrl);
    if (!response.ok) throw new Error(`Failed to fetch price: ${response.status}`);
    const data = await response.json();
    const price = data[symbol]?.[vsCurrency];
    if (price === undefined) throw new Error(`Symbol or currency not found on CoinGecko`);
    res.json({ price, currency: vsCurrency, symbol });
  } catch (err) {
    res.status(500).json({ error: "crypto-price fetch error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Kite login server running at http://localhost:${PORT}`);
  console.log(`To get fresh token, visit: http://localhost:${PORT}/kite/login`);
});
app.get('/kite/callback', async (req, res) => {
  const requestToken = req.query.request_token;
  const status = req.query.status;
  
  console.log('=== DETAILED CALLBACK DEBUG ===');
  console.log('1. Status:', status);
  console.log('2. Request Token:', requestToken);
  console.log('3. API Key from env:', process.env.KITE_API_KEY);
  console.log('4. API Secret from env:', process.env.KITE_API_SECRET ? `${process.env.KITE_API_SECRET.substring(0, 5)}...` : 'MISSING');
  console.log('5. Current working directory:', process.cwd());
  console.log('6. Looking for .env at:', process.cwd() + '/src/.env');
  
  if (status !== 'success' || !requestToken) {
    return res.json({ 
      error: "Login failed or missing request_token",
      status,
      request_token: requestToken 
    });
  }

  const apiKey = process.env.KITE_API_KEY;
  const secret = process.env.KITE_API_SECRET;
  
  // Show detailed status
  const response = {
    step: "debugging",
    request_token: requestToken,
    api_key: apiKey,
    api_secret_exists: !!secret,
    env_file_path: process.cwd() + '/src/.env'
  };
  
  // Check each requirement
  if (!apiKey) {
    response.error = "KITE_API_KEY is missing";
    response.instruction = "Add KITE_API_KEY=your_key to src/.env";
    return res.json(response);
  }
  
  if (!secret) {
    response.error = "KITE_API_SECRET is missing";
    response.instruction = "Add KITE_API_SECRET=your_secret to src/.env";
    return res.json(response);
  }
  
  // Now try to generate session with detailed error logging
  const kc = new KiteConnect({ api_key: apiKey });
  
  try {
    console.log('7. Creating KiteConnect with API Key:', apiKey);
    console.log('8. Attempting generateSession with:');
    console.log('   - Request Token:', requestToken);
    console.log('   - API Secret length:', secret.length);
    
    const session = await kc.generateSession(requestToken, secret);
    
    console.log('9. ✅ SUCCESS! Session generated');
    console.log('10. Access Token generated:', session.access_token.substring(0, 10) + '...');
    
    res.json({ 
      success: true,
      message: "✅ SUCCESS! Access token generated!",
      request_token: requestToken,
      access_token: session.access_token,
      user_id: session.user_id,
      user_name: session.user_name || 'N/A',
      instructions: [
        "🎉 COPY THIS ACCESS TOKEN TO YOUR .env FILE:",
        "",
        `KITE_ACCESS_TOKEN=${session.access_token}`,
        "",
        "Then restart your bridge server and test!"
      ]
    });
    
  } catch (err) {
    console.error('9. ❌ generateSession FAILED with error:');
    console.error('   Error type:', err.constructor.name);
    console.error('   Error message:', err.message);
    console.error('   Full error:', err);
    
    response.error = "generateSession failed";
    response.error_message = err.message;
    response.error_type = err.constructor.name;
    response.suggestions = [
      "1. Check if your KITE_API_KEY matches the one in https://developers.kite.trade/apps",
      "2. Check if your KITE_API_SECRET matches the one in your Kite app", 
      "3. Request token expires in 2-3 minutes - try again quickly",
      "4. Make sure redirect URL in Kite app is: http://localhost:5050/kite/callback"
    ];
    
    return res.json(response);
  }
});
// Add this endpoint to manually convert request_token to access_token
app.post("/convert-token", async (req, res) => {
  try {
    // Use the request_token from your browser URL
    const requestToken = "mjoeR6Vq0deHGe9R7vZzoxdM2WOV76N1"; // From your browser
    
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
