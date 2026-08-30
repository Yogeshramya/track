"use client";

import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import dynamic from 'next/dynamic';
import RecipientFeed from './recipient';
import Sidebar from '../components/Sidebar';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

const getBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//${host}:5000`;
    }
  }
  return 'http://localhost:5000';
};

const BACKEND_URL = typeof window !== 'undefined' ? getBackendUrl() : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionCreated, setSessionCreated] = useState(false);
  const [isRecipient, setIsRecipient] = useState(false);
  const [recipientSessionId, setRecipientSessionId] = useState('');

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

  const qrCanvasRef = useRef(null);
  const simIntervalRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setIsRecipient(true);
      setRecipientSessionId(sid);
    }

    const currentBackend = getBackendUrl();
    const s = io(currentBackend);
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // Load initial MongoDB history
    fetch(`${currentBackend}/api/records`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.data && Array.isArray(res.data)) {
          setDbRecords(
            res.data.map((r) => ({
              timestamp: r.indiaTime || 'Recently',
              title: r.sessionTitle || r.purpose || 'My Mobile Location Request',
              name: r.participantName || 'Mobile Recipient',
              ip: r.ipAddress || '127.0.0.1',
              latitude: Number(r.latitude).toFixed(6),
              longitude: Number(r.longitude).toFixed(6),
              accuracy: r.accuracy ? `±${Math.round(r.accuracy)}m` : '±5m'
            }))
          );
        }
      })
      .catch(() => {});

    s.on('location-updated', (data) => {
      const { participantId, participantName, ip, location, indiaTime, sessionTitle: recTitle } = data;
      const { latitude, longitude, accuracy, speed } = location;

      const currentIst = indiaTime || new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());

      setTelemetry({
        latLng: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        ip: ip || '127.0.0.1',
        accuracySpeed: `±${Math.round(accuracy || 5)}m | ${speed ? (speed * 3.6).toFixed(1) : 0} km/h`,
        timestamp: `${currentIst} IST`
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
        timestamp: `${currentIst} IST`,
        title: recTitle || sessionTitle || 'My Mobile Location Request',
        name: participantName || 'Mobile Participant',
        ip: ip || '127.0.0.1',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        accuracy: accuracy ? `±${Math.round(accuracy)}m` : '±5m'
      };

      setDbRecords((prev) => [newDbRecord, ...prev.slice(0, 49)]);
    });

    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      s.disconnect();
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  const handleCreateSession = () => {
    if (!socket) return;

    const currentBackend = getBackendUrl();
    socket.emit('create-session', {
      title: sessionTitle,
      durationMinutes: parseInt(sessionDuration, 10),
      origin: window.location.origin,
      backendUrl: currentBackend
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

  if (!isMounted) return null;

  if (isRecipient && recipientSessionId) {
    return <RecipientFeed sessionId={recipientSessionId} backendUrl={BACKEND_URL} />;
  }

  return (
    <div className="ig-app">
      {/* Left Sidebar */}
      <Sidebar activeTab="Profile" />

      {/* Main Container */}
      <main className="ig-main">

        <div className="feed-container">
          {/* Instagram Profile Header */}
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

          {/* Host Feed Area */}
          <div className="host-feed-container">
            {!sessionCreated ? (
              /* Create Session Post */
              <article className="instagram-card">
                <div className="post-header">
                  <div className="post-avatar">
                    <svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <div className="post-user">
                    <strong>LocShare</strong>
                    <span>Real-Time Location Tracker</span>
                  </div>
                </div>

                <div className="location-hero">
                  <div className="hero-location-icon">
                    <svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  </div>
                  <span>LIVE LOCATION STREAM</span>
                </div>

                <div className="post-body">
                  <strong>Create Real-Time Mobile Location Link</strong>
                  <p>Generate a secure shareable link and QR Code for live GPS tracking.</p>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Session Title / Purpose</label>
                      <input
                        type="text"
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        placeholder="e.g. Delivery / Meetup"
                      />
                    </div>

                    <div className="form-group">
                      <label>Link Expiration</label>
                      <select value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)}>
                        <option value="15">15 Minutes</option>
                        <option value="60">1 Hour</option>
                        <option value="360">6 Hours</option>
                        <option value="1440">24 Hours</option>
                      </select>
                    </div>
                  </div>

                  <button onClick={handleCreateSession} className="instagram-primary-button">
                    Generate Shareable Link & QR Code
                  </button>
                </div>
              </article>
            ) : (
              /* Active Session Cards */
              <div>
                {/* QR Code Post */}
                <article className="instagram-card">
                  <div className="post-header">
                    <div className="post-avatar">QR</div>
                    <div className="post-user">
                      <strong>LocShare Shareable Link</strong>
                      <span>Scan with Mobile Phone</span>
                    </div>
                  </div>

                  <div className="qr-section">
                    <h2>Scan with Mobile Phone</h2>
                    <p>Scan this QR code with any mobile camera or share the link via WhatsApp.</p>

                    <div className="qr-wrapper">
                      <canvas ref={qrCanvasRef}></canvas>
                    </div>

                    <div className="share-url-container">
                      <input type="text" value={shareUrl} readOnly />
                      <button onClick={handleCopyLink} className="copy-button">Copy</button>
                    </div>

                    <div className="quick-share-buttons">
                      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="whatsapp-button">
                        WhatsApp Share
                      </a>
                      <button onClick={handleNativeShare} className="copy-button" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        Share Link 📲
                      </button>
                      <button onClick={handleStartHostDemoSim} className="demo-button">
                        Demo GPS
                      </button>
                    </div>
                  </div>
                </article>

                {/* Map Post */}
                <article className="instagram-card map-card">
                  <div className="post-header">
                    <div className="post-avatar">📍</div>
                    <div className="post-user">
                      <strong>{sessionTitle}</strong>
                      <span>Live Telemetry Stream</span>
                    </div>
                  </div>

                  <MapView locations={activeLocations} />

                  <div className="telemetry-grid">
                    <div className="telemetry-card">
                      <span>Coordinates (Lat, Lng)</span>
                      <strong>{telemetry.latLng}</strong>
                    </div>
                    <div className="telemetry-card">
                      <span>IP Address</span>
                      <strong>{telemetry.ip}</strong>
                    </div>
                    <div className="telemetry-card">
                      <span>Accuracy / Speed</span>
                      <strong>{telemetry.accuracySpeed}</strong>
                    </div>
                    <div className="telemetry-card">
                      <span>Last Update</span>
                      <strong>{telemetry.timestamp}</strong>
                    </div>
                  </div>
                </article>

                {/* Database Table Card */}
                <article className="instagram-card database-card">
                  <div className="post-header">
                    <div className="post-avatar">🗄️</div>
                    <div className="post-user">
                      <strong>MongoDB Live Records</strong>
                      <span>{dbRecords.length} Saved in Session</span>
                    </div>
                    <a href={`${BACKEND_URL}/api/records/export`} target="_blank" rel="noreferrer" className="export-button">
                      Export CSV
                    </a>
                  </div>

                  <div className="table-responsive">
                    <table className="db-table">
                      <thead>
                        <tr>
                          <th>Time (IST)</th>
                          <th>Purpose / Session Title</th>
                          <th>Device</th>
                          <th>IP</th>
                          <th>Latitude</th>
                          <th>Longitude</th>
                          <th>Accuracy</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dbRecords.length === 0 ? (
                          <tr><td colSpan={8} style={{ color: '#737373', textAlign: 'center' }}>Awaiting device connection and GPS telemetry...</td></tr>
                        ) : (
                          dbRecords.map((r, i) => (
                            <tr key={i}>
                              <td><span style={{ color: '#A8A8A8', fontSize: '0.75rem' }}>{r.timestamp}</span></td>
                              <td><strong style={{ color: '#38BDF8' }}>{r.title || sessionTitle}</strong></td>
                              <td><strong>{r.name}</strong></td>
                              <td><span className="ip-badge">{r.ip}</span></td>
                              <td style={{ color: '#10B981', fontFamily: 'monospace' }}>{r.latitude}</td>
                              <td style={{ color: '#10B981', fontFamily: 'monospace' }}>{r.longitude}</td>
                              <td style={{ color: '#A8A8A8' }}>{r.accuracy}</td>
                              <td>
                                <a
                                  href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="maps-redirect-btn"
                                  title="Open in Google Maps"
                                >
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                    <circle cx="12" cy="9" r="2.5" />
                                  </svg>
                                  <span>{r.latitude}, {r.longitude}</span>
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
