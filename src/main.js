import { io } from 'socket.io-client';
import QRCode from 'qrcode';

// Initialize App State
let socket = null;
let activeSessionId = null;
let isHost = false;
let leafletMap = null;
let participantMarkers = new Map(); // id -> { marker, circle, polyline, pathCoords: [] }
let watchPositionId = null;
let simulationInterval = null;
let packetsSentCount = 0;

// DOM Elements
const hostView = document.getElementById('host-view');
const recipientView = document.getElementById('recipient-view');
const connectionStatus = document.getElementById('connection-status');
const createCard = document.getElementById('create-card');
const activeSessionPanel = document.getElementById('active-session-panel');

// Socket Initialization
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    connectionStatus.className = 'status-pill status-connected';
    connectionStatus.querySelector('.status-text').textContent = 'Live System Ready';
    console.log('[Socket] Connected to server.');
  });

  socket.on('disconnect', () => {
    connectionStatus.className = 'status-pill status-connecting';
    connectionStatus.querySelector('.status-text').textContent = 'Reconnecting...';
  });

  // Host events
  socket.on('participant-joined', (data) => {
    showToast(`📱 Participant opened link: ${data.participant.name}`);
    updateParticipantList(data.participant);
  });

  socket.on('location-updated', (data) => {
    const { participantId, participantName, location } = data;
    updateHostMapLocation(participantId, participantName, location);
  });

  socket.on('participant-stopped', (data) => {
    showToast(`⚠️ Participant stopped location sharing.`);
    removeParticipantFromMap(data.participantId);
  });

  socket.on('participant-left', (data) => {
    showToast(`Participant disconnected.`);
    removeParticipantFromMap(data.participantId);
  });
}

// Router & Mode Selection
function checkUrlRouting() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');

  if (sessionId) {
    // Recipient View
    isHost = false;
    activeSessionId = sessionId;
    hostView.classList.add('hidden');
    recipientView.classList.remove('hidden');
    setupRecipientFlow(sessionId);
  } else {
    // Host View
    isHost = true;
    hostView.classList.remove('hidden');
    recipientView.classList.add('hidden');
    setupHostFlow();
  }
}

// ================= HOST FLOW LOGIC =================
function setupHostFlow() {
  const btnCreate = document.getElementById('btn-create-session');
  btnCreate.addEventListener('click', createSession);

  const btnCopy = document.getElementById('btn-copy-url');
  btnCopy.addEventListener('click', () => {
    const input = document.getElementById('share-url-input');
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('📋 Link copied to clipboard!');
  });

  const btnNativeShare = document.getElementById('btn-native-share');
  if (btnNativeShare) {
    btnNativeShare.addEventListener('click', shareLocationLink);
  }

  document.getElementById('btn-demo-sim').addEventListener('click', startHostDemoSimulation);
  document.getElementById('btn-recenter').addEventListener('click', recenterMap);
  document.getElementById('btn-clear-path').addEventListener('click', clearMapTrails);
}

function shareLocationLink() {
  const input = document.getElementById('share-url-input');
  const url = input ? input.value : window.location.href;
  const title = document.getElementById('session-title')?.value || 'Live Location Sharing';

  if (navigator.share) {
    navigator.share({
      title: 'Share Live Location',
      text: `Tap this link to access and share live location for session '${title}':`,
      url: url
    }).catch((err) => console.log('Share canceled:', err));
  } else {
    navigator.clipboard.writeText(url);
    showToast('📋 Link copied to clipboard!');
  }
}

function createSession() {
  const title = document.getElementById('session-title').value || 'Mobile Location Tracking';
  const durationMinutes = parseInt(document.getElementById('session-duration').value, 10);
  const origin = window.location.origin;

  socket.emit('create-session', { title, durationMinutes, origin }, (res) => {
    if (res.success) {
      activeSessionId = res.sessionId;
      createCard.classList.add('hidden');
      activeSessionPanel.classList.remove('hidden');

      document.getElementById('dash-session-title').textContent = title;
      document.getElementById('share-url-input').value = res.shareUrl;

      // Render QR Code
      const qrCanvas = document.getElementById('qr-canvas');
      QRCode.toCanvas(qrCanvas, res.shareUrl, {
        width: 180,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      });

      // Update WhatsApp button
      const whatsappBtn = document.getElementById('btn-share-whatsapp');
      const shareText = encodeURIComponent(`Please tap this link to share your location for session '${title}': ${res.shareUrl}`);
      whatsappBtn.href = `https://api.whatsapp.com/send?text=${shareText}`;

      // Initialize Leaflet Map
      initMap();
      showToast('✅ Session created! Scan QR code or share link with mobile phone.');
    } else {
      alert('Failed to create session: ' + res.error);
    }
  });
}

