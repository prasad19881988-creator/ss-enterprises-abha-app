const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// 1. MONGODB PERMANENT DATABASE CONNECTION
// Safe internal cloud database for SS Enterprises
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://ss_public:SS_Abha_2026_Live@cluster0.nbeu6.mongodb.net/ss_enterprises?retryWrites=true&w=majority";


mongoose.connect(mongoURI)
  .then(() => console.log('✅ Permanent Cloud Database Connected!'))
  .catch(err => console.error('❌ Database Connection Error:', err.message));

// 2. MONGOOSE SCHEMA & MODEL (Bina Purane Features Chhede)
const AppStateSchema = new mongoose.Schema({
  key: { type: String, default: "main_state" },
  employees: { type: Array, default: [
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
  ]},
  customers: { type: Array, default: [] }
});

const AppState = mongoose.model('AppState', AppStateSchema);

// Safe Database Sync Helpers
async function getLiveState() {
  let state = await AppState.findOne({ key: "main_state" });
  if (!state) {
    state = new AppState();
    await state.save();
  }
  return state;
}

async function saveLiveState(state) {
  state.markModified('employees');
  state.markModified('customers');
  await state.save();
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

const sessions = new Map();

function safeCb(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

function getISTDate() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function clean(s) {
  return String(s ?? '').trim().slice(0, 500);
}

// 3. ASLI PURANA SOCKET.IO CONNECTIONS (Database Se Connected)
io.on('connection', socket => {

  // Login Handler
  socket.on('login', async (p, cb) => {
    p = p || {};
    const dbState = await getLiveState();
    
    // Owner Admin Login
    if (p.role === 'owner' && p.id === 'SS' && p.password === 'ADMIN@12345') {
      const t = token();
      sessions.set(t, { role: 'owner', id: 'SS', socket: socket.id });
      return safeCb(cb, { ok: true, token: t, state: { employees: dbState.employees, customers: dbState.customers } });
    }
    
    // Employee Staff Login
    if (p.role === 'employee' && p.password === 'SS@12345') {
      const e = dbState.employees.find(x => x.id === p.id);
      if (!e) return safeCb(cb, { ok: false, message: 'Employee ID not found.' });
      
      const t = token();
      sessions.set(t, { role: 'employee', id: e.id, socket: socket.id });
      return safeCb(cb, { ok: true, token: t, employee: e });
    }

    safeCb(cb, { ok: false, message: 'Invalid ID or Password.' });
  });

  // Employee Signup Handler (Naya Staff Ab Hamesha Save Hoga)
  socket.on('signup', async (p, cb) => {
    p = p || {};
    const name = clean(p.name);
    const phone = clean(p.phone);
    const area = clean(p.area);

    if (name.length < 2) {
      return safeCb(cb, { ok: false, message: 'Name is required (at least 2 letters).' });
    }

    const dbState = await getLiveState();

    let maxNum = 101;
    for (const e of dbState.employees) {
      const m = String(e.id || '').match(/^EMP(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    const id = 'EMP' + String(maxNum + 1);

    const newEmployee = {
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
      details: 'Field Executive'
    };

    dbState.employees.push(newEmployee);
    await saveLiveState(dbState);
    io.emit('state', { employees: dbState.employees, customers: dbState.customers });

    safeCb(cb, { ok: true, employee: newEmployee, password: 'SS@12345' });
  });

  // Fetch Current State
  socket.on('getState', async (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'owner') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }
    const dbState = await getLiveState();
    safeCb(cb, { ok: true, state: { employees: dbState.employees, customers: dbState.customers } });
  });

  // Start Work (Online)
  socket.on('startWork', async (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const dbState = await getLiveState();
    const e = dbState.employees.find(x => x.id === s.id);
    if (e) {
      e.status = 'Online';
      e.last = getISTDate();
      await saveLiveState(dbState);
      io.emit('state', { employees: dbState.employees, customers: dbState.customers });
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Realtime GPS Location Update
  socket.on('locationUpdate', async p => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return;

    const dbState = await getLiveState();
    const e = dbState.employees.find(x => x.id === s.id);
    if (e) {
      e.lat = Number(p.lat);
      e.lng = Number(p.lng);
      e.accuracy = Number(p.accuracy || 0);
      e.location = `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
      e.status = 'Online';
      e.last = getISTDate();
      await saveLiveState(dbState);
      io.emit('state', { employees: dbState.employees, customers: dbState.customers });
    }
  });

  // Save Report
  socket.on('saveReport', async (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const dbState = await getLiveState();
    const e = dbState.employees.find(x => x.id === s.id);
    if (e) {
      e.cards = Number(p.cards || 0);
      e.area = clean(p.area);
      e.details = clean(p.details);
      e.last = getISTDate();
      await saveLiveState(dbState);
      io.emit('state', { employees: dbState.employees, customers: dbState.customers });
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Add Customer / ABHA Work Entry
  socket.on('addCustomer', async (p, cb) => {
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

    const dbState = await getLiveState();
    const e = dbState.employees.find(x => x.id === s.id);
    
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

    dbState.customers.unshift(c);
    
    if (e) {
      e.cards = dbState.customers.filter(x => x.employeeId === e.id && x.status === 'Completed').length;
      e.last = c.date;
    }

    await saveLiveState(dbState);
    io.emit('state', { employees: dbState.employees, customers: dbState.customers });
    safeCb(cb, { ok: true, customer: c, employee: e });
  });

  // Delete Customer Record
  socket.on('deleteCustomer', async (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'owner') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const dbState = await getLiveState();
    dbState.customers = dbState.customers.filter(c => c.id !== p.id);

    for (const e of dbState.employees) {
      e.cards = dbState.customers.filter(c => c.employeeId === e.id && c.status === 'Completed').length;
    }

    await saveLiveState(dbState);
    io.emit('state', { employees: dbState.employees, customers: dbState.customers });
    safeCb(cb, { ok: true });
  });

  // Close Work (Offline)
  socket.on('closeWork', async (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') {
      return safeCb(cb, { ok: false, message: 'Unauthorized' });
    }

    const dbState = await getLiveState();
    const e = dbState.employees.find(x => x.id === s.id);
    if (e) {
      e.status = 'Offline';
      e.last = getISTDate();
      await saveLiveState(dbState);
      io.emit('state', { employees: dbState.employees, customers: dbState.customers });
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

// Health Check Endpoint (For UptimeRobot)
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'Running' });
});

// Fallback Route to Serve Frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Port Listen Configuration
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SS Enterprises Portal actively running on port ${PORT}`);
});
