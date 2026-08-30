import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:Yogesh%400405@cluster0.wkrw3fv.mongodb.net/track';

let isMongoConnected = false;
const fallbackMemoryRecords = [];

// MongoDB Schemas
const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'My Mobile Location Request' },
  purpose: { type: String, default: 'General' },
  durationMinutes: { type: Number, default: 60 },
  shareUrl: String,
  localUrl: String,
  meetupLat: Number,
  meetupLng: Number,
  hostIp: String,
  indiaTime: String,
  createdAt: { type: Date, default: Date.now },
  expireTime: { type: Date }
});

const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);

const LocationRecordSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  sessionTitle: { type: String, default: 'General Location Request' },
  purpose: { type: String, default: 'General' },
  participantId: String,
  participantName: String,
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: Number,
  speed: Number,
  heading: Number,
  ipAddress: String,
  indiaTime: String,
  createdAt: { type: Date, default: Date.now }
});

const LocationRecord = mongoose.models.LocationRecord || mongoose.model('LocationRecord', LocationRecordSchema);
const fallbackMemorySessions = [];

function getIndiaTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => {
    isMongoConnected = true;
    console.log('🍃 [Backend] Connected successfully to MongoDB Database');
  })
  .catch((err) => {
    console.warn('⚠️ [Backend] MongoDB connection notice:', err.message);
    console.warn('💡 Tip: Live records are stored in memory and streamed seamlessly.');
  });

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  let ip = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

function getReqIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp.trim();
  let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

const app = express();
const httpServer = createServer(app);

// Enable CORS for frontend clients (Vercel, Localhost, etc.)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const localIp = getLocalIp();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LocShare Real-Time Tracker Backend',
    mongoConnected: isMongoConnected,
    timestamp: new Date().toISOString()
  });
});

