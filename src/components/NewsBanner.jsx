import React, { useState, useEffect } from "react";
import "./NewsBanner.css";

const mockNews = [
  "RBI keeps repo rate unchanged: Markets rally to new highs.",
  "Reliance, TCS, Infosys lead NIFTY gains amid global cues.",
  "HDFC Bank hits 52-week high as banking sector rallies.",
  "BREAKING: Govt. to announce new fiscal reforms at 3PM.",
  "Crude oil slips below $80; OMCs gain, aviation stocks up.",
];

const DISPLAY_COUNT = 4; // Show up to 3 at once

export default function NewsBanner() {
  const [cycleStart, setCycleStart] = useState(0);

  // Cycle news every 3.5 seconds, with fade-out/fade-in
  useEffect(() => {
    const interval = setInterval(() => {
      setCycleStart(start => (start + DISPLAY_COUNT) % mockNews.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Slice the next set, wrap if needed
  const displayed = [];
  for (let i = 0; i < DISPLAY_COUNT; ++i) {
    displayed.push(mockNews[(cycleStart + i) % mockNews.length]);
  }

  return (
    <div className="news-banner news-cards-row">
      <ul className="news-cards-list">
        {displayed.map((item, idx) => (
          <li key={idx} className="news-card fade-news">
            <span className="news-bullet"/>
            <span className="news-card-text">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
