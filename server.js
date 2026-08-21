const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(__dirname, {
  etag: false,
  maxAge: 0
}));

// DATA STORAGE
// On Render, set DATA_DIR=/var/data and attach a persistent disk at /var/data.
// Locally it uses ./storage.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'storage');
const DB_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(__dirname, 'data.json');

const defaultDbState = {
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

let dbState = JSON.parse(JSON.stringify(defaultDbState));

function normalizeDatabase(data) {
  const safe = data && typeof data === 'object' ? data : {};
  safe.employees = Array.isArray(safe.employees) ? safe.employees : [];
  safe.customers = Array.isArray(safe.customers) ? safe.customers : [];
  return safe;
}

function loadDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbState = normalizeDatabase(JSON.parse(raw));
    } else if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, 'utf8');
      dbState = normalizeDatabase(JSON.parse(raw));
      saveDatabase();
    } else {
      dbState = normalizeDatabase(defaultDbState);
      saveDatabase();
    }
  } catch (err) {
    console.error('DB Load Error:', err.message);
    dbState = normalizeDatabase(defaultDbState);
  }
}

function saveDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('DB Save Error:', err.message);
    return false;
  }
}

loadDatabase();

function getISTDate() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false
  });
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// HEALTH
app.get('/health', (req, res) => {
  res.json({ ok: true, employees: dbState.employees.length, customers: dbState.customers.length });
});

// STAFF REGISTRATION
app.post('/api/signup', (req, res) => {
  try {
    const name = clean(req.body.name);
    const phone = clean(req.body.phone);
    const area = clean(req.body.area);

    if (name.length < 2) {
      return res.json({ ok: false, message: 'Name is required (at least 2 letters).' });
    }

    let maxNum = 100;
    for (const e of dbState.employees) {
      const m = String(e.id || '').match(/^EMP(\d+)$/i);
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

    dbState.employees.push(newEmployee);

    if (!saveDatabase()) {
      dbState.employees = dbState.employees.filter(e => e.id !== id);
      return res.status(500).json({ ok: false, message: 'Registration save nahi ho saki.' });
    }

    return res.json({
      ok: true,
      employee: newEmployee,
      password: 'SS@12345'
    });
  } catch (err) {
    console.error('Signup Error:', err);
    return res.status(500).json({ ok: false, message: 'Registration server error.' });
  }
});

// LOGIN
app.post('/api/login', (req, res) => {
  try {
    const role = clean(req.body.role);
    const id = clean(req.body.id);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (role === 'owner') {
      if ((id.toUpperCase() === 'SS' || id.toUpperCase() === 'ADMIN') && password === 'ADMIN@12345') {
        return res.json({
          ok: true,
          role: 'owner',
          state: dbState
        });
      }
    } else {
      const e = dbState.employees.find(x => String(x.id).toUpperCase() === id.toUpperCase());
      if (e && password === 'SS@12345') {
        return res.json({
          ok: true,
          role: 'employee',
          employee: e
        });
      }
    }

    return res.json({ ok: false, message: 'Invalid ID or Password.' });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ ok: false, message: 'Login server error.' });
  }
});

// CURRENT STATE
app.get('/api/state', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json(dbState);
});

// WORK STATUS
app.post('/api/work-status', (req, res) => {
  const id = clean(req.body.id);
  const status = req.body.status === 'Online' ? 'Online' : 'Offline';
  const e = dbState.employees.find(x => x.id === id);

  if (!e) return res.json({ ok: false, message: 'Employee not found.' });

  e.status = status;
  e.last = getISTDate();

  if (!saveDatabase()) {
    return res.status(500).json({ ok: false, message: 'Work status save nahi hua.' });
  }

  return res.json({ ok: true, employee: e });
});

// GPS LOCATION
app.post('/api/location-sync', (req, res) => {
  const id = clean(req.body.id);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracy = Number(req.body.accuracy || 0);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ ok: false, message: 'Invalid GPS coordinates.' });
  }

  const e = dbState.employees.find(x => x.id === id);
  if (!e) return res.json({ ok: false, message: 'Employee not found.' });

  e.lat = lat;
  e.lng = lng;
  e.accuracy = Number.isFinite(accuracy) ? accuracy : 0;
  e.location = `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
  e.status = 'Online';
  e.last = getISTDate();

  if (!saveDatabase()) {
    return res.status(500).json({ ok: false, message: 'Location save nahi hui.' });
  }

  return res.json({ ok: true });
});

// ADD CUSTOMER
app.post('/api/add-customer', (req, res) => {
  const empId = clean(req.body.empId);
  const name = clean(req.body.name);
  const mobile = clean(req.body.mobile);
  const abha = clean(req.body.abha);

  if (!name) return res.json({ ok: false, message: 'Customer name is required.' });

  const e = dbState.employees.find(x => x.id === empId);

  const c = {
    id: 'CUS-' + Date.now().toString(36).toUpperCase(),
    employeeId: e ? e.id : (empId || 'SYSTEM'),
    employeeName: e ? e.name : 'Field Staff',
    name,
    mobile: mobile || '—',
    abha: abha || '—',
    date: getISTDate()
  };

  dbState.customers.unshift(c);

  if (e) {
    e.cards = dbState.customers.filter(x => x.employeeId === e.id).length;
    e.last = c.date;
  }

  if (!saveDatabase()) {
    dbState.customers.shift();
    if (e) e.cards = dbState.customers.filter(x => x.employeeId === e.id).length;
    return res.status(500).json({ ok: false, message: 'Customer entry save nahi hui.' });
  }

  return res.json({ ok: true, customer: c });
});

// DELETE CUSTOMER
app.post('/api/delete-customer', (req, res) => {
  const id = clean(req.body.id);
  const before = dbState.customers.length;

  dbState.customers = dbState.customers.filter(c => c.id !== id);

  if (dbState.customers.length === before) {
    return res.json({ ok: false, message: 'Customer entry not found.' });
  }

  for (const e of dbState.employees) {
    e.cards = dbState.customers.filter(x => x.employeeId === e.id).length;
  }

  if (!saveDatabase()) {
    return res.status(500).json({ ok: false, message: 'Delete save nahi hua.' });
  }

  return res.json({ ok: true });
});

// FRONTEND FALLBACK
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = Number(process.env.PORT) || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SS Enterprises gateway running on port ${PORT}`);
  console.log(`📁 Database file: ${DB_FILE}`);
});