// Dynamic IP Geolocation resolver when GPS coordinates are not yet available
async function getIpLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,query`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && typeof data.lat === 'number' && typeof data.lon === 'number') {
        return {
          latitude: data.lat,
          longitude: data.lon,
          city: data.city,
          region: data.regionName,
          country: data.country
        };
      }
    }
  } catch (_) {}
  return null;
}

// API Endpoint: Instant Visit & IP Capture when link is opened
app.post('/api/track-visit', async (req, res) => {
  const { sessionId, participantName, latitude, longitude, accuracy, sessionTitle, purpose } = req.body;
  const ipAddress = req.body.clientIp || getReqIp(req);
  const indiaTime = getIndiaTime();
  const session = sessionId ? activeSessions.get(sessionId) : null;
  const resolvedTitle = sessionTitle || session?.title || 'My Mobile Location Request';

  const hasValidGps = (
    latitude !== undefined &&
    latitude !== null &&
    !isNaN(Number(latitude)) &&
    longitude !== undefined &&
    longitude !== null &&
    !isNaN(Number(longitude))
  );

  let resolvedLat = hasValidGps ? Number(latitude) : null;
  let resolvedLng = hasValidGps ? Number(longitude) : null;
  let resolvedAccuracy = accuracy ? Number(accuracy) : (hasValidGps ? 5 : null);
  let pName = participantName || `Mobile Device (${ipAddress})`;

  // If GPS is not yet available, perform a real IP lookup instead of using hardcoded fake coordinates
  if (!hasValidGps) {
    const ipGeo = await getIpLocation(ipAddress);
    if (ipGeo) {
      resolvedLat = ipGeo.latitude;
      resolvedLng = ipGeo.longitude;
      resolvedAccuracy = 5000; // Flag as IP approximate accuracy (~5km)
      pName = `${participantName || 'Mobile Device'} (${ipGeo.city || ipGeo.region || ipAddress} - IP Approx)`;
    }
  }

  // Only create database entry and map broadcast if we have valid coordinates (from GPS or IP lookup)
  if (resolvedLat !== null && resolvedLng !== null) {
    const recordData = {
      sessionId: sessionId || 'default-session',
      sessionTitle: resolvedTitle,
      purpose: purpose || resolvedTitle,
      participantId: 'visit-' + Math.random().toString(36).substring(2, 7),
      participantName: pName,
      latitude: resolvedLat,
      longitude: resolvedLng,
      accuracy: resolvedAccuracy,
      speed: 0,
      heading: 0,
      ipAddress,
      indiaTime,
      createdAt: new Date()
    };

    if (isMongoConnected) {
      try {
        const doc = await LocationRecord.create(recordData);
        io.emit('location-updated', {
          sessionId: recordData.sessionId,
          sessionTitle: recordData.sessionTitle,
          participantId: recordData.participantId,
          participantName: recordData.participantName,
          ip: ipAddress,
          indiaTime,
          location: {
            latitude: recordData.latitude,
            longitude: recordData.longitude,
            accuracy: recordData.accuracy,
            speed: 0,
            heading: 0
          }
        });
        return res.status(201).json({ success: true, database: 'MongoDB', id: doc._id, ip: ipAddress, indiaTime, data: doc });
      } catch (err) {
        console.error('Error saving visit to MongoDB:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
    } else {
      fallbackMemoryRecords.unshift(recordData);
      if (fallbackMemoryRecords.length > 500) fallbackMemoryRecords.pop();
      io.emit('location-updated', {
        sessionId: recordData.sessionId,
        sessionTitle: recordData.sessionTitle,
        participantId: recordData.participantId,
        participantName: recordData.participantName,
        ip: ipAddress,
        indiaTime,
        location: {
          latitude: recordData.latitude,
          longitude: recordData.longitude,
          accuracy: recordData.accuracy,
          speed: 0,
          heading: 0
        }
      });
      return res.status(201).json({ success: true, database: 'Memory', ip: ipAddress, indiaTime, data: recordData });
    }
  }

  // Visit acknowledged without inserting fake coordinates
  return res.status(200).json({
    success: true,
    ip: ipAddress,
    indiaTime,
    message: 'Visit registered. Awaiting GPS permission for accurate coordinates.'
  });
});

// API Endpoint: Query location history
app.get('/api/records', async (req, res) => {
  const sessionId = req.query.sessionId;

  if (isMongoConnected) {
    try {
      const filter = sessionId ? { sessionId } : {};
      const docs = await LocationRecord.find(filter).sort({ createdAt: -1 }).limit(100);
      return res.json({ success: true, count: docs.length, database: 'MongoDB', data: docs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    let data = fallbackMemoryRecords;
    if (sessionId) data = data.filter(r => r.sessionId === sessionId);
    return res.json({ success: true, count: data.length, database: 'Memory (MongoDB Pending)', data });
  }
});

// API Endpoint: Save location record via REST POST
app.post('/api/records', async (req, res) => {
  const { sessionId, participantName, latitude, longitude, accuracy, speed, heading, sessionTitle, purpose } = req.body;
  const clientIp = req.body.clientIp || getReqIp(req);
  const indiaTime = getIndiaTime();
  const session = sessionId ? activeSessions.get(sessionId) : null;
  const resolvedTitle = sessionTitle || session?.title || 'My Mobile Location Request';

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'Latitude and Longitude are required' });
  }

  const recordData = {
    sessionId: sessionId || 'default-session',
    sessionTitle: resolvedTitle,
    purpose: purpose || resolvedTitle,
    participantId: 'http-recipient',
    participantName: participantName || 'Mobile Recipient',
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: accuracy ? Number(accuracy) : null,
    speed: speed ? Number(speed) : null,
    heading: heading ? Number(heading) : null,
    ipAddress: clientIp,
    indiaTime,
    createdAt: new Date()
  };

  if (isMongoConnected) {
    try {
      const doc = await LocationRecord.create(recordData);
      io.emit('location-updated', {
        sessionId: recordData.sessionId,
        sessionTitle: recordData.sessionTitle,
        participantId: 'http-recipient',
        participantName: recordData.participantName,
        ip: clientIp,
        indiaTime,
        location: {
          latitude: recordData.latitude,
          longitude: recordData.longitude,
          accuracy: recordData.accuracy,
          speed: recordData.speed,
          heading: recordData.heading
        }
      });
      return res.status(201).json({ success: true, database: 'MongoDB', id: doc._id, indiaTime, data: doc });
    } catch (err) {
      console.error('Error saving to MongoDB:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    fallbackMemoryRecords.unshift(recordData);
    if (fallbackMemoryRecords.length > 500) fallbackMemoryRecords.pop();
    io.emit('location-updated', {
      sessionId: recordData.sessionId,
      sessionTitle: recordData.sessionTitle,
      participantId: 'http-recipient',
      participantName: recordData.participantName,
      ip: clientIp,
      indiaTime,
      location: {
        latitude: recordData.latitude,
        longitude: recordData.longitude,
        accuracy: recordData.accuracy,
        speed: recordData.speed,
        heading: recordData.heading
      }
    });
    return res.status(201).json({ success: true, database: 'Memory', data: recordData });
  }
});

// API Endpoint: Query all generated link sessions from MongoDB
app.get('/api/sessions', async (req, res) => {
  if (isMongoConnected) {
    try {
      const sessions = await Session.find().sort({ createdAt: -1 });
      const recordCounts = await LocationRecord.aggregate([
        { $group: { _id: '$sessionId', count: { $sum: 1 } } }
      ]);
      const countMap = new Map(recordCounts.map(r => [r._id, r.count]));

      const enriched = sessions.map(s => ({
        ...s.toObject(),
        recordCount: countMap.get(s.sessionId) || 0
      }));

      return res.json({ success: true, count: enriched.length, database: 'MongoDB', data: enriched });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    return res.json({ success: true, count: fallbackMemorySessions.length, database: 'Memory', data: fallbackMemorySessions });
  }
});

// API Endpoint: Query specific session metadata & its location records
app.get('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (isMongoConnected) {
    try {
      const sessionDoc = await Session.findOne({ sessionId });
      const records = await LocationRecord.find({ sessionId }).sort({ createdAt: -1 });
      return res.json({
        success: true,
        session: sessionDoc,
        recordCount: records.length,
        records
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    const sessionDoc = fallbackMemorySessions.find(s => s.sessionId === sessionId);
    const records = fallbackMemoryRecords.filter(r => r.sessionId === sessionId);
    return res.json({
      success: true,
      session: sessionDoc || null,
      recordCount: records.length,
      records
    });
  }
});

// API Endpoint: Create session via REST POST
app.post('/api/sessions', async (req, res) => {
  const { title, durationMinutes, origin, backendUrl, meetupLat, meetupLng } = req.body;
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const hostIp = getReqIp(req);
  const clientOrigin = origin || FRONTEND_URL || `http://${localIp}:3000`;
  const backendApi = backendUrl || `http://${localIp}:${PORT}`;
  const duration = parseInt(durationMinutes || 60, 10);
  const hostUrl = `${clientOrigin}/?session=${sessionId}&title=${encodeURIComponent(title || 'My Mobile Location Request')}&api=${encodeURIComponent(backendApi)}`;
  const localUrl = `http://localhost:3000/?session=${sessionId}&title=${encodeURIComponent(title || 'My Mobile Location Request')}&api=${encodeURIComponent(`http://localhost:${PORT}`)}`;
  const indiaTime = getIndiaTime();
  const expireTime = new Date(Date.now() + duration * 60 * 1000);

  const sessionData = {
    sessionId,
    title: title || 'My Mobile Location Request',
    purpose: title || 'General',
    durationMinutes: duration,
    shareUrl: hostUrl,
    localUrl,
    meetupLat: meetupLat ? Number(meetupLat) : null,
    meetupLng: meetupLng ? Number(meetupLng) : null,
    hostIp,
    indiaTime,
    createdAt: new Date(),
    expireTime
  };

  if (isMongoConnected) {
    try {
      const doc = await Session.create(sessionData);
      return res.status(201).json({ success: true, database: 'MongoDB', sessionId, shareUrl: hostUrl, data: doc });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    fallbackMemorySessions.unshift(sessionData);
    return res.status(201).json({ success: true, database: 'Memory', sessionId, shareUrl: hostUrl, data: sessionData });
  }
});

