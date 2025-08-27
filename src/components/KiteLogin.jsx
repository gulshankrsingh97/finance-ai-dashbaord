import React, { useState, useEffect } from "react";
import { MdLogin } from "react-icons/md";

const ZERODHA_LOGIN_URL = "https://kite.zerodha.com/connect/login";
const API_KEY = import.meta.env.VITE_KITE_API_KEY || "";

export default function KiteLogin({ onAccessToken }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");

  // Step 1: If redirected from Kite login, parse request_token param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestToken = urlParams.get("request_token");
    if (requestToken) {
      // Step 2: Exchange request_token for access_token
      fetch("/convert-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_token: requestToken }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            setAccessToken(data.access_token);
            setIsLoggedIn(true);
            setError("");
            // Remove the token from the URL
            window.history.replaceState(null, '', window.location.pathname);
            if (onAccessToken) onAccessToken(data.access_token);
          } else {
            setError(data.error || data.message || "Failed to convert token");
          }
        })
        .catch(err => setError("Token exchange failed: " + err.message));
    }
  }, [onAccessToken]);

  // Trigger login redirect
  const handleLogin = () => {
    if (!API_KEY) {
      setError("Missing API_KEY: Set VITE_KITE_API_KEY in your .env or environment.");
      return;
    }
    const loginUrl =
      ZERODHA_LOGIN_URL +
      "?api_key=" + encodeURIComponent(API_KEY);
    window.location.href = loginUrl;
  };

  if (isLoggedIn && accessToken) {
    return <div>✅ Logged in with Zerodha</div>;
  }
  return (
    <div>
      <button
        onClick={handleLogin}
        disabled={!API_KEY}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          fontWeight: 700,
          fontSize: "1.02rem",
          letterSpacing: "0.02em",
          border: "1px solid #0ea5e966",
          outline: "none",
          padding: "12px 20px",
          borderRadius: 10,
          color: !API_KEY ? "#94a3b8" : "#e6f6ff",
          background: !API_KEY ? "#0b1220" : "linear-gradient(90deg,#0ea5e9 60%,#2563eb 100%)",
          boxShadow: !API_KEY ? "inset 0 0 0 1px #0ea5e922" : "0 2px 16px #0ea5e933",
          opacity: !API_KEY ? 0.8 : 1,
          cursor: !API_KEY ? "not-allowed" : "pointer",
          transition: "all .16s ease"
        }}
        onMouseEnter={(e)=>{ if(API_KEY){ e.currentTarget.style.boxShadow='0 4px 22px #0ea5e955'; } }}
        onMouseLeave={(e)=>{ if(API_KEY){ e.currentTarget.style.boxShadow='0 2px 16px #0ea5e933'; } }}
      >
        <MdLogin size={22} style={{marginRight:2, marginBottom: -2}} />
        <span>Login</span>
      </button>
      {!API_KEY && (
        <div style={{ color: "orange", marginTop: 8 }}>
          Missing API_KEY. Set VITE_KITE_API_KEY in .env.
        </div>
      )}
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
