"use client";

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function RecipientFeed({
  isHost,
  sessionCreated,
  sessionTitle,
  setSessionTitle,
  sessionDuration,
  setSessionDuration,
  handleCreateSession,
  shareUrl,
  qrCanvasRef,
  handleCopyLink,
  whatsappUrl,
  handleNativeShare,
  handleStartHostDemoSim,
  activeLocations,
  telemetry,
  dbRecords,
  backendUrl,
  isSharingActive,
  participantName,
  setParticipantName,
  handleGrantLocation,
  handleRecipientSim,
  mobCoords,
  mobPackets,
  handleStopSharing
}) {
  return (
    <div className="feed-view-wrapper">
      {isHost ? (
        /* Host View */
        <div>
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
                  <a href={`${backendUrl}/api/records/export`} target="_blank" rel="noreferrer" className="export-button">
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
        /* Recipient View (Within the Instagram Feed) */
        <div>
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
    </div>
  );
}