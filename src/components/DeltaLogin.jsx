import React, { useState, useEffect } from 'react';

function DeltaLogin({ onAccessToken }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [showAuth, setShowAuth] = useState(false);

  // Generate Delta Exchange authentication URL
  const generateAuthUrl = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/delta/auth-url');
      if (!response.ok) {
        throw new Error('Failed to generate auth URL');
      }
      
      const data = await response.json();
      setAuthUrl(data.auth_url);
      setShowAuth(true);
    } catch (err) {
      setError('Failed to start authentication: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for authentication callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const deltaToken = urlParams.get('delta_token');
    const deltaError = urlParams.get('delta_error');
    
    if (deltaToken) {
      // Successfully authenticated
      onAccessToken(deltaToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (deltaError) {
      setError('Authentication failed: ' + deltaError);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onAccessToken]);

  if (showAuth && authUrl) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        minWidth: '320px',
        textAlign: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#e0e7ef', fontSize: '1.2em' }}>
            Complete Delta Exchange Login
          </h3>
          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9em' }}>
            Click the button below to complete your authentication
          </p>
        </div>
        
        <a
          href={authUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#22c55e',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '500',
            fontSize: '16px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#16a34a'}
          onMouseOut={(e) => e.target.style.background = '#22c55e'}
        >
          🔐 Complete Login on Delta Exchange
        </a>
        
        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
          <p style={{ margin: '8px 0' }}>
            This will open Delta Exchange in a new tab. Complete the login there and return here.
          </p>
          <p style={{ margin: '8px 0' }}>
            After successful login, you'll be automatically redirected back.
          </p>
        </div>
        
        <button
          onClick={() => {
            setShowAuth(false);
            setAuthUrl('');
            setError('');
          }}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid #475569',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      background: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
      minWidth: '320px',
      textAlign: 'center'
    }}>
      <div>
        <h3 style={{ margin: 0, color: '#e0e7ef', fontSize: '1.2em' }}>
          Delta Exchange Login
        </h3>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '0.9em' }}>
          Connect your Delta Exchange account for premium data
        </p>
      </div>
      
      {error && (
        <div style={{ 
          color: '#ef4444', 
          fontSize: '14px', 
          padding: '8px 12px',
          background: '#1f2937',
          borderRadius: '6px',
          border: '1px solid #374151'
        }}>
          {error}
        </div>
      )}
      
      <button
        onClick={generateAuthUrl}
        disabled={isLoading}
        style={{
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          background: isLoading ? '#475569' : '#22c55e',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: '500',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s'
        }}
      >
        {isLoading ? '🔄 Connecting...' : '🔐 Connect to Delta Exchange'}
      </button>
      
      <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
        <p style={{ margin: '8px 0' }}>
          This will redirect you to Delta Exchange for secure authentication.
        </p>
        <p style={{ margin: '8px 0' }}>
          No API keys needed - we handle the OAuth flow securely.
        </p>
      </div>
    </div>
  );
}

export default DeltaLogin;
