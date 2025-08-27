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
          fontWeight: 600,
          fontSize: "1.12em",
          letterSpacing: "0.01em",
          border: "none",
          outline: "none",
          padding: "13px 32px",
          borderRadius: 9,
          color: "#fff",
          background: "linear-gradient(90deg,#0ea5e9 60%,#2563eb 100%)",
          boxShadow: "0 2px 16px #1e293b22",
          cursor: !API_KEY ? "not-allowed" : "pointer",
          transition: "background .16s"
        }}
      >
        <MdLogin size={22} style={{marginRight:2, marginBottom: -2}} />
        <span>Login with Zerodha</span>
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
