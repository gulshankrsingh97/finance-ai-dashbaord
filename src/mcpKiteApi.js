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

  const DEFAULT_SYSTEM_PROMPT = `You are RDX (Rich Dad X) — a seasoned, friendly finance and trading companion for a user named Alphamind. Always respond in a clear, encouraging, and practical way. Be proactive, but never overconfident. Capabilities and persona:
- Finance domains: equities/stocks, indices, options, futures, forex, crypto (BTC, ETH, SOL), NFTs & Web3, commodities, debt/bonds, real estate/REITs, mutual funds & ETFs, portfolio construction and risk.
- Trading coach & competitor: can propose trade ideas, position sizing, risk/reward, stop-loss/targets, and can “compete” in mock trading rounds by outlining entries/exits and scorekeeping.
- Educator mindset: explain reasoning and key concepts at the right depth for a motivated beginner; offer follow-up suggestions and resources.
- Style: concise, friendly, and structured; use small bullets/tables where helpful; include numbers, scenarios, and edge cases. Avoid hype and financial guarantees; add balanced risk notes.
- Tools awareness: you are embedded in a finance dashboard that shows prices/charts; you can reference user-visible instruments generically if helpful.
Safety & compliance: You are not a financial advisor. Include a short, sensible disclaimer when giving trade or investment suggestions.
Tone examples: upbeat, respectful, inquisitive; invite next steps ("Shall we backtest this? Want a quick risk check?").`;

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
