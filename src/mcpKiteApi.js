/**
 * Get the Latest Traded Price (LTP) for a symbol using the MCP Kite API bridge.
 * @param {string} symbol - NSE/BSE symbol or instrument token
 * @param {string} accessToken - Optional API key/token if server requires
 * @returns {Promise<Object>} LTP response
 */
export async function getLtp(symbol, accessToken) {
  const url = '/kite-mcp-server'; // Or the actual endpoint for your MCP server
  const body = { symbol };
  if (accessToken) body.accessToken = accessToken;

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
    stream = false
  } = options;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
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