// API Endpoint: Export CSV as a separate file per session or all sessions
app.get('/api/records/export', async (req, res) => {
  const targetSessionId = req.query.sessionId;
  let rows = [];

  if (isMongoConnected) {
    try {
      const filter = targetSessionId ? { sessionId: targetSessionId } : {};
      rows = await LocationRecord.find(filter).sort({ createdAt: -1 });
    } catch (err) {
      return res.status(500).send('Error querying MongoDB for export');
    }
  } else {
    rows = targetSessionId
      ? fallbackMemoryRecords.filter(r => r.sessionId === targetSessionId)
      : fallbackMemoryRecords;
  }

  let csv = 'ID,Session ID,Session Title,Participant Name,IP Address,Latitude,Longitude,Accuracy (m),Speed (m/s),India Time (IST),Created At UTC\n';
  rows.forEach(r => {
    csv += `${r._id || r.id || ''},"${r.sessionId}","${r.sessionTitle || ''}","${r.participantName}","${r.ipAddress}",${r.latitude},${r.longitude},${r.accuracy || 0},${r.speed || 0},"${r.indiaTime || getIndiaTime(r.createdAt)}","${r.createdAt}"\n`;
  });

  const filename = targetSessionId ? `session_${targetSessionId}_location_records.csv` : `mongodb_all_sessions_records.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});

// Real-time Session Engine
const activeSessions = new Map();

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`[Socket Connected] ID: ${socket.id} | IP: ${clientIp}`);

  socket.on('create-session', async (sessionData, callback) => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const duration = parseInt(sessionData.durationMinutes || 60, 10);
    const expireTime = new Date(Date.now() + duration * 60 * 1000);
    const indiaTime = getIndiaTime();

    const clientOrigin = sessionData.origin || FRONTEND_URL || `http://${localIp}:3000`;
    const backendApi = sessionData.backendUrl || (sessionData.origin ? `${sessionData.origin.replace(':3000', ':5000')}` : `http://${localIp}:${PORT}`);
    const hostUrl = `${clientOrigin}/?session=${sessionId}&title=${encodeURIComponent(sessionData.title || 'My Mobile Location Request')}&api=${encodeURIComponent(backendApi)}`;
    const localUrl = `http://localhost:3000/?session=${sessionId}&title=${encodeURIComponent(sessionData.title || 'My Mobile Location Request')}&api=${encodeURIComponent(`http://localhost:${PORT}`)}`;

    const sessionInfo = {
      id: sessionId,
      sessionId,
      hostSocketId: socket.id,
      title: sessionData.title || 'My Mobile Location Request',
      purpose: sessionData.title || 'General',
      durationMinutes: duration,
      shareUrl: hostUrl,
      localUrl,
      meetupLat: sessionData.meetupLat ? Number(sessionData.meetupLat) : null,
      meetupLng: sessionData.meetupLng ? Number(sessionData.meetupLng) : null,
      hostIp: clientIp,
      indiaTime,
      createdTime: Date.now(),
      createdAt: new Date(),
      expireTime,
      participants: new Map()
    };

    activeSessions.set(sessionId, sessionInfo);
    socket.join(sessionId);

    // Save session to MongoDB as a permanent Session file/record
    if (isMongoConnected) {
      try {
        await Session.create({
          sessionId,
          title: sessionInfo.title,
          purpose: sessionInfo.purpose,
          durationMinutes: duration,
          shareUrl: hostUrl,
          localUrl,
          meetupLat: sessionInfo.meetupLat,
          meetupLng: sessionInfo.meetupLng,
          hostIp: clientIp,
          indiaTime,
          createdAt: new Date(),
          expireTime
        });
        console.log(`📁 [MongoDB Session Created] Session ID: ${sessionId} | Title: "${sessionInfo.title}"`);
      } catch (err) {
        console.error('Error saving session to MongoDB:', err.message);
      }
    } else {
      fallbackMemorySessions.unshift({ ...sessionInfo, participants: undefined });
      if (fallbackMemorySessions.length > 200) fallbackMemorySessions.pop();
    }

    if (callback) {
      callback({
        success: true,
        sessionId,
        shareUrl: hostUrl,
        localUrl,
        expireTime: sessionInfo.expireTime
      });
    }
  });

  socket.on('join-session', (data, callback) => {
    const { sessionId, participantName } = data;
    const session = activeSessions.get(sessionId);

    if (!session) {
      if (callback) callback({ success: false, error: 'Session not found or expired.' });
      return;
    }

    socket.join(sessionId);
    const participantId = socket.id;
    const pData = {
      id: participantId,
      name: participantName || `Mobile User (${participantId.substring(0, 4)})`,
      ip: clientIp,
      joinedAt: Date.now(),
      lastLocation: null
    };

    session.participants.set(participantId, pData);

    io.to(session.hostSocketId).emit('participant-joined', {
      participant: pData,
      sessionId
    });

    if (callback) {
      callback({
        success: true,
        sessionTitle: session.title,
        expireTime: session.expireTime,
        participantId,
        clientIp
      });
    }
  });

  socket.on('update-location', async (data) => {
    const { sessionId, location } = data;
    const session = activeSessions.get(sessionId);
    const currentIp = getClientIp(socket);

    let participantName = 'Mobile Participant';
    if (session) {
      const pData = session.participants.get(socket.id);
      if (pData) {
        if (data.participantName) pData.name = data.participantName;
        pData.lastLocation = {
          ...location,
          ip: currentIp,
          timestamp: Date.now()
        };
        session.participants.set(socket.id, pData);
        participantName = pData.name;
      }
    }

    const recordPayload = {
      sessionId,
      participantId: socket.id,
      participantName,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || 0,
      speed: location.speed || 0,
      heading: location.heading || 0,
      ipAddress: currentIp,
      createdAt: new Date()
    };

    if (isMongoConnected) {
      try {
        const doc = await LocationRecord.create(recordPayload);
        console.log(`💾 [MongoDB Saved Doc #${doc._id}] IP: ${currentIp} | Lat: ${location.latitude}, Lng: ${location.longitude}`);
      } catch (dbErr) {
        console.error('❌ [MongoDB Insert Error]', dbErr.message);
      }
    } else {
      fallbackMemoryRecords.unshift(recordPayload);
      if (fallbackMemoryRecords.length > 200) fallbackMemoryRecords.pop();
      console.log(`💾 [Memory Logged] IP: ${currentIp} | Lat: ${location.latitude}, Lng: ${location.longitude}`);
    }

    if (session) {
      io.to(session.hostSocketId).emit('location-updated', {
        participantId: socket.id,
        participantName,
        ip: currentIp,
        location: {
          ...location,
          ip: currentIp,
          timestamp: Date.now()
        }
      });
    }
  });

  socket.on('stop-sharing', (data) => {
    const { sessionId } = data;
    const session = activeSessions.get(sessionId);
    if (session) {
      session.participants.delete(socket.id);
      io.to(session.hostSocketId).emit('participant-stopped', {
        participantId: socket.id
      });
    }
  });

  socket.on('disconnect', () => {
    activeSessions.forEach((session, sId) => {
      if (session.hostSocketId === socket.id) {
        io.to(sId).emit('session-closed', { reason: 'Host ended session' });
        activeSessions.delete(sId);
      } else if (session.participants.has(socket.id)) {
        session.participants.delete(socket.id);
        io.to(session.hostSocketId).emit('participant-left', {
          participantId: socket.id
        });
      }
    });
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 LocShare Backend Server Running on Port ${PORT}`);
  console.log(`🌐 Local:        http://localhost:${PORT}`);
  console.log(`📱 Network IP:   http://${localIp}:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🍃 MongoDB:      ${MONGODB_URI.substring(0, 30)}...`);
  console.log(`==================================================\n`);
});
