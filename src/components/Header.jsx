import React from 'react';
import { BsCircleFill } from 'react-icons/bs';

function Header({ loginControl, newsBanner }) {
  return (
    <header className="dashboard-header" style={{ width: "100%", boxShadow: "0 2px 6px #0001", background: "#1e293b", flexDirection: "column", padding: 0 }}>
      {newsBanner && (
        <div style={{ width: "100%" }}>{newsBanner}</div>
      )}
      <div
        className="header-content"
      >
        {/* LEFT: Brand section */}
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "1.1em", minWidth: 180 }}>
          <h1 style={{ margin: 0, fontSize: "1.6em", fontWeight: 700, letterSpacing: ".01em", color: "#e0e7ef" }}>Finance Dashboard</h1>
          <span className="status-indicator" id="connectionStatus" style={{display: "flex", alignItems: "center", gap: 6}}>
            <BsCircleFill className="status-dot" size={13} style={{ color: "#0ea5e9" }} />
            <span style={{ color: "#38bdf8c0", fontWeight: 500, fontSize: "1em" }}>Connecting...</span>
          </span>
        </div>

        {/* CENTER: Stats */}
        <div
          className="header-stats"
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "3.7em",
            minWidth: 312,
            textAlign: "center"
          }}
        >
        </div>

        {/* RIGHT: Login/Profile */}
        <div className="header-login" style={{ marginLeft: 28, minWidth: 64, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {loginControl}
        </div>
      </div>
    </header>
  );
}

export default Header;
