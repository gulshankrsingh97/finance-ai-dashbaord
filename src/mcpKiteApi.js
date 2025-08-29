/**
 * Get the Latest Traded Price (LTP) for a symbol using the MCP Kite API bridge.
 * @param {string} symbol - NSE/BSE symbol or instrument token
 * @param {string} accessToken - Optional API key/token if server requires
 * @returns {Promise<Object>} LTP response
 */
export async function getLtp(symbol, accessToken) {
  // Use the MCP bridge server on 5055 which exposes tools under /mcp/tool/kite-mcp-server
  const url = '/mcp/tool/kite-mcp-server/get_ltp';
  const body = { arguments: { symbol } };
  if (accessToken) body.arguments.access_token = accessToken;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("MCP Kite API error: " + resp.status);
  return await resp.json();
}

/**
 * Get the latest price for a crypto symbol from MCP bridge server (CoinGecko)
 * @param {string} symbol - CoinGecko id (e.g., 'ethereum', 'bitcoin')
 * @param {string} vs - currency to quote in (e.g., 'usd')
 * @returns {Promise<Object>} { price, currency, symbol }
 */
export async function getCryptoPrice(symbol, vs = 'usd') {
  if (!symbol) throw new Error("No symbol provided for getCryptoPrice");
  const url = `/crypto-price?symbol=${encodeURIComponent(symbol)}&vs=${encodeURIComponent(vs)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Crypto price API error: " + resp.status);
  return await resp.json();
}

/**
 * Get crypto price from Delta Exchange (premium)
 * @param {string} symbol - Delta Exchange symbol (e.g., 'BTCUSDT')
 * @param {string} accessToken - Delta Exchange API key
 * @returns {Promise<Object>} { price, currency, symbol }
 */
export async function getDeltaCryptoPrice(symbol, accessToken) {
  if (!symbol || !accessToken) throw new Error("Symbol and access token required");
  const url = `/delta/crypto-price?symbol=${encodeURIComponent(symbol)}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error("Delta Exchange API error: " + resp.status);
  return await resp.json();
}

/**
 * Get latest stock/index price from Finnhub (LTP/quote, free with API key)
 * @param {string} symbol - Finnhub symbol (e.g., "RELIANCE.NSE", "NSE:NIFTY 50")
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} { c: current, pc: prev close, t: timestamp }
 */
export async function getFinnhubQuote(symbol, apiKey) {
  if (!symbol || !apiKey) throw new Error('Finnhub symbol and API key required');
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Finnhub API error: " + resp.status);
  return await resp.json();
}

/**
 * Get historical price candles for stock/index from Finnhub
 * @param {string} symbol - Finnhub symbol (e.g., "RELIANCE.NSE")
 * @param {string} apiKey - Finnhub API key
 * @param {number} from - unix epoch seconds (start time)
 * @param {number} to - unix epoch seconds (end time)
 * @param {string} resolution - 'D', '60', '5' etc.
 * @returns {Promise<Array>} Array of { x: Date, y: price }
 */
export async function getFinnhubHistory(symbol, apiKey, from, to, resolution = "5") {
  if (!symbol || !apiKey) throw new Error('Finnhub symbol and API key required');
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Finnhub API error: " + resp.status);
  const data = await resp.json();
  // Finnhub returns { t: [timestamps], c: [closes], ... }
  if (!Array.isArray(data.t) || !Array.isArray(data.c)) return [];
  return data.t.map((ts, i) => ({
    x: new Date(ts * 1000),
    y: data.c[i]
  }));
}

/**
 * Get historical data for crypto from CoinGecko
 * @param {string} symbol - CoinGecko id (e.g., 'bitcoin')
 * @param {string} vs - currency to quote in (e.g., 'usd')
 * @param {number} days - number of days (default: 1 for 24h)
 * @returns {Promise<Array>} Array of {x: Date, y: price} points
 */
