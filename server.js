<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔱 SS ENTERPRISES — Royal Work Dashboard</title>
  <link rel="stylesheet" href="https://unpkg.com" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
    body { background: #080a10; color: #f3f4f6; min-height: 100vh; padding-bottom: 80px; }
    header { background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border-bottom: 2px solid #d97706; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 4px 25px rgba(217, 119, 6, 0.15); }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-title { font-weight: 900; font-size: 1.25rem; background: linear-gradient(135deg, #fbbf24, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.8px; }
    .brand-subtitle { font-size: 0.68rem; color: #9ca3af; font-weight: 500; letter-spacing: 0.5px; }
    .user-badge { font-size: 0.8rem; font-weight: 700; background: #1e1b4b; padding: 6px 14px; border-radius: 20px; color: #fbbf24; border: 1px solid #d97706; }
    .container { max-width: 1050px; margin: 20px auto; padding: 0 15px; }
    .card { background: linear-gradient(145deg, #0f172a, #1e1b4b); border: 1px solid rgba(217, 119, 6, 0.3); border-radius: 20px; padding: 22px; margin-bottom: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; }
    .card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #f59e0b, #d97706, #7c2d12); }
    .card-title { font-size: 1.15rem; font-weight: 800; color: #fbbf24; margin-bottom: 18px; border-bottom: 1px solid rgba(217, 119, 6, 0.2); padding-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 22px; }
    .stat-box { background: rgba(15, 23, 42, 0.8); border: 1px solid #d97706; border-radius: 16px; padding: 18px; text-align: center; }
    .stat-number { font-size: 2rem; font-weight: 900; color: #fbbf24; }
    .stat-label { font-size: 0.78rem; color: #cbd5e1; text-transform: uppercase; font-weight: 700; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 0.85rem; font-weight: 700; color: #fbbf24; margin-bottom: 6px; }
    input, select { width: 100%; background: #0f172a; border: 1px solid #374151; border-radius: 12px; padding: 13px 15px; color: #ffffff; outline: none; }
    .btn { width: 100%; padding: 15px; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .btn-gold { background: linear-gradient(135deg, #f59e0b, #b45309); color: #000000; font-weight: 900; }
    .btn-primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; }
    .btn-success { background: linear-gradient(135deg, #10b981, #047857); color: #ffffff; }
    .btn-danger { background: linear-gradient(135deg, #ef4444, #b91c1c); color: #ffffff; }
    #map { height: 380px; width: 100%; border-radius: 14px; border: 1px solid #d97706; margin-top: 10px; background: #0f172a; }
    .table-responsive { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem; }
    th { background: #1e1b4b; color: #fbbf24; padding: 12px; border-bottom: 2px solid #d97706; }
    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .badge-online { background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 12px; border-radius: 20px; border: 1px solid #10b981; font-size: 0.75rem; }
    .badge-offline { background: rgba(100, 116, 139, 0.2); color: #94a3b8; padding: 4px 12px; border-radius: 20px; border: 1px solid #64748b; font-size: 0.75rem; }
    .auth-tabs { display: flex; gap: 10px; margin-bottom: 22px; background: #0f172a; padding: 6px; border-radius: 14px; }
    .tab-btn { flex: 1; padding: 12px; border: none; background: transparent; color: #9ca3af; border-radius: 10px; cursor: pointer; font-weight: 800; }
    .tab-btn.active { background: linear-gradient(135deg, #f59e0b, #d97706); color: #000000; }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <span class="trishul-logo"><img src="logo.png" alt="🔱" style="height:30px; vertical-align:middle;"></span>
      <div>
        <div class="brand-title">SS ENTERPRISES</div>
        <div class="brand-subtitle">AAPKI SEVA ME HAMARI KHUSHI</div>
      </div>
    </div>
    <div id="userStatus" class="user-badge" style="display: none;">Offline</div>
  </header>

  <div class="container">

    <!-- AUTH SECTION -->
    <div id="authSection" class="card" style="max-width: 480px; margin: 30px auto;">
      <div class="auth-tabs">
        <button id="loginTab" class="tab-btn active" onclick="switchAuthTab('login')">Login Portal</button>
        <button id="signupTab" class="tab-btn" onclick="switchAuthTab('signup')">Staff Registration</button>
      </div>

      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label>Select Role</label>
          <select id="loginRole">
            <option value="employee">Field Staff / Employee</option>
            <option value="owner">Owner / Admin Control</option>
          </select>
        </div>
        <div class="form-group">
          <label>Employee ID / Admin Username</label>
          <input type="text" id="loginId" placeholder="e.g., EMP101 or SS" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="loginPassword" placeholder="Enter password" required>
        </div>
        <button type="submit" class="btn btn-gold">🚀 Login To Dashboard</button>
      </form>

      <form id="signupForm" onsubmit="handleSignup(event)" style="display: none;">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="signupName" placeholder="Enter Full Name" required>
        </div>
        <div class="form-group">
          <label>Mobile Number</label>
          <input type="text" id="signupMobile" placeholder="10 Digits Mobile Number" required>
        </div>
        <div class="form-group">
          <label>Assigned Area</label>
          <input type="text" id="signupArea" placeholder="e.g., Darbhanga" required>
        </div>
        <button type="submit" class="btn btn-primary">📝 Register Staff Account</button>
      </form>
    </div>

    <!-- STAFF TRACKING WORKSPACE -->
    <div id="staffWorkspace" class="card" style="display: none;">
      <div class="card-title">👋 Field Work Controls (<span id="staffNameLabel"></span>)</div>
      <p style="margin-bottom: 15px; color: #9ca3af;">Apna kaam shuru karne ke liye niche diye gaye button par click karein.</p>
      <button id="workBtn" class="btn btn-success" onclick="toggleFieldWork()">▶ Start Field Work</button>
    </div>

    <!-- ADMIN PANEL DASHBOARD -->
    <div id="adminPanel" style="display: none;">
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Total Field Staff</div>
          <div id="totalStaffCount" class="stat-number">0</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Active On Duty</div>
          <div id="activeStaffCount" class="stat-number">0</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🗺 Real-Time Employee Field Live Tracking Map</div>
        <div id="map"></div>
      </div>

      <div class="card">
        <div class="card-title">👥 Active Field Staff Control</div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Employee ID</th>
                <th>Mobile</th>
                <th>Area Location</th>
                <th>GPS Status</th>
                <th>Last Sync</th>
              </tr>
            </thead>
            <tbody id="staffTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

  </div>

  <script src="https://unpkg.com"></script>
  <script>
    let myEmpId = null;
    let locationIntervalId = null;
    let trackingMap = null;
    let mapMarkers = {};

    function switchAuthTab(tab) {
      if(tab === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('signupTab').classList.remove('active');
      } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
        document.getElementById('loginTab').classList.remove('active');
        document.getElementById('signupTab').classList.add('active');
      }
    }

    // RELIABLE SIGNUP SYSTEM
    function handleSignup(event) {
      event.preventDefault();
      const payload = {
        name: document.getElementById('signupName').value,
        phone: document.getElementById('signupMobile').value,
        area: document.getElementById('signupArea').value
      };

      fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if(data.ok) {
          alert(`🎉 Naya Staff Register Ho Gaya!\n\nID: ${data.employee.id}\nPassword: ${data.password}\n\nIse Note Kar Ke Staff Ko De Dein.`);
          document.getElementById('signupForm').reset();
          switchAuthTab('login');
        } else {
