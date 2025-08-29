import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import "./NewsBanner.css";

// Marketaux API configuration
const MARKETAUX_API_KEY = "VTbdpTTe3moshrcAu0gE6ooD85OhduqNhgGfLRJQ";
const MARKETAUX_ALL_URL = "https://api.marketaux.com/v1/news/all";

const DISPLAY_COUNT = 6; // Always get 6, show 2 at a time, cycle 3 pairs

const NewsBanner = forwardRef(function NewsBanner(props, ref) {
  const [newsItems, setNewsItems] = useState([]);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLiveNews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        api_token: MARKETAUX_API_KEY,
        countries: "us,in",
        limit: 50,
        language: "en",
        sort: "published_desc",
      });
      const response = await fetch(`${MARKETAUX_ALL_URL}?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const filteredNews = categorizeAndFilterNews(data.data);
        setNewsItems(filteredNews.slice(0, DISPLAY_COUNT));
        setCycleIndex(0);
      } else {
        throw new Error("Invalid API response structure");
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching news:", err);
      setError(err.message);
      setNewsItems(getMockNews().slice(0, DISPLAY_COUNT));
      setCycleIndex(0);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchLiveNews,
  }));

  // Categorize/filter max 6 news (prefer crypto/indian)
  const categorizeAndFilterNews = (rawNews) => {
    const crypto = [];
    const indian = [];
    const us = [];
    rawNews.forEach((article) => {
      const summary = generateSummarySentence(article);
      const titleL = article.title ? article.title.toLowerCase() : "";
      const description = (article.description || '').toLowerCase();
      const text = titleL + " " + description;
      const displayObj = formatNewsItem(article, summary);

      if (
        text.includes("bitcoin") ||
        text.includes("crypto") ||
        text.includes("ethereum") ||
        text.includes("btc") ||
        text.includes("blockchain") ||
        text.includes("defi")
      ) {
        crypto.push(displayObj);
      } else if (
        text.includes("india") ||
        text.includes("nifty") ||
        text.includes("sensex") ||
        text.includes("bse") ||
        text.includes("nse") ||
        text.includes("rupee") ||
        text.includes("rbi") ||
        text.includes("mumbai")
      ) {
        indian.push(displayObj);
      } else {
        us.push(displayObj);
      }
    });
    // Pick max DISPLAY_COUNT total: up to 2 crypto, 2 indian, then fill with US
    const finalNews = [];
    finalNews.push(...crypto.slice(0, 2));
    finalNews.push(...indian.slice(0, 2));
    const remaining = DISPLAY_COUNT - finalNews.length;
    finalNews.push(...us.slice(0, remaining));
    if (finalNews.length < DISPLAY_COUNT) {
      // Take the next in order, even if duplicate type, to always yield DISPLAY_COUNT
      const allNews = [...crypto, ...indian, ...us];
      const needed = DISPLAY_COUNT - finalNews.length;
      const additional = allNews.slice(0, needed);
      finalNews.push(...additional);
    }
    return finalNews.slice(0, DISPLAY_COUNT);
  };

  const generateSummarySentence = (article) => {
    let summary =
      article.description ||
      article.snippet ||
      article.title ||
      "";

    summary = summary.trim();

    // Try to cut at the first period for a full sentence
    let periodIdx = summary.indexOf(".");
    if (periodIdx > 0 && periodIdx < 140) {
      summary = summary.slice(0, periodIdx + 1);
    } else if (summary.length > 140) {
      summary = summary.slice(0, 137) + "...";
    }

    if (!summary || summary.length < 10) {
      summary = (article.title || "Market update") + ".";
    }
    return summary;
  };

  const formatNewsItem = (article, summaryOverride) => {
    return {
      id: article.uuid || article.id,
      summary: summaryOverride || generateSummarySentence(article),
      url: article.url,
      published_at: article.published_at,
      source: article.source,
    };
  };

  const getMockNews = () => [
    { id: 1, summary: "RBI keeps repo rate unchanged: Markets rally to new highs." },
    { id: 2, summary: "Reliance, TCS, Infosys lead NIFTY gains amid global cues." },
    { id: 3, summary: "HDFC Bank hits 52-week high as banking sector rallies." },
    { id: 4, summary: "Bitcoin surges past $65K as crypto market shows strength." },
    { id: 5, summary: "Fed signals dovish stance: Tech stocks gain momentum." },
    { id: 6, summary: "Ethereum upgrade boosts DeFi adoption rates." },
  ];

  // On mount and every 5 min, refresh news
  useEffect(() => {
    fetchLiveNews();
    const newsRefreshInterval = setInterval(fetchLiveNews, 5 * 60 * 1000);
    return () => clearInterval(newsRefreshInterval);
  }, []);

  // Cycle every 10s, show 2 news at a time (index 0/1, 2/3, 4/5)
  useEffect(() => {
    if (newsItems.length < 2) return;
    const totalCycles = Math.ceil(newsItems.length / 2);
    const cycleInterval = setInterval(() => {
      setCycleIndex(idx => (idx + 1) % totalCycles);
    }, 10000);
    return () => clearInterval(cycleInterval);
  }, [newsItems]);

  // Current pair (2 items per view)
  const getDisplayedNews = () => {
    if (newsItems.length === 0) return [];
    const start = cycleIndex * 2;
    return newsItems.slice(start, start + 2);
  };

  // Sort: bigger news (longer summary) comes first in the pair
  const displayedRaw = getDisplayedNews();
  const displayedNews =
    displayedRaw.length === 2 && displayedRaw[0].summary && displayedRaw[1].summary
      ? [...displayedRaw].sort((a, b) => b.summary.length - a.summary.length)
      : displayedRaw;

  if (loading) {
    return (
      <div className="news-banner news-cards-row">
        <div className="news-loading">Loading latest market news...</div>
      </div>
    );
  }

  if (error && newsItems.length === 0) {
    return (
      <div className="news-banner news-cards-row">
        <div className="news-error">Unable to load news. Check API configuration.</div>
      </div>
    );
  }

  return (
    <div className="news-banner news-cards-row">
      <div className="news-heading-with-controls" style={{ display: "flex", alignItems: "center", gap: "0.54em", marginBottom: ".24em" }}>
        <button
          className="news-refresh-btn"
          style={{ fontSize: "12px", padding: "4px 14px", borderRadius: "6px" }}
          onClick={fetchLiveNews}
          disabled={loading}
          aria-label="Refresh news"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="news-cards-list" style={{ display: "flex", gap: "1.4em" }}>
        {displayedNews.map((item, idx) => (
          <div key={item.id || idx} className="news-card fade-news" style={{ display: "flex", alignItems: "center", gap: "0.7em", padding: "3px 0" }}>
            <span className="news-card-text" style={{ fontSize: "1.05em" }}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.summary}
                </a>
              ) : (
                item.summary
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default NewsBanner;