// Leaflet Map Initialization
function initMap() {
  if (leafletMap) return;

  // Default centered at center location (or 20.5937, 78.9629)
  leafletMap = L.map('map').setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);
}

let dbRecordCounter = 0;

function updateHostMapLocation(participantId, name, location) {
  const { latitude, longitude, accuracy, speed, heading, ip } = location;

  // Update telemetry bar
  document.getElementById('telem-latlng').textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  if (document.getElementById('telem-ip')) {
    document.getElementById('telem-ip').textContent = ip || '192.168.31.205';
  }
  if (document.getElementById('telem-accuracy-speed')) {
    const accStr = accuracy ? `±${Math.round(accuracy)}m` : '±5m';
    const spdStr = speed ? `${(speed * 3.6).toFixed(1)} km/h` : '0 km/h';
    document.getElementById('telem-accuracy-speed').textContent = `${accStr} | ${spdStr}`;
  }
  document.getElementById('telem-timestamp').textContent = new Date().toLocaleTimeString();

  // Append entry to SQLite DB UI table
  addDatabaseTableRow({
    timestamp: new Date().toLocaleTimeString(),
    name: name || 'Mobile Participant',
    ip: ip || '127.0.0.1',
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    accuracy: accuracy ? `±${Math.round(accuracy)}m` : '±5m'
  });

  const latLng = [latitude, longitude];

  if (!participantMarkers.has(participantId)) {
    // Create custom pin marker
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background:#10B981; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 15px #10B981;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const marker = L.marker(latLng, { icon: customIcon }).addTo(leafletMap);
    marker.bindPopup(`<b>${name}</b><br>IP: ${ip || 'Unknown'}<br>Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`).openPopup();

    const circle = L.circle(latLng, {
      radius: accuracy || 15,
      color: '#10B981',
      fillColor: '#10B981',
      fillOpacity: 0.15,
      weight: 1
    }).addTo(leafletMap);

    const polyline = L.polyline([latLng], {
      color: '#6366F1',
      weight: 4,
      opacity: 0.8,
      dashArray: '6, 8'
    }).addTo(leafletMap);

    participantMarkers.set(participantId, {
      marker,
      circle,
      polyline,
      pathCoords: [latLng]
    });

    leafletMap.setView(latLng, 16);
  } else {
    const pData = participantMarkers.get(participantId);
    pData.marker.setLatLng(latLng);
    pData.circle.setLatLng(latLng);
    if (accuracy) pData.circle.setRadius(accuracy);

    pData.pathCoords.push(latLng);
    pData.polyline.setLatLngs(pData.pathCoords);
  }
}