export async function getCryptoHistory(symbol, vs = 'usd', days = 1) {
  if (!symbol) throw new Error("No symbol provided for getCryptoHistory");
  const url = `/crypto-history?symbol=${encodeURIComponent(symbol)}&vs=${encodeURIComponent(vs)}&days=${days}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Crypto history API error: " + resp.status);
  const data = await resp.json();
  
  // Convert to chart format: {x: Date, y: price}
  return data.prices.map(([timestamp, price]) => ({
    x: new Date(timestamp),
    y: price
  }));
}

/**
 * Get historical data for stocks from Kite Connect
 * @param {string} symbol - NSE symbol or instrument token
 * @param {string} accessToken - Kite access token
 * @param {string} from - start date (YYYY-MM-DD)
 * @param {string} to - end date (YYYY-MM-DD)
 * @param {string} interval - interval (5minute, 15minute, 30minute, 60minute, day)
 * @returns {Promise<Array>} Array of {x: Date, y: price} points
 */
export async function getStockHistory(symbol, accessToken, from, to, interval = '5minute') {
  if (!symbol || !accessToken) throw new Error("Symbol and access token required");
  const url = '/mcp/tool/kite-mcp-server/get_historical_data';
  const body = { 
    arguments: { 
      symbol, 
      access_token: accessToken,
      from_date: from,
      to_date: to,
      interval
    } 
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  
  if (!resp.ok) throw new Error("Stock history API error: " + resp.status);
  const data = await resp.json();
  
  // Convert to chart format: {x: Date, y: price}
  return data.candles?.map(([timestamp, open, high, low, close, volume]) => ({
    x: new Date(timestamp),
    y: close
  })) || [];
}

/**
 * Chat with local LM Studio/OSS LLM API.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [options] - { model, temperature, max_tokens, baseUrl }
 */
export async function chatWithLocalAI(messages, options = {}) {
  const {
    baseUrl = "http://localhost:3001",
    model = "openai/gpt-oss-20b",
    temperature = 0.7,
    max_tokens = -1,
    stream = false,
    systemPrompt
  } = options;

  const DEFAULT_SYSTEM_PROMPT = `
 You are RDX (Rich Dad X) — a seasoned, friendly finance companion for Alphamind.

- Always respond in a clear, encouraging, and practical way.
- Be proactive, but never overconfident.
+ 🔹 OUTPUT STYLE RULES 🔹
+ - Keep messages concise; avoid long paragraphs.
+ - Use **numbered steps** or **short bullets** always.
+ - Use emojis/icons where natural (🔥📈💡✅⚠️).
+ - Prefer tables for structured data.
+ - Break content into chunks: "Steps", "Risks", "Example".
+ - Never exceed 6 bullets/steps at once; suggest "Want more?" for extra depth.
+ - Keep tone chatty and interactive (ask next‑step questions).
+ - If user asks for trade/process: **show simple checklist** not essay.
+ - Assume answers will be displayed in a finance dashboard — so must be scannable.
`;

  // GEMINI 2.5 API SUPPORT
  if (model === "gemini-2.5") {
    // Gemini's API expects ONLY user/assistant roles; no "system" allowed!
    // We'll prepend the (system) prompt as a *user* message, then remaining conversation.
    const toGeminiMessages = (msgs, prependSystem) => {
      const mapped = msgs
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          parts: [{ text: msg.content }]
        }));
      if (prependSystem) {
        return [
          { role: "user", parts: [{ text: prependSystem }] },
          ...mapped
        ];
      }
      return mapped;
    };

    const system = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    // Always prepend system prompt as first user message for Gemini
    const geminiMessages = toGeminiMessages(messages || [], system);

    const response = await fetch("http://localhost:3002/v1/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: geminiMessages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    // Gemini returns response in data.candidates[0].content.parts[0].text
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      content,
      usage: {}, // Gemini doesn't return usage stats
      provider: "gemini"
    };
  }

  // EXISTING LOCAL AI FLOW (OpenAI-compatible)
  // Prepend system prompt unless the first message is already a system role
  const withSystem = (() => {
    const sysMsg = { role: "system", content: systemPrompt || DEFAULT_SYSTEM_PROMPT };
    if (Array.isArray(messages) && messages[0]?.role === 'system') return messages;
    return [sysMsg, ...(messages || [])];
  })();

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: withSystem,
      temperature,
      max_tokens,
      stream
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message) throw new Error('Invalid response from LM Studio');
  return {
    content: data.choices[0].message.content,
    usage: data.usage || { total_tokens: 0 },
    provider: "local"
  };
}
