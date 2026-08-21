const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// LOCAL PERMANENT DATABASE ARCHITECTURE
const DB_FILE = path.join(__dirname, 'data.json');

let dbState = {
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

// Auto backup and storage security
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbState = JSON.parse(raw);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
    }
  } catch (err) {
    console.error("DB Load Error, fallback safe state initialized:", err.message);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  } catch (err) {
    console.error("DB Save Error:", err.message);
  }
}

loadDatabase();

function getISTDate() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ---- HTTP CORE API SYSTEM ----

// Staff Registration Channel
app.post('/api/signup', (req, res) => {
  try {
    const { name, phone, area } = req.body;
    if (!name || name.trim().length < 2) {
      return res.json({ ok: false, message: 'Name is required (at least 2 letters).' });
    }

    let maxNum = 101;
    for (const e of dbState.employees) {
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
      details: 'Field Executive'
    };

    dbState.employees.push(newEmployee);
    saveDatabase();
    return res.json({ ok: true, employee: newEmployee, password: 'SS@12345' });
  } catch (err) {
    return res.json({ ok: false, message: err.message });
  }
});

// Login Portal Channel
app.post('/api/login', (req, res) => {
  const { role, id, password } = req.body;

  if (role === 'owner') {
    if ((id === 'SS' || id === 'ADMIN') && password === 'ADMIN@12345') {
      return res.json({ ok: true, role: 'owner', state: dbState });
    }
  } else {
    if (password === 'SS@12345') {
      const e = dbState.employees.find(x => x.id === id.trim());
      if (e) {
        return res.json({ ok: true, role: 'employee', employee: e });
      }
    }
  }
  return res.json({ ok: false, message: 'Invalid ID or Password.' });
});

// Live Synchronizer State Hook
app.get('/api/state', (req, res) => {
  return res.json(dbState);
});

// Duty Work Toggle Hook
app.post('/api/work-status', (req, res) => {
  const { id, status } = req.body;
  const e = dbState.employees.find(x => x.id === id);
  if (e) {
    e.status = status;
    e.last = getISTDate();
    saveDatabase();
    return res.json({ ok: true });
  }
  return res.json({ ok: false });
});

// Real-Time GPS Tracking Map Engine
app.post('/api/location-sync', (req, res) => {
  const { id, lat, lng, accuracy } = req.body;
  const e = dbState.employees.find(x => x.id === id);
  if (e) {
    e.lat = Number(lat);
    e.lng = Number(lng);
    e.accuracy = Number(accuracy || 0);
    e.location = `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
    e.status = 'Online';
    e.last = getISTDate();
    saveDatabase();
    return res.json({ ok: true });
  }
  return res.json({ ok: false });
});

// ABHA New Customer Work Entry Input
app.post('/api/add-customer', (req, res) => {
  const { empId, name, mobile, abha } = req.body;
  if (!name) return res.json({ ok: false, message: 'Customer name is required.' });

  const e = dbState.employees.find(x => x.id === empId);
  const c = {
    id: 'CUS-' + Date.now().toString(36).toUpperCase(),
    employeeId: e ? e.id : (empId || 'SYSTEM'),
    employeeName: e ? e.name : 'Field Staff',
    name: name.trim(),
    mobile: mobile.trim() || '—',
    abha: abha.trim() || '—',
    date: getISTDate()
  };

  dbState.customers.unshift(c);
  if (e) {
    e.cards = dbState.customers.filter(x => x.employeeId === e.id).length;
    e.last = c.date;
  }
  saveDatabase();
  return res.json({ ok: true });
});

// Delete Customer Database Row Control
app.post('/api/delete-customer', (req, res) => {
  const { id } = req.body;
  dbState.customers = dbState.customers.filter(c => c.id !== id);
  for (const e of dbState.employees) {
    e.cards = dbState.customers.filter(c => c.employeeId === e.id).length;
  }
  saveDatabase();
  return res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 SS Enterprises gateway running on port ${PORT}`));
