const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware Setup
app.use(express.json());
app.use(express.static(__dirname));

// ---- IN-MEMORY CLOUD SECURITY ARCHITECTURE ----
// Render ke sleep hone par bhi fallback prevent karne ke liye system settings
let appState = {
  employees: [
    {
      id: 'EMP101',
      name: 'Dev Krishna Rai',
      phone: '+91-9876543210',
      status: 'Offline',
      last: '—',
      cards: 0,
      location: 'Not sharing',
      lat: null,
      lng: null,
      accuracy: null,
      area: 'Darbhanga',
      details: 'Field Executive'
    }
  ],
  customers: []
};

// Global Sessions Map
const sessions = new Map();

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function safeCb(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

function getISTDate() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function clean(s) {
  return String(s ?? '').trim().slice(0, 500);
}

// ---- REALTIME SOCKET WORKSPACE CONNECT ----
io.on('connection', socket => {

  // Login Handler (Owner & Employee Logs)
  socket.on('login', (p, cb) => {
    p = p || {};
    
    if (p.role === 'owner' && p.id === 'SS' && p.password === 'ADMIN@12345') {
      const t = token();
      sessions.set(t, { role: 'owner', id: 'SS', socket: socket.id });
      return safeCb(cb, { ok: true, token: t, state: { employees: appState.employees, customers: appState.customers } });
    }
    
    if (p.role === 'employee' && p.password === 'SS@12345') {
      const e = appState.employees.find(x => x.id === p.id);
      if (!e) return safeCb(cb, { ok: false, message: 'Employee ID not found.' });
      
      const t = token();
      sessions.set(t, { role: 'employee', id: e.id, socket: socket.id });
      return safeCb(cb, { ok: true, token: t, employee: e });
    }

    safeCb(cb, { ok: false, message: 'Invalid ID or Password.' });
  });

  // Employee Signup Handler (Naya Staff System)
  socket.on('signup', (p, cb) => {
    p = p || {};
    const name = clean(p.name);
    const phone = clean(p.phone);
    const area = clean(p.area);

    if (name.length < 2) {
      return safeCb(cb, { ok: false, message: 'Name requires 2 letters.' });
    }

    let maxNum = 101;
    for (const e of appState.employees) {
      const m = String(e.id || '').match(/^EMP(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    const id = 'EMP' + String(maxNum + 1);

    const newEmployee = {
      id,
      name,
      phone: phone || '—',
      status: 'Offline',
      last: '—',
      cards: 0,
      location: 'Not sharing',
      lat: null,
      lng: null,
      accuracy: null,
      area: area || '—',
      details: 'Field Executive'
    };

    appState.employees.push(newEmployee);
    io.emit('state', { employees: appState.employees, customers: appState.customers });

    safeCb(cb, { ok: true, employee: newEmployee, password: 'SS@12345' });
  });

  // Start Field Duty Work (Online)
  socket.on('startWork', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return safeCb(cb, { ok: false, message: 'Unauthorized' });

    const e = appState.employees.find(x => x.id === s.id);
    if (e) {
      e.status = 'Online';
      e.last = getISTDate();
      io.emit('state', { employees: appState.employees, customers: appState.customers });
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  // Realtime Live Location Tracker Map Sync
  socket.on('locationUpdate', p => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return;

    const e = appState.employees.find(x => x.id === s.id);
    if (e) {
      e.lat = Number(p.lat);
      e.lng = Number(p.lng);
      e.accuracy = Number(p.accuracy || 0);
      e.location = `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
      e.status = 'Online';
      e.last = getISTDate();
      io.emit('state', { employees: appState.employees, customers: appState.customers });
    }
  });

  // Add ABHA Customer Record Sync
  socket.on('addCustomer', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return safeCb(cb, { ok: false, message: 'Unauthorized' });

    const name = clean(p.name);
    const mobile = clean(p.mobile);
    const abha = clean(p.abha);

    if (!name) return safeCb(cb, { ok: false, message: 'Customer name required.' });

    const e = appState.employees.find(x => x.id === s.id);
    const c = {
      id: 'CUS-' + Date.now().toString(36).toUpperCase(),
      employeeId: e ? e.id : s.id,
      employeeName: e ? e.name : 'Employee',
      name,
      mobile,
      abha,
      date: getISTDate()
    };

    appState.customers.unshift(c);
    if (e) {
      e.cards = appState.customers.filter(x => x.employeeId === e.id).length;
      e.last = c.date;
    }

    io.emit('state', { employees: appState.employees, customers: appState.customers });
    safeCb(cb, { ok: true, customer: c, employee: e });
  });

  // Delete Customer Record (Owner Only)
  socket.on('deleteCustomer', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'owner') return safeCb(cb, { ok: false, message: 'Unauthorized' });

    appState.customers = appState.customers.filter(c => c.id !== p.id);
    for (const e of appState.employees) {
      e.cards = appState.customers.filter(c => c.employeeId === e.id).length;
    }

    io.emit('state', { employees: appState.employees, customers: appState.customers });
    safeCb(cb, { ok: true });
  });

  // Close Duty Work (Offline)
  socket.on('closeWork', (p, cb) => {
    const s = sessions.get(p?.token);
    if (!s || s.role !== 'employee') return safeCb(cb, { ok: false, message: 'Unauthorized' });

    const e = appState.employees.find(x => x.id === s.id);
    if (e) {
      e.status = 'Offline';
      e.last = getISTDate();
      io.emit('state', { employees: appState.employees, customers: appState.customers });
      return safeCb(cb, { ok: true, employee: e });
    }
    safeCb(cb, { ok: false, message: 'Employee not found.' });
  });

  socket.on('logout', p => { sessions.delete(p?.token); });
  socket.on('disconnect', () => {
    for (const [t, s] of sessions) { if (s.socket === socket.id) sessions.delete(t); }
  });
});

// Health Status Verification (For Cron-job keeping server awake)
app.get('/health', (req, res) => { res.json({ ok: true }); });

// Default Route Serve Frontend Dashboard
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 SS Enterprises Live Gateway Active on port ${PORT}`));
