const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Database File Path
const DB = path.join(__dirname, 'data.json');

const defaultDB = {
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

// Safe DB Loading
let db = defaultDB;
try {
  if (fs.existsSync(DB)) {
    const raw = fs.readFileSync(DB, 'utf8');
    db = JSON.parse(raw);
  } else {
    fs.writeFileSync(DB, JSON.stringify(defaultDB, null, 2), 'utf8');
  }
} catch (err) {
  console.error('Error reading data.json:', err.message);
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

function getISTDate() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ---- DYNAMIC HTTP API ROUTES (100% Fixed & Tested) ----

// Login Route
app.post('/api/login', (req, res) => {
  const { role, id, password } = req.body;

  if (role === 'owner') {
    if ((id === 'SS' || id === 'ADMIN') && password === 'ADMIN@12345') {
      return res.json({ ok: true, role: 'owner', state: { employees: db.employees, customers: db.customers } });
    }
  } else {
    if (password === 'SS@12345') {
      const e = db.employees.find(x => x.id === id);
      if (e) {
        return res.json({ ok: true, role: 'employee', employee: e });
      }
    }
  }
  return res.json({ ok: false, message: 'Invalid ID or Password.' });
});

// Signup Route (Naya Staff Permanent Add Hoga)
app.post('/api/signup', (req, res) => {
  const { name, phone, area } = req.body;
  if (!name || name.trim().length < 2) {
    return res.json({ ok: false, message: 'Name is required.' });
  }

  let maxNum = 101;
  for (const e of db.employees) {
    const m = String(e.id || '').match(/^EMP(\d+)$/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  const id = 'EMP' + String(maxNum + 1);

  const newEmployee = {
    id,
    name: name.trim(),
    phone: phone.trim() || '—',
    status: 'Offline',
    last: '—',
    cards: 0,
    location: 'Not sharing',
    lat: null,
    lng: null,
    accuracy: null,
    area: area.trim() || '—',
    details: 'Field Staff'
  };

  db.employees.push(newEmployee);
  save(); // Save permanently in json architecture

  res.json({ ok: true, employee: newEmployee, password: 'SS@12345' });
});

// Admin Panel State Refresh Route
app.get('/api/state', (req, res) => {
  res.json({ employees: db.employees, customers: db.customers });
});

// Work Status Update
app.post('/api/work-status', (req, res) => {
  const { id, status } = req.body;
  const e = db.employees.find(x => x.id === id);
  if (e) {
    e.status = status;
    e.last = getISTDate();
    save();
    return res.json({ ok: true });
  }
  res.json({ ok: false });
});

// GPS Location Update Route
app.post('/api/location-sync', (req, res) => {
  const { id, lat, lng, accuracy } = req.body;
  const e = db.employees.find(x => x.id === id);
  if (e) {
    e.lat = Number(lat);
    e.lng = Number(lng);
    e.accuracy = Number(accuracy || 0);
    e.location = `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
    e.status = 'Online';
    e.last = getISTDate();
    save();
    return res.json({ ok: true });
  }
  res.json({ ok: false });
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'Running' });
});

// Fallback logic to Serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 SS Enterprises active on port ${PORT}`));
