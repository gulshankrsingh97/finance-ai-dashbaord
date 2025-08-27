import React, { useEffect, useState, useRef } from 'react';
import Header from './components/Header';
import { MdAccountCircle } from 'react-icons/md';
import MarketSection from './components/MarketSection';
import ChartContainer from './components/ChartContainer';
import AssistantPanel from './components/AssistantPanel';
import KiteLogin from './components/KiteLogin';
import NewsBanner from './components/NewsBanner';
import './App.css';
import 'chart.js/auto';
import { Chart } from 'chart.js';
import 'chartjs-adapter-date-fns';

import { getLtp } from "./mcpKiteApi";

function App() {
  const [charts, setCharts] = useState({});
  const [data, setData] = useState({});
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('kite_access_token') || "");
  const refreshInterval = useRef(null);
  const isRefreshing = useRef(false);

  // Indian stocks and indices (NSE only for demo)
  // Use instrument tokens for indices per Kite Connect docs
  // NIFTY 50: 256265, BANKNIFTY: 260105, SENSEX: 265
  const symbols = {
    nifty:    { key: 'nifty',    name: 'NIFTY 50',        symbol: '256265', isToken: true },
    banknifty:{ key: 'banknifty',name: 'BANKNIFTY',       symbol: '260105', isToken: true },
    sensex:   { key: 'sensex',   name: 'SENSEX',          symbol: '265',    isToken: true },
    reliance: { key: 'reliance', name: 'Reliance',        symbol: 'NSE:RELIANCE' },
    tcs:      { key: 'tcs',      name: 'TCS',             symbol: 'NSE:TCS' },
    infy:     { key: 'infy',     name: 'Infosys',         symbol: 'NSE:INFY' },
    hdfcbank: { key: 'hdfcbank', name: 'HDFC Bank',       symbol: 'NSE:HDFCBANK' }
  };

  const chartColors = {
    nifty: "#60a5fa",
    banknifty: "#22c55e",
    sensex: "#a78bfa",
    reliance: "#f59e0b",
    tcs: "#06b6d4",
    infy: "#fb7185",
    hdfcbank: "#84cc16"
  };

  const apiConfig = {
    baseUrl: "https://query1.finance.yahoo.com/v8/finance/chart",
    range: "1d",
    interval: "5m",
    refreshInterval: 60000
  };

  // User-selectable 4 chart choice logic
  const symbolKeys = Object.keys(symbols);
  const [selectedKeys, setSelectedKeys] = useState(() =>
    symbolKeys.slice(0, 4)
  );

  useEffect(() => {
    // When accessToken changes (e.g. after login), reload all data
    loadInitialData();
    startAutoRefresh();

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      Object.values(charts).forEach(chart => chart?.destroy());
    };
  }, [accessToken]);

  const loadInitialData = async () => {
    if (!accessToken) {
      // Don't attempt unless logged in
      const csEl1 = document.getElementById('connectionStatus'); if (csEl1) csEl1.innerHTML = '<span class="status-dot"></span>Login required';
      return;
    }
    { const csEl = document.getElementById('connectionStatus'); if (csEl) csEl.innerHTML = '<span class="status-dot"></span>Loading Data...'; }
    try {
      const promises = Object.keys(symbols).map(key => fetchMarketData(key, symbols[key].symbol));
      await Promise.all(promises);
      updateConnectionStatus('connected');
      updateLastRefreshTime();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      updateConnectionStatus('error');
      Object.keys(symbols).forEach(key => showFallbackData(key));
    }
  };

  const startAutoRefresh = () => {
    refreshInterval.current = setInterval(() => {
      if (!isRefreshing.current) {
        refreshData();
      }
    }, apiConfig.refreshInterval);
  };

  const refreshData = async () => {
    isRefreshing.current = true;
    try {
      const promises = Object.keys(symbols).map(key => fetchMarketData(key, symbols[key].symbol));
      await Promise.all(promises);
      updateLastRefreshTime();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      isRefreshing.current = false;
    }
  };

  const fetchMarketData = async (key, symbol) => {
    // statusElement UI updates removed; React handles status display now.

    try {
      // Fetch price using MCP tool
      const symbolParam = symbols[key].symbol;
      console.log("[fetchMarketData] Requesting LTP for:", {
        key,
        symbolParam,
        accessToken: accessToken ? accessToken.substring(0, 8) + "..." : "undefined"
      });

      const ltpResult = await getLtp(symbolParam, accessToken);

      console.log("[fetchMarketData] LTP API raw result for", symbolParam, ":", ltpResult);

      // KiteConnect getLTP returns { SYMBOL: { instrument_token, last_price, ... } }
      let lastPrice = null;
      let meta = {};
      let ltpObj = null;
      if (ltpResult && typeof ltpResult === "object") {
        ltpObj = ltpResult[symbolParam] || Object.values(ltpResult)[0];
        console.log("[fetchMarketData] Extracted ltpObj:", ltpObj);
        if (ltpObj && typeof ltpObj.last_price === "number") {
          lastPrice = ltpObj.last_price;
          meta = ltpObj;
          console.log("[fetchMarketData] Got valid last_price:", lastPrice);
        } else {
          console.warn("[fetchMarketData] No valid last_price found in ltpObj:", ltpObj);
        }
      } else {
        console.warn("[fetchMarketData] ltpResult not an object:", ltpResult);
      }
      if (lastPrice !== null) {
        // Keep history or initialize
        setData(prev => {
          const prevHistory = prev[key]?.chartData || [];
          const chartData = [
            ...prevHistory,
            { x: new Date(), y: lastPrice }
          ].slice(-78); // Keep only the last ~6.5hr if 5m window, or ~39hr if 30s interval—adjust length as desired

          return {
            ...prev,
            [key]: { chartData, meta }
          };
        });

        // statusElement.textContent = ... removed; React will update chart-status.
        console.log("[fetchMarketData] Data updated for", key);
      } else {
        console.error('[fetchMarketData] Invalid data format from MCP', ltpResult);
        throw new Error('Invalid data format from MCP');
      }
    } catch (error) {
      console.error(`[fetchMarketData] Error fetching data for ${symbol}:`, error);
      // statusElement.textContent = ... removed.
      showFallbackData(key);
    }
  };

  // Add useEffect to update charts when data changes
  useEffect(() => {
    Object.keys(data).forEach(key => {
      const chart = charts[key];
      if (chart && data[key]) {
        chart.data.labels = data[key].chartData.map(point => point.x);
        chart.data.datasets[0].data = data[key].chartData;
        chart.update('none');
      }
    });
  }, [data, charts]);

  // In ChartContainer, we'll need to expose the chart instance, perhaps using a ref from App, but since it's modular, perhaps use a global chart registry or context.
  // For this, let's add a prop to ChartContainer to set the chart instance.

  // But to continue, assume we have it.

  // updatePriceDisplay removed: each component now renders from liveData via props.

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

    setData(prev => ({
      ...prev,
      [key]: {
        chartData: fallbackData,
        meta: {
          last_price: fallbackData[fallbackData.length - 1].y,
          first_price: fallbackData[0].y,
        }
      }
    }));
  };

  const getFallbackBasePrice = (key) => {
    const basePrices = {
      nifty: 24000,
      bankNifty: 48000,
      midcap: 12000,
      bitcoin: 45000,
      ethereum: 2800,
      solana: 180,
      nvidia: 450,
      oracle: 120,
      tesla: 250
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

  // Function to register chart instances from child components
  const registerChart = (key, chart) => {
    setCharts(prev => ({ ...prev, [key]: chart }));
  };

  // Resizable panel state and logic
  const [assistantPanelWidth, setAssistantPanelWidth] = useState(420);
  const isDragging = useRef(false);

  // Drag handlers
  const handleDragStart = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
  };
  const handleDragEnd = () => {
    isDragging.current = false;
    document.body.style.cursor = "";
  };
  const handleDrag = (e) => {
    if (!isDragging.current) return;
    const min = 320, max = Math.max(350, window.innerWidth - 540); // Ensure charts area always gets at least 480px
    let newW = e.clientX - document.getElementById("dashboard-main").getBoundingClientRect().left;
    if (newW < min) newW = min;
    if (newW > max) newW = max;
    setAssistantPanelWidth(newW);
  };


  return (
    <div className="dashboard">
      <Header
        newsBanner={<NewsBanner />}
        loginControl={
          accessToken ?
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
            :
            <KiteLogin onAccessToken={(tok)=>{ localStorage.setItem('kite_access_token', tok); setAccessToken(tok); }} />
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
        <section className="charts-section single-section" style={{minWidth: 0, height: "100%", paddingRight: "20px"}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Live Market Charts</h2>
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
                      // Prevent duplicate symbols (~swap with previous at idx if dupe)
                      // If duplicate is found elsewhere, swap positions
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
              let statusText = meta && price > 0 ? "Live" : "Demo";
              return (
                <ChartContainer
                  key={key}
                  id={key+"Chart"}
                  title={sym.name}
                  color={chartColors[key]}
                  price={price}
                  change={change}
                  changePercent={changePercent}
                  statusText={statusText}
                  registerChart={registerChart}
                  chartData={chartData}
                  tradingViewSymbol={
                    sym.name && sym.name.toUpperCase().includes("NIFTY")
                      ? "NIFTY"
                      : sym.name && sym.name.toUpperCase().includes("BANKNIFTY")
                      ? "BANKNIFTY"
                      : sym.key
                      ? sym.key.toUpperCase()
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
        {/* Drag handle for resizing */}
        <div
          style={{
            cursor: "col-resize",
            width: 8,
            background: "linear-gradient(180deg,#38bdf83b 30%,#23272f1f 100%)",
            zIndex: 10,
          }}
          onMouseDown={handleDragStart}
        />
        <div style={{minWidth:0, height:"100%", borderLeft: "1.5px solid #23272f1b", boxShadow: "0 0 0 0 #0000"}}>
          <AssistantPanel />
        </div>
      </main>
      {/* Add additional footer or info sections */}
      <footer className="dashboard-footer">
        <p>Finance Dashboard :- Real-time market insights With Integrated FinanceGPT</p>
      </footer>
    </div>
  );
}

export default App;
