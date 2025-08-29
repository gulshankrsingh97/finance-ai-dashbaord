import React, { useEffect, useState, useRef, useCallback } from 'react';
import Header from './components/Header';
import { MdAccountCircle } from 'react-icons/md';
import MarketSection from './components/MarketSection';
import ChartContainer from './components/ChartContainer';
import AssistantPanel from './components/AssistantPanel';
import NseMarketSnapshot from './components/NseMarketSnapshot';
import KiteLogin from './components/KiteLogin';
import NewsBanner from './components/NewsBanner';
import './App.css';
import { useIsMobile } from './hooks/useIsMobile';
import 'chart.js/auto';
import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';

import { getLtp, getCryptoPrice, getFinnhubQuote } from "./mcpKiteApi";

function isIndianMarketOpen(date) {
  // date: JS Date in local time (IST)
  // Indian market: 09:00 to 15:30 IST, Monday-Friday
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sun/Sat closed
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 9 * 60 && minutes < (15 * 60 + 30);
}

function isUsMarketOpen(date) {
  // US market: 19:00 (7PM) to 01:30 IST (next day), Monday-Friday
  // On any Mon-Fri, open if time >= 19:00, OR (if before 01:30, also open if previous day was weekday)
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 19 * 60) {
    // Between 19:00 and 23:59: always open Mon-Fri
    return day >= 1 && day <= 5;
  }
  if (minutes < 90) {
    // Between 00:00 and 01:30: only open if yesterday was Mon-Thu (US market closes 01:30 Fri morning)
    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDay = yesterday.getDay();
    return yesterdayDay >= 1 && yesterdayDay <= 5;
  }
  return false;
}

function isCryptoMarketOpen() {
  return true; // Crypto 24/7
}

