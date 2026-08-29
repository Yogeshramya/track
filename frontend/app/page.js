"use client";

import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import dynamic from 'next/dynamic';

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

        {isHost ? (
          /* Host View */
          <div className="feed-container">
            {/* Profile Section */}
            <section className="profile-header">
              <div className="profile-avatar">
                <div className="location-avatar">
                  <svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
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
                          <th>Time</th>
                          <th>Device</th>
                          <th>IP</th>
                          <th>Latitude</th>
                          <th>Longitude</th>
                          <th>Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dbRecords.length === 0 ? (
                          <tr><td colSpan={6} style={{ color: '#737373', textAlign: 'center' }}>Awaiting device connection and GPS telemetry...</td></tr>
                        ) : (
                          dbRecords.map((r, i) => (
                            <tr key={i}>
                              <td><span style={{ color: '#737373', fontSize: '0.75rem' }}>{r.timestamp}</span></td>
                              <td><strong>{r.name}</strong></td>
                              <td><span className="ip-badge">{r.ip}</span></td>
                              <td style={{ color: '#10B981', fontFamily: 'monospace' }}>{r.latitude}</td>
                              <td style={{ color: '#10B981', fontFamily: 'monospace' }}>{r.longitude}</td>
                              <td style={{ color: '#737373' }}>{r.accuracy}</td>
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
        ) : (
          /* Recipient View */
          <div className="consent-container">
            {!isSharingActive ? (
              <article className="instagram-card consent-card">
                <div className="consent-avatar">
                  <svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
                </div>
                <h1>{sessionTitle}</h1>
                <p style={{ color: '#A8A8A8', fontSize: '0.9rem', margin: '0.5rem 0 1rem' }}>
                  The host has requested access to your live GPS position for this session.
                </p>

                <div className="privacy-guarantee-box">
                  <h3>🔒 Privacy Guarantees</h3>
                  <ul>
                    <li>✓ Opt-in only with explicit user permission</li>
                    <li>✓ Stop streaming anytime</li>
                    <li>✓ Automatic session expiration</li>
                  </ul>
                </div>

                <div className="form-group" style={{ textAlign: 'left', marginBottom: '1rem' }}>
                  <label>Your Display Name</label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="e.g. My Phone / John"
                  />
                </div>

                <button onClick={handleGrantLocation} className="instagram-primary-button">
                  Grant & Start Live Location Sharing
                </button>
                <button onClick={handleRecipientSim} className="outline-button">
                  Simulate GPS Movement
                </button>
              </article>
            ) : (
              <article className="instagram-card consent-card">
                <div className="live-location-animation">
                  <div className="radar-circle circle-one"></div>
                  <div className="radar-circle circle-two"></div>
                  <div className="radar-circle circle-three"></div>
                  <div className="radar-pin">📍</div>
                </div>

                <h1 style={{ color: '#10B981' }}>Live Location Active</h1>
                <p style={{ color: '#A8A8A8', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                  Broadcasting coordinates to host session...
                </p>

                <div style={{ background: '#1A1A1A', padding: '1rem', borderRadius: '8px', margin: '1rem 0' }}>
                  <div>GPS Coordinates: <strong style={{ color: 'white' }}>{mobCoords}</strong></div>
                  <div style={{ marginTop: '0.5rem' }}>Packets Sent: <strong style={{ color: '#10B981' }}>{mobPackets}</strong></div>
                </div>

                <button onClick={handleStopSharing} className="danger-button">
                  ✕ Stop Sharing Location
                </button>
              </article>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
