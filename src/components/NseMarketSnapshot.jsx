import React, { useEffect, useState, useRef } from 'react';
import NewsBanner from './NewsBanner';

function NseMarketSnapshot() {
  const [loading, setLoading] = useState(true);
  const newsBannerRef = useRef();

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '8px' }}>
        <strong>Live NIFTY Snapshot:</strong> Loading...
      </div>
    );
  }

  return (
    <div
      className="nse-market-snapshot"
      style={{
        marginBottom: 10,
        background: '#f6fbfc',
        border: '1px solid #cce4ec',
        borderRadius: 8,
        padding: 2,
        minHeight: 0,
        height: 'auto',
        maxHeight: 120,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <strong style={{ position: "relative", zIndex: 2 }}>
        Latest Market News
      </strong>
      <div style={{
        position: 'absolute',
        top: -2,
        right: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 14
      }}>
        <span className="news-autorefresh-label" style={{
          fontSize: '0.92em',
          fontWeight: 500,
          padding: '1.5px 7px 1.5px 6px',
          borderRadius: '4px',
          minHeight: 0
        }}>
          Auto refresh : 5 mins
        </span>
        <button
          style={{
            padding: '1.5px 5px',
            background: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            fontSize: '0.89em',
            width: 19,
            height: 19,
            boxShadow: '0 1px 4px #22d3ee33',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Refresh news"
          aria-label="Refresh news"
          onClick={() => newsBannerRef.current && newsBannerRef.current.refresh()}
        >
          <span style={{fontSize: "0.98em", lineHeight: 1}}>🔄</span>
        </button>
      </div>
      <NewsBanner ref={newsBannerRef} />
    </div>
  );
}

export default NseMarketSnapshot;
