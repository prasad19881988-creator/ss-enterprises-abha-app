const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Database File Path
const DB = path.join(__dirname, 'data.json');

const defaultDB = {
  employees: [
    {
      id: 'EMP101',
      name: 'Dev Krishna Rai',
      phone: '',
      status: 'Offline',
      last: '—',
      cards: 0,
      location: 'Not sharing',
      lat: null,
      lng: null,
      accuracy: null,
      area: '',
      details: ''
    }
  ],
  customers: []
};

// Safe DB Loading
let db = defaultDB;
try {
  if (fs.existsSync(DB)) {
    const raw = fs.readFileSync(DB, 'utf8');
    db = JSON.parse(raw);
  }
} catch (err) {
  console.error('Error reading data.json, falling back to default:', err.message);
  db = defaultDB;
}

db.employees = db.employees || [];
db.customers = db.customers || [];

function save() {
  try {
    fs.writeFileSync(DB, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data.json:', err.message);
  }
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

const sessions = new Map();

function safeCb(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

function employeeById(id) {
  return db.employees.find(e => e.id === id);
}

function publicState() {
  return {
    employees: db.employees,
    customers: db.customers
  };
}

function broadcast() {
  io.emit('state', publicState());
}

function getISTDate() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function nextEmployeeId() {
  let maxNum = 101;
  for (const e of db.employees) {
    const m = String(e.id || '').match(/^EMP(\d+)$/);
    if (m) {
      maxNum = Math.max(maxNum, Number(m[1]));
    }
  }
  return 'EMP' + String(maxNum + 1);
}

function clean(s) {
  return String(s ?? '').trim().slice(0, 500);
}

// Socket.io Connection Events
io.on('connection', socket => {

  // Login Handler
  socket.on('login', (p, cb) => {
    p = p || {};
    
    // Owner Login
    if (p.role === 'owner' && p.id === 'SS' && p.password === 'ADMIN@12345') {
      const t = token();
      sessions.set(t, { role: 'owner', id: 'SS', socket: socket.id });
      return safeCb(cb, { ok: true, token: t, state: publicState() });
    }
    
    // Employee Login
    if (p.role === 'employee' && p.password === 'SS@12345') {
      const e = employeeById(p.id);
      if (!e) return safeCb(cb, { ok: false, message: 'Employee ID not found.' });
      
      const t = token();
      sessions.set(t, { role: 'employee', id: e.id, socket: socket.id });
      return safeCb(cb, { ok: true, token: t, employee: e });
    }

    safeCb(cb, { ok: false, message: 'Invalid ID or Password.' });
  });

  // Employee Signup Handler
  socket.on('signup', (p, cb) => {
    p = p || {};
    const name = clean(p.name);
    const phone = clean(p.phone);
    const area = clean(p.area);

    if (name.length < 2) {
      return safeCb(cb, { ok: false, message: 'Name is required (at least 2 letters).' });
    }

    const id = nextEmployeeId();
    const e = {
      id,
      name,
      phone,
      status: 'Offline',
      last: '—',
      cards: 0,
      location: 'Not sharing',
      lat: null,
      lng: null,
      accuracy: null,
      area,
      details: ''
    };

    db.employees.push(e);
    save();
    broadcast();

    safeCb(cb, { ok: true, employee: e, password: 'SS@12345' });
  });

  // Fetch Current State
  socket.on('getState', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'owner') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }
    safeCb(cb, { ok: true, state: publicState() });
  });

  // Start Work (Online)
  socket.on('startWork', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const e = employeeById(s.id);
    if (e) {
      e.status = 'Online';
      e.last = getISTDate();
      save();
      broadcast();
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Realtime GPS Location Update
  socket.on('locationUpdate', p => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return;

    const e = employeeById(s.id);
    if (e) {
      e.lat = Number(p.lat);
      e.lng = Number(p.lng);
      e.accuracy = Number(p.accuracy || 0);
      e.location = `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
      e.status = 'Online';
      e.last = getISTDate();
      save();
      broadcast();
    }
  });

  // Save Report
  socket.on('saveReport', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const e = employeeById(s.id);
    if (e) {
      e.cards = Number(p.cards || 0);
      e.area = clean(p.area);
      e.details = clean(p.details);
      e.last = getISTDate();
      save();
      broadcast();
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Add Customer / ABHA Work Entry
  socket.on('addCustomer', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const name = clean(p.name);
    const mobile = clean(p.mobile);
    const abha = clean(p.abha);
    const area = clean(p.area);
    const status = clean(p.status) || 'Completed';
    const remarks = clean(p.remarks);

    if (!name) {
      return safeCb(cb, { ok: false, message: 'Customer name is required.' });
    }

    const e = employeeById(s.id);
    const c = {
      id: 'CUS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(),
      employeeId: e ? e.id : s.id,
      employeeName: e ? e.name : 'Employee',
      name,
      mobile,
      abha,
      area,
      status,
      remarks,
      date: getISTDate()
    };

    db.customers.unshift(c);
    
    if (e) {
      e.cards = db.customers.filter(x => x.employeeId === e.id && x.status === 'Completed').length;
      e.last = c.date;
    }

    save();
    broadcast();
    safeCb(cb, { ok: true, customer: c, employee: e });
  });

  // Delete Customer Record (Owner Only)
  socket.on('deleteCustomer', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'owner') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    db.customers = db.customers.filter(c => c.id !== p.id);

    for (const e of db.employees) {
      e.cards = db.customers.filter(c => c.employeeId === e.id && c.status === 'Completed').length;
    }

    save();
    broadcast();
    safeCb(cb, { ok: true });
  });

  // Close Work (Offline)
  socket.on('closeWork', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const e = employeeById(s.id);
    if (e) {
      e.status = 'Offline';
      e.last = getISTDate();
      save();
      broadcast();
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Logout
  socket.on('logout', p => {
    sessions.delete(p?.token);
  });

  // Disconnect Cleanup
  socket.on('disconnect', () => {
    for (const [t, s] of sessions) {
      if (s.socket === socket.id) {
        sessions.delete(t);
      }
    }
  });
});

// Health Check Endpoint (For UptimeRobot / Render Ping)
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'SS ENTERPRISES ABHA REALTIME PORTAL', status: 'Running' });
});

// Fallback Route to Serve Frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 SS ENTERPRISES Realtime Portal running on port: ' + PORT);
});
