import React from 'react';
import ChartContainer from './ChartContainer';

function MarketSection({ title, symbols, chartColors }) {
  return (
    <div className="market-section">
      <h2 className="section-title">{title}</h2>
      <div className="charts-grid">
        {symbols.map((sym) => (
          <ChartContainer
            key={sym.key}
            id={`${sym.key}Chart`}
            title={sym.name}
            color={chartColors[sym.key]}
            symbol={sym.key}
            tradingViewSymbol={
              sym.name && sym.name.toUpperCase().includes("NIFTY")
                ? "NIFTY"
                : sym.name && sym.name.toUpperCase().includes("BANKNIFTY")
                ? "BANKNIFTY"
                : sym.key
                ? sym.key.toUpperCase()
                : undefined
            }
            priceId={`${sym.key}-price`}
            changeId={`${sym.key}-change`}
            statusId={`${sym.key}-status`}
          />
        ))}
      </div>
    </div>
  );
}

export default MarketSection;