function App() {
  const isMobile = useIsMobile();

  const [charts, setCharts] = useState({});
  const [data, setData] = useState({});
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('kite_access_token') || "");
  const [market, setMarket] = useState('crypto');
  const refreshInterval = useRef(null);
  const isRefreshing = useRef(false);

  if (isMobile) {
    return (
      <div className="mobile-assistant-root">
        <header className="mobile-assistant-header">Finance Assistant</header>
        <main className="mobile-assistant-panel">
          <AssistantPanel />
        </main>
        <footer className="mobile-assistant-footer">
          Real-time market insights with FinanceGPT
        </footer>
      </div>
    );
  }

  // --- Symbol definitions ---

  // Indian (NSE) stocks/indices
  const stockSymbols = {
    nifty:       { key: 'nifty',       name: 'NIFTY 50',          symbol: '256265',        isToken: true },
    banknifty:   { key: 'banknifty',   name: 'BANKNIFTY',         symbol: '260105',        isToken: true },
    midcapnifty: { key: 'midcpnifty',  name: 'MIDCAP NIFTY',      symbol: 'MIDCPNIFTY' },
    hdfcbank:    { key: 'hdfcbank',    name: 'HDFC Bank',         symbol: 'NSE:HDFCBANK' },
    sensex:      { key: 'sensex',      name: 'SENSEX',            symbol: '265',           isToken: true },
    reliance:    { key: 'reliance',    name: 'Reliance',          symbol: 'NSE:RELIANCE' },
    tcs:         { key: 'tcs',         name: 'TCS',               symbol: 'NSE:TCS' },
    infy:        { key: 'infy',        name: 'Infosys',           symbol: 'NSE:INFY' }
  };

  const cryptoSymbols = {
    bitcoin:  { key: 'bitcoin',  name: 'Bitcoin',   symbol: 'bitcoin',  vs: 'usd' },
    ethereum: { key: 'ethereum', name: 'Ethereum',  symbol: 'ethereum', vs: 'usd' },
    solana:   { key: 'solana',   name: 'Solana',    symbol: 'solana',   vs: 'usd' },
    ripple:   { key: 'ripple',   name: 'XRP',       symbol: 'ripple',   vs: 'usd' },
    cardano:  { key: 'cardano',  name: 'Cardano',   symbol: 'cardano',  vs: 'usd' },
    dogecoin: { key: 'dogecoin', name: 'Dogecoin',  symbol: 'dogecoin', vs: 'usd' }
  };

  // US stocks and indices (Finnhub tickers)
  const usStocksSymbols = {
    dowjones:   { key: 'dowjones',   name: 'DOW JONES',     symbol: '^DJI' },
    nasdaq:     { key: 'nasdaq',     name: 'NASDAQ',        symbol: '^IXIC' },
    sp500:      { key: 'sp500',      name: 'S&P 500',       symbol: '^GSPC' },
    apple:      { key: 'apple',      name: 'Apple',         symbol: 'AAPL' },
    nvidia:     { key: 'nvidia',     name: 'Nvidia',        symbol: 'NVDA' },
    tesla:      { key: 'tesla',      name: 'Tesla',         symbol: 'TSLA' },
    oracle:     { key: 'oracle',     name: 'Oracle',        symbol: 'ORCL' },
    microsoft:  { key: 'microsoft',  name: 'Microsoft',     symbol: 'MSFT' },
    google:     { key: 'google',     name: 'Alphabet (Google)', symbol: 'GOOGL' },
    amazon:     { key: 'amazon',     name: 'Amazon',        symbol: 'AMZN' },
    meta:       { key: 'meta',       name: 'Meta Platforms',symbol: 'META' },
    netflix:    { key: 'netflix',    name: 'Netflix',       symbol: 'NFLX' },
    berkshire:  { key: 'berkshire',  name: 'Berkshire Hathaway', symbol: 'BRK.B' },
    jpmorgan:   { key: 'jpmorgan',   name: 'JPMorgan Chase', symbol: 'JPM' }
  };

  // --- Chart Colors ---
  const chartColors = {
    // Indian
    nifty: "#60a5fa",
    banknifty: "#22c55e",
    sensex: "#a78bfa",
    reliance: "#f59e0b",
    tcs: "#06b6d4",
    infy: "#fb7185",
    hdfcbank: "#84cc16",
    midcapnifty: "#f472b6",
    // Crypto
    bitcoin: "#f7931a",
    ethereum: "#627eea",
    solana: "#14f195",
    ripple: "#00aae4",
    cardano: "#0033ad",
    dogecoin: "#c2a633",
    // US
    dowjones: "#FFD700",
    nasdaq:   "#7C3AED",
    sp500:    "#EF4444",
    apple:    "#1FC91F",
    nvidia:   "#24B7C9",
    tesla:    "#C9002B",
    oracle:   "#FF6600",
    microsoft: "#6366F1",
    google:   "#F59E42",
    amazon:   "#FFB300",
    meta:     "#1977F3",
    netflix:  "#E50914",
    berkshire: "#7A5C2E",
    jpmorgan: "#274472"
  };

  const apiConfig = {
    baseUrl: "https://query1.finance.yahoo.com/v8/finance/chart",
    range: "1d",
    interval: "5m",
    refreshInterval: 30000,
    perSymbolDelayMs: 250
  };

  // Symbol/state logic by market
  const symbols = market === 'stocks'
    ? stockSymbols
    : market === 'crypto'
    ? cryptoSymbols
    : usStocksSymbols;
  const symbolKeys = Object.keys(symbols);
  // Set default selections for each market
  const getDefaultKeys = (market) => {
    if (market === 'stocks') {
      // Indian: Nifty, Banknifty, Reliance, HDFC Bank
      return ['nifty', 'banknifty', 'reliance', 'hdfcbank'];
    } else if (market === 'usstocks') {
      // US: NVIDIA, Apple, Tesla, Oracle
      return ['nvidia', 'apple', 'tesla', 'oracle'];
    } else if (market === 'crypto') {
      // Crypto: BTC, ETH, SOL, XRP
      return ['bitcoin', 'ethereum', 'solana', 'ripple'];
    }
    // Fallback to first four
    return symbolKeys.slice(0, 4);
  };

  const [selectedKeys, setSelectedKeys] = useState(() => getDefaultKeys('crypto'));

  useEffect(() => {
    setSelectedKeys(getDefaultKeys(market));
    // Do not clear chart data here! This preserves previous price after switching tabs/markets.
    loadInitialData(true);
    // eslint-disable-next-line
  }, [market]);

  useEffect(() => {
    if (!selectedKeys || selectedKeys.length === 0) return;
    loadInitialData(true);
    startAutoRefresh();
    // eslint-disable-next-line
  }, [selectedKeys]);

  useEffect(() => {
    if (accessToken) {
      loadInitialData();
      startAutoRefresh();
    }

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      Object.values(charts).forEach(chart => chart?.destroy());
    };
    // eslint-disable-next-line
  }, [accessToken]);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Finnhub for Indian: maps symbol to Finnhub style, for US: direct
  const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
  const getFinnhubSymbol = (symbol) => {
    const symbolMap = {
      '256265': 'NSE:NIFTY 50',
      '260105': 'NSE:BANK NIFTY',
      '265': 'BSE:SENSEX',
      'MIDCPNIFTY': 'NSE:MIDCAP 50',
      'midcpnifty': 'NSE:MIDCAP 50',
      'NSE:RELIANCE': 'RELIANCE.NSE',
      'NSE:TCS': 'TCS.NSE',
      'NSE:INFY': 'INFY.NSE',
      'NSE:HDFCBANK': 'HDFCBANK.NSE'
    };
    return symbolMap[symbol] || symbol;
  };


  // --- Data loading by type ---

  const loadInitialData = async (force = false) => {
    if ((market === 'stocks' && !accessToken && !force) || (market === 'usstocks' && !force)) {
      const csEl1 = document.getElementById('connectionStatus');
      if (csEl1)
        csEl1.innerHTML = '<span class="status-dot"></span>Using Free APIs';
      try {
        for (let i = 0; i < selectedKeys.length; i++) {
          const key = selectedKeys[i];
          if (!symbols[key]) continue;
          try {
            const finnhubSymbol =
              market === 'usstocks'
                ? symbols[key].symbol
                : getFinnhubSymbol(symbols[key].symbol);
            const finnhubResult = await getFinnhubQuote(finnhubSymbol, FINNHUB_API_KEY);

            if (finnhubResult && Number.isFinite(finnhubResult.c)) {
              const price = finnhubResult.c;
              const prevClose = finnhubResult.pc || price;
              const change = price - prevClose;
              const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
              setData(prev => ({
                ...prev,
                [key]: {
                  chartData: [{ x: new Date(), y: price }],
                  meta: {
                    last_price: price,
                    change,
                    changePercent
                  }
                }
              }));
            }
          } catch (finnhubError) {
            console.warn(`Finnhub failed for ${key}, using demo data:`, finnhubError);
            showFallbackData(key);
          }
          if (i < selectedKeys.length - 1) {
            await sleep(1100);
          }
        }
      } catch (error) {
        console.error('Failed to load fallback data:', error);
        selectedKeys.forEach(key => showFallbackData(key));
      }
      return;
    }
    { const csEl = document.getElementById('connectionStatus'); if (csEl) csEl.innerHTML = '<span class="status-dot"></span>Loading Data...'; }
    try {
      // Only fetch live data on initial load (no history for IND/US stocks)
      for (let i = 0; i < selectedKeys.length; i++) {
        const key = selectedKeys[i];
        if (!symbols[key]) continue;
        await fetchMarketData(key, symbols[key].symbol);
        if (i < selectedKeys.length - 1) {
          await sleep(apiConfig.perSymbolDelayMs);
        }
      }
      updateConnectionStatus('connected');
      updateLastRefreshTime();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      updateConnectionStatus('error');
      // No fallback; charts remain blank on failure
    }
  };

  const startAutoRefresh = () => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(() => {
      if (!isRefreshing.current) {
        refreshData();
      }
    }, apiConfig.refreshInterval);
  };

  const refreshData = async () => {
    isRefreshing.current = true;
    try {
      if (market === 'stocks' || market === 'usstocks') {
        await Promise.all(
          selectedKeys
            .filter(key => symbols[key])
            .map(key => fetchMarketData(key, symbols[key].symbol))
        );
      } else {
        for (let i = 0; i < selectedKeys.length; i++) {
          const key = selectedKeys[i];
          if (!symbols[key]) continue;
          await fetchMarketData(key, symbols[key].symbol);
          if (i < selectedKeys.length - 1) {
            await sleep(apiConfig.perSymbolDelayMs);
          }
        }
      }
      updateLastRefreshTime();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      isRefreshing.current = false;
    }
  };

  const fetchMarketData = async (key) => {
    try {
      const now = new Date();
      let open = true;
      if (market === 'stocks') {
        open = isIndianMarketOpen(now);
      } else if (market === 'usstocks') {
        open = isUsMarketOpen(now);
      } else if (market === 'crypto') {
        open = isCryptoMarketOpen();
      }
      const prev = data[key] || {};
      const prevChartData = prev.chartData || [];
      // Allow fetch if chart is empty even if market is closed (initial fill), else block as before
      if (!open && prevChartData && prevChartData.length > 0) {
        // Market closed and we already have data, no further API calls
        return;
      }

      let lastPrice = null;
      let meta = {};
      if (market === 'stocks') {
        if (accessToken) {
          try {
            const symbolParam = symbols[key].symbol;
            const ltpResult = await getLtp(symbolParam, accessToken);
            let ltpObj = null;
            if (ltpResult && typeof ltpResult === 'object') {
              ltpObj = ltpResult[symbolParam] || Object.values(ltpResult)[0];
              if (ltpObj && typeof ltpObj.last_price === 'number') {
                lastPrice = ltpObj.last_price;
                meta = ltpObj;
              }
            }
          } catch {
            // On error, leave chart blank (no fallback, no Finnhub for IND stocks)
          }
        }
        // If no login or LTP failed, chart remains blank
      } else if (market === 'usstocks') {
        try {
          const finnhubResult = await getFinnhubQuote(symbols[key].symbol, FINNHUB_API_KEY);
          if (finnhubResult && Number.isFinite(finnhubResult.c)) {
            lastPrice = finnhubResult.c;
            const prevClose = finnhubResult.pc || lastPrice;
            meta = {
              last_price: lastPrice,
              change: lastPrice - prevClose,
              changePercent: prevClose !== 0 ? ((lastPrice - prevClose) / prevClose) * 100 : 0,
            };
          }
        } catch {
          // On error, leave chart blank (no fallback, no history)
        }
      } else {
        // Crypto -- only use CoinGecko (no Delta)
        if (lastPrice === null) {
          try {
            const coinGeckoResult = await getCryptoPrice(symbols[key].symbol, symbols[key].vs || 'usd');
            lastPrice = coinGeckoResult.price;
            meta = { last_price: coinGeckoResult.price };
          } catch {}
        }
      }
      if (lastPrice !== null) {
        setData(prev => {
          let prevHistory = prev[key]?.chartData || [];
          // Chart is just accumulating LTP points, or reset if empty on init
          if (!Array.isArray(prevHistory) || prevHistory.length === 0) {
            prevHistory = [];
          }
          const chartData =
            prevHistory.length === 0
              ? [{ x: new Date(), y: lastPrice }]
              : [
                  ...prevHistory,
                  { x: new Date(), y: lastPrice }
                ].slice(-78);

          return {
            ...prev,
            [key]: { chartData, meta }
          };
        });
      }
      // If no LTP (not logged in for IND, or US/FINNHUB error), chart remains blank
    } catch {
      // On error, chart remains blank.
    }
  };

  const showFallbackData = (key) => {
    const now = new Date();
    const fallbackData = [];
    const basePrice = getFallbackBasePrice(key);

    for (let i = 78; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * 5 * 60 * 1000));
      const randomVariation = (Math.random() - 0.5) * basePrice * 0.02;
      fallbackData.push({
        x: time,
        y: basePrice + randomVariation
      });
    }

    setData(prev => {
      const next = {
        ...prev,
        [key]: {
          chartData: fallbackData,
          meta: {
            last_price: fallbackData[fallbackData.length - 1].y,
            first_price: fallbackData[0].y,
          }
        }
      };
      return next;
    });
  };

  const getFallbackBasePrice = (key) => {
    const basePrices = {
      // Indian
      nifty: 24000,
      banknifty: 48000,
      midcapnifty: 12000,
      hdfcbank: 1600,
      reliance: 3000,
      tcs: 3800,
      infy: 1600,
      sensex: 80000,
      // Crypto
      bitcoin: 65000,
      ethereum: 3500,
      solana: 180,
      ripple: 0.6,
      cardano: 0.45,
      dogecoin: 0.12,
      // US
      dowjones: 39000,
      nasdaq: 17000,
      sp500: 5400,
      apple: 200,
      nvidia: 900,
      tesla: 250,
      oracle: 130,
      microsoft: 420,
      google: 130,
      amazon: 180,
      meta: 300,
      netflix: 550,
      berkshire: 410,
      jpmorgan: 200
    };
    return basePrices[key] || 100;
  };

  const updateConnectionStatus = (status) => {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    const statusDot = statusElement.querySelector('.status-dot');
    if (statusDot) statusDot.className = 'status-dot';

    switch (status) {
      case 'connected':
        statusElement.innerHTML = '<span class="status-dot connected"></span>Connected';
        { const ms = document.getElementById('marketStatus'); if (ms) ms.textContent = 'Active'; }
        break;
      case 'connecting':
        statusElement.innerHTML = '<span class="status-dot"></span>Connecting...';
        { const ms = document.getElementById('marketStatus'); if (ms) ms.textContent = 'Loading...'; }
        break;
      case 'loading':
        statusElement.innerHTML = '<span class="status-dot"></span>Loading Data...';
        break;
      case 'error':
        statusElement.innerHTML = '<span class="status-dot error"></span>Demo Mode';
        { const ms = document.getElementById('marketStatus'); if (ms) ms.textContent = 'Demo'; }
        break;
      default:
        break;
    }
  };

  const updateLastRefreshTime = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    { const lu = document.getElementById('lastUpdate'); if (lu) lu.textContent = timeString; }
  };

  const registerChart = useCallback((key, chart) => {
    setCharts(prev => {
      if (prev[key] === chart) return prev;
      return { ...prev, [key]: chart };
    });
  }, []);

  // Panel resize logic
  const [assistantPanelWidth, setAssistantPanelWidth] = useState(420);
  const isDragging = useRef(false);
  const handleDragStart = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
  };
  const handleDragEnd = () => {
    isDragging.current = false;
    document.body.style.cursor = "";
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', handleDragEnd);
  };
  const handleDrag = (e) => {
    if (!isDragging.current) return;
    const min = 320, max = Math.max(350, window.innerWidth - 540);
    let newW = e.clientX - document.getElementById("dashboard-main").getBoundingClientRect().left;
    if (newW < min) newW = min;
    if (newW > max) newW = max;
    setAssistantPanelWidth(newW);
  };

  // Render logic
  return (
    <div className="dashboard">
      <Header
        market={market}
        onToggleMarket={(next) => setMarket(next)}
        loginControl={
          market === 'stocks' ? (
            accessToken ? (
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    color: "#fff",
                    fontSize: "1.12em",
                    boxShadow: "0 1px 8px #0ea5e955"
                  }}
                  title="Logged in to Zerodha"
                >
                  <MdAccountCircle size={26} style={{ opacity: 0.82, marginRight: 1 }} />
                </div>
                <button
                  onClick={() => { setAccessToken(''); localStorage.removeItem('kite_access_token'); }}
                  className="btn btn--secondary btn--sm"
                  style={{padding:'8px 12px', borderRadius:8}}
                  title="Logout from Zerodha"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center" }}>
                <KiteLogin
                  onAccessToken={(token) => {
                    setAccessToken(token);
                    localStorage.setItem('kite_access_token', token);
                  }}
                  buttonStyle={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    background: '#0ea5e9',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: '700',
                    letterSpacing: '1px',
                  }}
                />
              </div>
            )
          ) : null
        }
      />
      <main
        className="dashboard-main"
        id="dashboard-main"
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(480px,1fr) 8px ${assistantPanelWidth}px`,
          gap: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          alignItems: "stretch",
          overflow: "hidden",
        }}
      >
        <div style={{ gridColumn: "1 / span 3" }}>
          <NseMarketSnapshot maxStocks={10} />
        </div>
        <section className="charts-section single-section" style={{minWidth: 0, height: "100%", paddingRight: "20px"}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {market === 'stocks' ? 'Live Market Charts'
                : market === 'crypto' ? 'Crypto Market Charts'
                : 'US Market Charts'}
            </h2>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {selectedKeys.map((key, idx) => (
                <select
                  key={idx}
                  style={{
                    minWidth: 128,
                    fontSize: "1rem",
                    padding: "6px 8px",
                    borderRadius: "7px",
                    border: "1px solid #60a5fa",
                    background: "#23272f",
                    color: "#dbeafe",
                  }}
                  value={key}
                  onChange={e => {
                    const picked = e.target.value;
                    setSelectedKeys(prev => {
                      const updated = [...prev];
                      if (!updated.includes(picked)) {
                        updated[idx] = picked;
                      }
                      for (let i = 0; i < updated.length; i++) {
                        if (i !== idx && updated[i] === picked) {
                          [updated[i], updated[idx]] = [updated[idx], updated[i]];
                        }
                      }
                      return updated;
                    });
                  }}
                >
                  {symbolKeys
                    .filter(k => k === key || !selectedKeys.includes(k))
                    .map(k => (
                      <option value={k} key={k}>
                        {symbols[k].name}
                      </option>
                    ))}
                </select>
              ))}
              <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 7 }}>(Pick any 4)</span>
            </div>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 30,
            width: "100%",
            minHeight: 480,
            height: "100%"
          }}>
            {selectedKeys.map((key) => {
              const sym = symbols[key];
              if (!sym) return null;
              const dataObj = data[key] || {};
              const meta = dataObj.meta || {};
              const chartData = dataObj.chartData || [];
              const price = typeof meta.last_price === "number" ? meta.last_price : 0;
              let previousClose = price;
              if (chartData.length > 1) previousClose = chartData[0].y;
              const change = price - previousClose;
              const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
              
              // --- Market open/close logic for statusText ---
              const now = new Date();
              let open = true;
              if (market === 'stocks') {
                open = isIndianMarketOpen(now);
              } else if (market === 'usstocks') {
                open = isUsMarketOpen(now);
              } else if (market === 'crypto') {
                open = isCryptoMarketOpen();
              }
              let statusText = "Live";
              if (!open && price > 0) statusText = "Market Closed";
              if (!meta || price <= 0) statusText = "Demo";
              
              // Hardcoded mapping for correct TradingView symbols (EXCHANGE:SYMBOL)
              const tvCryptoSymbols = {
                bitcoin:    "BITSTAMP:BTCUSD",
                ethereum:   "BITSTAMP:ETHUSD",
                solana:     "BINANCE:SOLUSD",
                ripple:     "BITSTAMP:XRPUSD",
                cardano:    "BINANCE:ADAUSD",
                dogecoin:   "BINANCE:DOGEUSD"
              };
              const tvUsStocksSymbols = {
                dowjones:   "DJI",
                nasdaq:     "NASDAQ:IXIC",
                sp500:      "SP:SPX",
                apple:      "NASDAQ:AAPL",
                nvidia:     "NASDAQ:NVDA",
                tesla:      "NASDAQ:TSLA",
                oracle:     "NYSE:ORCL",
                microsoft:  "NASDAQ:MSFT",
                google:     "NASDAQ:GOOGL",
                amazon:     "NASDAQ:AMZN",
                meta:       "NASDAQ:META",
                netflix:    "NASDAQ:NFLX",
                berkshire:  "NYSE:BRK.B",
                jpmorgan:   "NYSE:JPM"
              };
              const tvIndStocksSymbols = {
                nifty: "NSE:NIFTY",
                banknifty: "NSE:BANKNIFTY",
                midcapnifty: "NSE:MIDCPNIFTY",
                hdfcbank: "NSE:HDFCBANK",
                sensex: "BSE:SENSEX",
                reliance: "NSE:RELIANCE",
                tcs: "NSE:TCS",
                infy: "NSE:INFY",
              };
              let tradingViewSymbol;
              if (market === 'stocks') {
                tradingViewSymbol = tvIndStocksSymbols[sym.key.toLowerCase()] || undefined;
              } else if (market === 'crypto') {
                tradingViewSymbol = tvCryptoSymbols[sym.key.toLowerCase()] || undefined;
              } else if (market === 'usstocks') {
                tradingViewSymbol = tvUsStocksSymbols[sym.key.toLowerCase()] || undefined;
              }
              return (
                <ChartContainer
                  key={key}
                  id={key + "Chart"}
                  title={sym.name}
                  color={chartColors[key]}
                  price={price}
                  change={change}
                  changePercent={changePercent}
                  statusText={statusText}
                  registerChart={registerChart}
                  chartData={chartData}
                  tradingViewSymbol={tradingViewSymbol}
                />
              );
            })}
          </div>
        </section>
        <div
          style={{
            cursor: "col-resize",
            width: 8,
            background: "linear-gradient(180deg,#38bdf83b 30%,#23272f1f 100%)",
            zIndex: 10,
          }}
          onMouseDown={handleDragStart}
        />
        <div style={{ minWidth: 0, height: "100%", borderLeft: "1.5px solid #23272f1b", boxShadow: "0 0 0 0 #0000" }}>
          <AssistantPanel />
        </div>
      </main>
      <footer className="dashboard-footer">
        <p>Finance Dashboard :- Real-time market insights With Integrated FinanceGPT</p>
      </footer>
    </div>
  );
}

export default App;
