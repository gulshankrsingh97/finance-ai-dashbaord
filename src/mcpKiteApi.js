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
`


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