function addDatabaseTableRow(rec) {
  const tbody = document.getElementById('db-records-tbody');
  if (!tbody) return;

  // Clear empty state placeholder if present
  if (tbody.children.length === 1 && tbody.children[0].cells.length === 1) {
    tbody.innerHTML = '';
  }

  dbRecordCounter++;
  const badgeCount = document.getElementById('db-record-count');
  if (badgeCount) badgeCount.textContent = `${dbRecordCounter} DB Records Persisted`;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span style="color:#9CA3AF; font-size:0.8rem;">${rec.timestamp}</span></td>
    <td><strong style="color:white;">${rec.name}</strong></td>
    <td><span class="ip-badge">${rec.ip}</span></td>
    <td><span style="color:#34D399; font-family:monospace;">${rec.latitude}</span></td>
    <td><span style="color:#34D399; font-family:monospace;">${rec.longitude}</span></td>
    <td><span style="color:#9CA3AF;">${rec.accuracy}</span></td>
  `;

  // Prepend to top of table
  tbody.insertBefore(tr, tbody.firstChild);

  // Keep table at max 25 rows in DOM
  if (tbody.children.length > 25) {
    tbody.removeChild(tbody.lastChild);
  }
}

function removeParticipantFromMap(participantId) {
  if (participantMarkers.has(participantId)) {
    const pData = participantMarkers.get(participantId);
    leafletMap.removeLayer(pData.marker);
    leafletMap.removeLayer(pData.circle);
    leafletMap.removeLayer(pData.polyline);
    participantMarkers.delete(participantId);
  }
}

function recenterMap() {
  if (!leafletMap || participantMarkers.size === 0) return;
  const group = L.featureGroup(Array.from(participantMarkers.values()).map(p => p.marker));
  leafletMap.fitBounds(group.getBounds().pad(0.2));
}

function clearMapTrails() {
  participantMarkers.forEach(pData => {
    pData.pathCoords = [pData.marker.getLatLng()];
    pData.polyline.setLatLngs(pData.pathCoords);
  });
  showToast('Cleared location trail lines.');
}

function updateParticipantList(participant) {
  const container = document.getElementById('participant-list');
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const item = document.createElement('div');
  item.className = 'participant-item card';
  item.style.padding = '0.75rem 1rem';
  item.style.marginBottom = '0.5rem';
  item.style.display = 'flex';
  item.style.justifyContent = 'space-between';
  item.style.alignItems = 'center';

  item.innerHTML = `
    <div>
      <strong style="color:white; font-size:0.9rem;">${participant.name}</strong>
      <div style="font-size:0.75rem; color:#10B981;">Connected & Ready</div>
    </div>
    <span class="badge badge-encrypted">Connected</span>
  `;
  container.appendChild(item);
}

// ================= RECIPIENT / CONSENT FLOW LOGIC =================
function setupRecipientFlow(sessionId) {
  const btnGrant = document.getElementById('btn-grant-location');
  const btnStop = document.getElementById('btn-stop-sharing');
  const btnSim = document.getElementById('btn-recip-sim');

  // Join session socket room
  socket.emit('join-session', { sessionId }, (res) => {
    if (res.success) {
      document.getElementById('recip-title').textContent = res.sessionTitle;
    } else {
      document.getElementById('consent-prompt-card').innerHTML = `
        <h2 style="color:#EF4444;">Session Error</h2>
        <p class="consent-desc">${res.error}</p>
      `;
    }
  });

  btnGrant.addEventListener('click', startLiveGeolocation);
  btnStop.addEventListener('click', stopLiveGeolocation);
  btnSim.addEventListener('click', startRecipientDemoSimulation);
}

function startLiveGeolocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const nameInput = document.getElementById('participant-name-input').value;
  const pName = nameInput.trim() || 'Mobile Device';

  // Toggle card UI
  document.getElementById('consent-prompt-card').classList.add('hidden');
  document.getElementById('broadcasting-card').classList.remove('hidden');

  packetsSentCount = 0;

  watchPositionId = navigator.geolocation.watchPosition(
    (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading
      };

      packetsSentCount++;
      document.getElementById('mob-packets-count').textContent = packetsSentCount;
      document.getElementById('mob-coords').textContent = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      document.getElementById('mob-gps-status').textContent = `High Accuracy (±${Math.round(location.accuracy)}m)`;

      // Emit to server
      socket.emit('update-location', {
        sessionId: activeSessionId,
        location
      });
    },
    (err) => {
      console.error('[Geolocation Error]', err);
      let errMsg = 'Failed to obtain GPS location.';
      if (err.code === 1) errMsg = 'Permission denied. Please allow location access in browser settings.';
      else if (err.code === 2) errMsg = 'Position unavailable. Check GPS signals.';
      else if (err.code === 3) errMsg = 'GPS request timed out.';
      
      document.getElementById('mob-gps-status').textContent = errMsg;
      document.getElementById('mob-gps-status').className = 'text-danger';
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function stopLiveGeolocation() {
  if (watchPositionId !== null) {
    navigator.geolocation.clearWatch(watchPositionId);
    watchPositionId = null;
  }

  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  socket.emit('stop-sharing', { sessionId: activeSessionId });

  document.getElementById('broadcasting-card').classList.add('hidden');
  document.getElementById('consent-prompt-card').classList.remove('hidden');
  showToast('🛑 Location sharing stopped.');
}

// ================= DEMO SIMULATION ENGINES =================
function startRecipientDemoSimulation() {
  document.getElementById('consent-prompt-card').classList.add('hidden');
  document.getElementById('broadcasting-card').classList.remove('hidden');

  let lat = 28.6139; // Delhi center point simulation
  let lng = 77.2090;
  packetsSentCount = 0;

  simulationInterval = setInterval(() => {
    lat += (Math.random() - 0.3) * 0.0003;
    lng += (Math.random() - 0.2) * 0.0003;
    packetsSentCount++;

    const location = {
      latitude: lat,
      longitude: lng,
      accuracy: 5 + Math.random() * 3,
      speed: 1.5 + Math.random(),
      heading: 45
    };

    document.getElementById('mob-packets-count').textContent = packetsSentCount;
    document.getElementById('mob-coords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    socket.emit('update-location', {
      sessionId: activeSessionId,
      location
    });
  }, 2000);
}

function startHostDemoSimulation() {
  if (!activeSessionId) return;

  let simLat = 28.6139;
  let simLng = 77.2090;

  showToast('🚀 Host Demo GPS Simulation Started!');

  let interval = setInterval(() => {
    simLat += (Math.random() - 0.25) * 0.0004;
    simLng += (Math.random() - 0.15) * 0.0004;

    const mockLocation = {
      latitude: simLat,
      longitude: simLng,
      accuracy: 4,
      speed: 2.1,
      heading: 90
    };

    updateHostMapLocation('demo-sim-device', 'Demo Simulated Phone', mockLocation);
  }, 2000);
}

// Toast Helper
function showToast(msg) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Start App
initSocket();
checkUrlRouting();
