import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js';
import { FiBarChart } from 'react-icons/fi';

function ChartContainer({ id, title, color, price, change, changePercent, statusText, registerChart, chartData, tradingViewSymbol, tradingViewMarket }) {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Price',
            data: [],
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { type: 'time', time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } }, grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: '#9ca3af', maxTicksLimit: 6 } },
            y: { grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: '#9ca3af' } }
          },
          interaction: { intersect: false, mode: 'index' }
        }
      });
      if (registerChart) {
        registerChart(id.replace('Chart', ''), chartInstance.current);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [color, id, registerChart]);

  useEffect(() => {
    if (chartInstance.current && chartData) {
      chartInstance.current.data.labels = chartData.map(point => point.x);
      chartInstance.current.data.datasets[0].data = chartData.map(point => point.y);
      chartInstance.current.update('none');
    }
  }, [chartData]);

  return (
    <div className="chart-container">
      <div className="chart-header" style={{display: 'flex', alignItems: 'center', gap: '0.75em'}}>
        <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5em'}}>
          {title}
          {tradingViewSymbol && (
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${tradingViewSymbol} in TradingView`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35em',
                padding: '4px 9px',
                borderRadius: '7px',
                background: '#23272f',
                color: '#38bdf8',
                fontWeight: 500,
                boxShadow: '0 1px 8px #2d4d6ee8',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                fontSize: '1em',
                transition: 'background 0.18s, color 0.18s'
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#23272f'; e.currentTarget.style.color = '#38bdf8'; }}
            >
              <FiBarChart size={19} style={{ marginTop: "-1px" }} />
              <span style={{ fontWeight: 500 }}>Chart</span>
            </a>
          )}
        </h3>
        <div className="chart-stats">
          <span className="price">{typeof price === "number" ? price.toFixed(2) : "--"}</span>
          <span className={`change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '+' : ''}
            {typeof change === "number" ? change.toFixed(2) : "--"}
            {" "}
            ({typeof changePercent === "number" ? changePercent.toFixed(2) : "--"}%)
          </span>
        </div>
      </div>
      <div className="chart-wrapper" style={{ position: 'relative', height: '150px' }}>
        <canvas ref={canvasRef} id={id}></canvas>
      </div>
      <div className="chart-status">{statusText || "Loading..."}</div>
    </div>
  );
}

export default ChartContainer;
