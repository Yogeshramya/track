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

// MongoDB Schema
const LocationRecordSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
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

// API Endpoint: Instant Visit & IP Capture when link is opened
app.post('/api/track-visit', async (req, res) => {
  const { sessionId, participantName, latitude, longitude, accuracy } = req.body;
  const ipAddress = req.body.clientIp || getReqIp(req);
  const indiaTime = getIndiaTime();

  const recordData = {
    sessionId: sessionId || 'default-session',
    participantId: 'visit-' + Math.random().toString(36).substring(2, 7),
    participantName: participantName || `Mobile Device (${ipAddress})`,
    latitude: Number(latitude || 10.9602),
    longitude: Number(longitude || 79.3845),
    accuracy: accuracy ? Number(accuracy) : 50,
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
  const { sessionId, participantName, latitude, longitude, accuracy, speed, heading } = req.body;
  const clientIp = req.body.clientIp || getReqIp(req);
  const indiaTime = getIndiaTime();

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'Latitude and Longitude are required' });
  }

  const recordData = {
    sessionId: sessionId || 'default-session',
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

// API Endpoint: Export CSV
app.get('/api/records/export', async (req, res) => {
  let rows = [];

  if (isMongoConnected) {
    try {
      rows = await LocationRecord.find().sort({ createdAt: -1 });
    } catch (err) {
      return res.status(500).send('Error querying MongoDB for export');
    }
  } else {
    rows = fallbackMemoryRecords;
  }

  let csv = 'ID,Session ID,Participant Name,IP Address,Latitude,Longitude,Accuracy (m),Speed (m/s),India Time (IST),Created At UTC\n';
  rows.forEach(r => {
    csv += `${r._id || r.id || ''},"${r.sessionId}","${r.participantName}","${r.ipAddress}",${r.latitude},${r.longitude},${r.accuracy || 0},${r.speed || 0},"${r.indiaTime || getIndiaTime(r.createdAt)}","${r.createdAt}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="mongodb_location_history.csv"');
  res.status(200).send(csv);
});

// Real-time Session Engine
const activeSessions = new Map();

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  console.log(`[Socket Connected] ID: ${socket.id} | IP: ${clientIp}`);

  socket.on('create-session', (sessionData, callback) => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionInfo = {
      id: sessionId,
      hostSocketId: socket.id,
      title: sessionData.title || 'Live Location Session',
      durationMinutes: sessionData.durationMinutes || 60,
      createdTime: Date.now(),
      expireTime: Date.now() + (sessionData.durationMinutes || 60) * 60 * 1000,
      participants: new Map()
    };

    activeSessions.set(sessionId, sessionInfo);
    socket.join(sessionId);

    const clientOrigin = sessionData.origin || FRONTEND_URL || `http://${localIp}:3000`;
    const hostUrl = `${clientOrigin}/?session=${sessionId}`;
    const localUrl = `http://localhost:3000/?session=${sessionId}`;

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
