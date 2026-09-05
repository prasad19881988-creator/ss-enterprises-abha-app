const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname, { etag: true, maxAge: '1h' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'storage');
const DB_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(__dirname, 'data.json');

const defaultDbState = {
  employees: [{
    id: 'EMP101', name: 'Dev Krishna Rai', phone: '+91-9876543210', status: 'Offline', last: '—',
    cards: 0, location: 'Not sharing', placeName: '', lat: null, lng: null, accuracy: null,
    area: 'Darbhanga', district: 'Darbhanga', details: 'Field Executive'
  }],
  customers: [],
  cardUpdates: [],
  groups: [
    { id: 'DIST-DARBHANGA', name: 'SS ENTERPRISES ABHA TEAM DARBHANGA', district: 'Darbhanga', members: ['EMP101'] },
    { id: 'DIST-MADHUBANI', name: 'SS ENTERPRISES ABHA TEAM MADHUBANI', district: 'Madhubani', members: [] },
    { id: 'DIST-SITAMARHI', name: 'SS ENTERPRISES ABHA TEAM SITAMARHI', district: 'Sitamarhi', members: [] }
  ],
  messages: [],
  districtHeads: [
    { id: 'DH-DARBHANGA', name: 'Darbhanga District Head', district: 'Darbhanga', phone: '—', password: 'HEAD@12345', status: 'Active' },
    { id: 'DH-MADHUBANI', name: 'Madhubani District Head', district: 'Madhubani', phone: '—', password: 'HEAD@12345', status: 'Active' },
    { id: 'DH-SITAMARHI', name: 'Sitamarhi District Head', district: 'Sitamarhi', phone: '—', password: 'HEAD@12345', status: 'Active' }
  ],
  teamLeaders: [],
  locationHistory: [],
  workUpdates: [],
  media: [],
  notifications: [],
  meetings: [],
  auditLog: [],
  schemaVersion: 4
};

let dbState = JSON.parse(JSON.stringify(defaultDbState));
function normalizeDatabase(data) {
  const safe = data && typeof data === 'object' ? data : {};
  safe.employees = Array.isArray(safe.employees) ? safe.employees : [];
  safe.customers = Array.isArray(safe.customers) ? safe.customers : [];
  safe.cardUpdates = Array.isArray(safe.cardUpdates) ? safe.cardUpdates : [];
  safe.groups = Array.isArray(safe.groups) ? safe.groups : JSON.parse(JSON.stringify(defaultDbState.groups));
  safe.messages = Array.isArray(safe.messages) ? safe.messages : [];
  safe.districtHeads = Array.isArray(safe.districtHeads) ? safe.districtHeads : JSON.parse(JSON.stringify(defaultDbState.districtHeads));
  safe.teamLeaders = Array.isArray(safe.teamLeaders) ? safe.teamLeaders : [];
  safe.locationHistory = Array.isArray(safe.locationHistory) ? safe.locationHistory : [];
  safe.workUpdates = Array.isArray(safe.workUpdates) ? safe.workUpdates : [];
  safe.media = Array.isArray(safe.media) ? safe.media : [];
  safe.notifications = Array.isArray(safe.notifications) ? safe.notifications : [];
  safe.meetings = Array.isArray(safe.meetings) ? safe.meetings : [];
  safe.auditLog = Array.isArray(safe.auditLog) ? safe.auditLog : [];
  safe.schemaVersion = Number(safe.schemaVersion || 1);
  safe.employees.forEach(e => { if (typeof e.enabled !== 'boolean') e.enabled = true; if (!Array.isArray(e.locationHistoryIds)) e.locationHistoryIds=[]; if (typeof e.active !== 'boolean') e.active=true; });
  safe.teamLeaders.forEach(t => { t.maxStaff=10; if(!Array.isArray(t.staffIds)) t.staffIds=[]; t.active=t.active!==false; });
  safe.employees.forEach(e => {
    e.district = e.district || e.area || '—';
    e.placeName = e.placeName || '';
    e.cards = Number(e.cards || 0);
  });
  for (const e of safe.employees) { const g = safe.groups.find(x => String(x.district).toLowerCase() === String(e.district).toLowerCase()); if (g && !g.members.includes(e.id)) g.members.push(e.id); }
  return safe;
}
function backupDatabase(reason='snapshot') {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const dir=path.join(DATA_DIR,'backups'); fs.mkdirSync(dir,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const file=path.join(dir,`data-${stamp}-${String(reason).replace(/[^a-z0-9_-]/gi,'_')}.json`);
    fs.writeFileSync(file, JSON.stringify(dbState,null,2),'utf8');
    const files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort();
    while(files.length>50) fs.unlinkSync(path.join(dir,files.shift()));
    return file;
  } catch(err){ console.error('Backup Error:',err.message); return ''; }
}
function audit(action, actor, details={}) {
  dbState.auditLog.push({id:'AUD-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6),action,actor:clean(actor)||'SYSTEM',details,date:getISTDate()});
  if(dbState.auditLog.length>20000) dbState.auditLog=dbState.auditLog.slice(-20000);
}

function saveDatabase(reason='update') {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    if(reason && reason!=='routine') backupDatabase(reason);
    fs.writeFileSync(tmp, JSON.stringify(dbState, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
    return true;
  } catch (err) { console.error('DB Save Error:', err.message); return false; }
}
function loadDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) dbState = normalizeDatabase(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    else if (fs.existsSync(SEED_FILE)) { dbState = normalizeDatabase(JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))); saveDatabase(); }
    else { dbState = normalizeDatabase(defaultDbState); saveDatabase(); }
  } catch (err) { console.error('DB Load Error:', err.message); dbState = normalizeDatabase(defaultDbState); }
}
function migrateDatabase(){
  dbState=normalizeDatabase(dbState);
  for(const d of BIHAR_DISTRICTS) ensureGroup(d);
  for(const e of dbState.employees){
    e.district=normalizeDistrict(e.district||e.area);
    e.area=e.area||e.district;
    const g=ensureGroup(e.district); if(!g.members.includes(e.id)) g.members.push(e.id);
    if(typeof e.active!=='boolean') e.active=true;
  }
  dbState.schemaVersion=4;
  saveDatabase('migration');
}
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function getISTDate() { return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }); }
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); }
const BIHAR_DISTRICTS = ['Araria','Arwal','Aurangabad','Banka','Begusarai','Bhagalpur','Bhojpur','Buxar','Darbhanga','East Champaran','Gaya','Gopalganj','Jamui','Jehanabad','Kaimur (Bhabua)','Katihar','Khagaria','Kishanganj','Lakhisarai','Madhepura','Madhubani','Munger','Muzaffarpur','Nalanda','Nawada','Patna','Purnia','Rohtas','Saharsa','Samastipur','Saran','Sheikhpura','Sheohar','Sitamarhi','Siwan','Supaul','Vaishali','West Champaran'];

// ---------- Secure role sessions ----------
// Mutating and private APIs require a short-lived server session. Passwords are never
// returned in API state responses.
const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
function publicState() {
  const copy = JSON.parse(JSON.stringify(dbState));
  copy.districtHeads = (copy.districtHeads || []).map(({password, ...h}) => h);
  copy.teamLeaders = (copy.teamLeaders || []).map(({password, ...t}) => t);
  return copy;
}
function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...user, issuedAt: Date.now() });
  return token;
}
function getSession(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const s = sessions.get(token);
  if (!s || Date.now() - s.issuedAt > SESSION_TTL_MS) {
    if (token) sessions.delete(token);
    return null;
  }
  return s;
}
const PUBLIC_API = new Set([
'/login','/signup','/district-coordinator-signup','/districts','/team-leaders']);
app.use('/api', (req,res,next) => {
  if (PUBLIC_API.has(req.path)) return next();
  const user = getSession(req);
  if (!user) return res.status(401).json({ok:false,message:'Session expired. Please login again.'});
  req.user = user;
  next();
});
function requireRole(req,res,roles) {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ok:false,message:'Aapke role ko is action ki permission nahi hai.'});
    return false;
  }
  return true;
}
function sameEmployee(req,id) {
  return req.user && req.user.role === 'employee' && req.user.id === id;
}
function canAccessDistrict(req,district) {
  if (!req.user) return false;
  if (req.user.role === 'owner') return true;
  if (req.user.role === 'district_head') return normalizeDistrict(req.user.district) === normalizeDistrict(district);
  if (req.user.role === 'team_leader') return normalizeDistrict(req.user.district) === normalizeDistrict(district);
  return false;
}

function normalizeDistrict(d){ const x=clean(d).toLowerCase(); const aliases={'east champaran (motihari)':'East Champaran','motihari':'East Champaran','kaimur':'Kaimur (Bhabua)','bhabua':'Kaimur (Bhabua)','saran (chapra)':'Saran','west champaran (bettiah)':'West Champaran','bettiah':'West Champaran'}; return aliases[x] || BIHAR_DISTRICTS.find(v=>v.toLowerCase()===x) || clean(d); }

function ensureGroup(district) {
  const name = normalizeDistrict(district) || 'Unassigned';
  let g = dbState.groups.find(x => x.district.toLowerCase() === name.toLowerCase());
  if (!g) { g = { id: 'DIST-' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '-'), name: 'SS ENTERPRISES ABHA TEAM ' + name.toUpperCase(), district: name, members: [] }; dbState.groups.push(g); }
  return g;
}
loadDatabase();
migrateDatabase();

async function reverseGeocode(lat, lng) {
  try {
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (reverseGeocode.cache.has(key)) return reverseGeocode.cache.get(key);
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&zoom=18&addressdetails=1&accept-language=hi,en';
    const r = await fetch(url, { headers: { 'User-Agent': 'SS-Enterprises-Field-App/3.0 (admin@ss-enterprises.local)' } });
    if (!r.ok) return '';
    const j = await r.json();
    const a = j.address || {};
    const parts = [a.road, a.neighbourhood || a.suburb, a.village || a.town || a.city, a.state].filter(Boolean);
    const place = parts.slice(0, 4).join(', ') || j.display_name || '';
    reverseGeocode.cache.set(key, place);
    if (reverseGeocode.cache.size > 100) reverseGeocode.cache.delete(reverseGeocode.cache.keys().next().value);
    return place;
  } catch { return ''; }
}
reverseGeocode.cache = new Map();


app.post('/api/signup', (req,res) => {
  const name=clean(req.body.name), phone=clean(req.body.phone), area=clean(req.body.area), district=normalizeDistrict(req.body.district || area);
  if (name.length<2) return res.json({ok:false,message:'Name is required (at least 2 letters).'});
  let max=100; dbState.employees.forEach(e=>{const m=String(e.id||'').match(/^EMP(\d+)$/i); if(m) max=Math.max(max,Number(m[1]));});
  const id='EMP'+(max+1); const g=ensureGroup(district);
  const e={id,name,phone:phone||'—',status:'Offline',active:true,last:'—',cards:0,location:'Not sharing',placeName:'',lat:null,lng:null,accuracy:null,area:area||district||'—',district:district||'—',details:'Field Executive'};
  const tlId=clean(req.body.tlId);
  if(tlId){ const tl=dbState.teamLeaders.find(t=>t.id===tlId && t.active!==false && normalizeDistrict(t.district)===district); if(!tl) return res.status(400).json({ok:false,message:'Invalid Team Leader.'}); if(tl.staffIds.length>=10) return res.status(400).json({ok:false,message:'Team Leader ke under maximum 10 staff allowed hain.'}); e.teamLeaderId=tl.id; tl.staffIds.push(e.id); }
  dbState.employees.push(e); g.members.push(id); audit('STAFF_REGISTER',id,{district,teamLeaderId:e.teamLeaderId||null});
  if(!saveDatabase('staff-register')){dbState.employees.pop();g.members=g.members.filter(x=>x!==id); if(tlId){const tl=dbState.teamLeaders.find(t=>t.id===tlId); if(tl) tl.staffIds=tl.staffIds.filter(x=>x!==id);} return res.status(500).json({ok:false,message:'Registration save nahi ho saki.'});}
  res.json({ok:true,employee:e,password:'SS@12345',group:g});
});

app.post('/api/district-coordinator-signup',(req,res)=>{
  try {
    const name=clean(req.body.name), phone=clean(req.body.phone), district=normalizeDistrict(req.body.district), password=typeof req.body.password==='string'?req.body.password:'';
    if(name.length<2) return res.json({ok:false,message:'Coordinator name is required.'});
    if(!/^\d{10}$/.test(phone)) return res.json({ok:false,message:'Mobile number 10 digits ka hona chahiye.'});
    if(!district) return res.json({ok:false,message:'District select kijiye.'});
    if(password.length<6) return res.json({ok:false,message:'Password minimum 6 characters ka hona chahiye.'});
    if(!Array.isArray(dbState.districtHeads)) dbState.districtHeads=[];
    if(dbState.districtHeads.some(h=>String(h.phone||'')===phone)) return res.json({ok:false,message:'Is mobile number se Coordinator account already registered hai.'});
    let max=0;
    dbState.districtHeads.forEach(h=>{const m=String(h.id||'').match(/^DC(\d+)$/i);if(m)max=Math.max(max,Number(m[1]));});
    const id='DC'+String(max+1).padStart(3,'0');
    const coordinator={id,name, district, phone, password, status:'Active'};
    dbState.districtHeads.push(coordinator);
    ensureGroup(district); audit('DC_REGISTER',id,{district});
    if(!saveDatabase('dc-register')){dbState.districtHeads.pop();return res.status(500).json({ok:false,message:'Coordinator account save nahi ho saka.'});}
    return res.json({ok:true,coordinator:{id,name,district,phone,status:'Active'}});
  } catch(err){ console.error('Coordinator Signup Error:',err); return res.status(500).json({ok:false,message:'Coordinator registration server error.'}); }
});


function teamState(tlId){
  const tl=dbState.teamLeaders.find(x=>x.id===tlId && x.active!==false);
  if(!tl)return {teamLeaders:[],employees:[]};
  const employees=dbState.employees.filter(e=>tl.staffIds.includes(e.id) && e.active!==false);
  return {teamLeaders:[(()=>{const {password,...safe}=tl;return safe;})()],employees};
}
app.get('/api/session',(req,res)=>{
  const s=getSession(req);
  if(!s)return res.status(401).json({ok:false});
  if(s.role==='owner')return res.json({ok:true,role:'owner',state:publicState()});
  if(s.role==='district_head'){
    const h=dbState.districtHeads.find(x=>x.id===s.id);
    if(!h)return res.status(401).json({ok:false});
    const safe={...h}; delete safe.password;
    return res.json({ok:true,role:'district_head',head:safe,state:districtState(h.district)});
  }
  if(s.role==='team_leader'){
    const t=dbState.teamLeaders.find(x=>x.id===s.id);
    if(!t)return res.status(401).json({ok:false});
    const safe={...t}; delete safe.password;
    return res.json({ok:true,role:'team_leader',teamLeader:safe,state:teamState(t.id)});
  }
  if(s.role==='employee'){
    const e=dbState.employees.find(x=>x.id===s.id);
    if(!e)return res.status(401).json({ok:false});
    return res.json({ok:true,role:'employee',employee:e});
  }
  return res.status(401).json({ok:false});
});
app.post('/api/login',(req,res)=>{
  const role=clean(req.body.role), id=clean(req.body.id), password=typeof req.body.password==='string'?req.body.password:'';
  if(role==='owner' && (id.toUpperCase()==='SS'||id.toUpperCase()==='ADMIN') && password===(process.env.OWNER_PASSWORD||'ADMIN@12345')) {
    const token=issueSession({role:'owner',id:'OWNER',name:'SS ENTERPRISES Owner'});
    return res.json({ok:true,role:'owner',token,state:publicState()});
  }
  if(role==='district_head'){
    const h=dbState.districtHeads.find(x=>String(x.id).toUpperCase()===id.toUpperCase());
    if(h&&h.status==='Active'&&password===h.password){
      const token=issueSession({role:'district_head',id:h.id,name:h.name,district:h.district});
      const safeHead={...h}; delete safeHead.password;
      return res.json({ok:true,role:'district_head',token,head:safeHead,state:districtState(h.district)});
    }
  }
  if(role==='team_leader'){
    const t=dbState.teamLeaders.find(x=>String(x.id).toUpperCase()===id.toUpperCase());
    if(t&&t.active!==false&&t.status==='Active'&&password===t.password){
      const token=issueSession({role:'team_leader',id:t.id,name:t.name,district:t.district});
      const safeTL={...t}; delete safeTL.password;
      return res.json({ok:true,role:'team_leader',token,teamLeader:safeTL,state:teamState(t.id)});
    }
  }
  if(role==='employee'){
    const e=dbState.employees.find(x=>String(x.id).toUpperCase()===id.toUpperCase());
    if(e&&e.enabled!==false&&e.active!==false&&password===(process.env.STAFF_PASSWORD||'SS@12345')){
      const token=issueSession({role:'employee',id:e.id,name:e.name,district:e.district});
      return res.json({ok:true,role:'employee',token,employee:e});
    }
  }
  res.json({ok:false,message:'Invalid ID or Password.'});
});
app.get('/api/state',(req,res)=>{res.set('Cache-Control','no-store');res.json(publicState());});
function districtState(district){
  const d=clean(district).toLowerCase();
  return {
    district,
    employees: dbState.employees.filter(e=>String(e.district||e.area||'').toLowerCase()===d),
    customers: dbState.customers.filter(c=>{const e=dbState.employees.find(x=>x.id===c.employeeId);return e&&String(e.district||e.area||'').toLowerCase()===d;}),
    cardUpdates: dbState.cardUpdates.filter(u=>String(u.district||'').toLowerCase()===d),
    groups: dbState.groups.filter(g=>String(g.district||'').toLowerCase()===d)
  };
}
app.get('/api/district-state',(req,res)=>{const district=clean(req.query.district);if(!district)return res.status(400).json({ok:false,message:'District required.'});res.set('Cache-Control','no-store');res.json({ok:true,state:districtState(district)});});
app.post('/api/staff-control',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader']))return;const id=clean(req.body.id), action=clean(req.body.action), district=clean(req.body.district);const e=dbState.employees.find(x=>x.id===id);if(district && String(e?.district||e?.area||'').toLowerCase()!==district.toLowerCase())return res.status(403).json({ok:false,message:'Staff is not in this district.'});if(!e)return res.json({ok:false,message:'Staff not found.'});if(action==='disable')e.enabled=false;else if(action==='enable')e.enabled=true;else if(action==='logout')e.status='Offline';else return res.status(400).json({ok:false,message:'Invalid action.'});if(!saveDatabase())return res.status(500).json({ok:false,message:'Control change save nahi hua.'});res.json({ok:true,employee:e});});


app.post('/api/work-status',(req,res)=>{if(!requireRole(req,res,['employee']))return;
  const id=clean(req.body.id), status=req.body.status==='Online'?'Online':'Offline', e=dbState.employees.find(x=>x.id===id);
  if(!e)return res.json({ok:false,message:'Employee not found.'}); e.status=status;e.last=getISTDate();
  if(!saveDatabase())return res.status(500).json({ok:false,message:'Work status save nahi hua.'}); res.json({ok:true,employee:e});
});

app.post('/api/location-sync',async(req,res)=>{if(!requireRole(req,res,['employee']))return;
  const id=clean(req.body.id), lat=Number(req.body.lat), lng=Number(req.body.lng), accuracy=Number(req.body.accuracy||0);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return res.status(400).json({ok:false,message:'Invalid GPS coordinates.'});
  const e=dbState.employees.find(x=>x.id===id); if(!e)return res.json({ok:false,message:'Employee not found.'});
  e.lat=lat;e.lng=lng;e.accuracy=Number.isFinite(accuracy)?accuracy:0;e.location=`${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(e.accuracy)}m)`;e.status='Online';e.last=getISTDate();
  const loc={id:'LOC-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7),employeeId:e.id,employeeName:e.name,district:e.district||e.area||'—',lat,lng,accuracy:e.accuracy,date:getISTDate(),dateMs:Date.now(),placeName:e.placeName||''};
  dbState.locationHistory.push(loc); e.locationHistoryIds.push(loc.id);  audit('LOCATION_SYNC',e.id,{lat,lng,accuracy:e.accuracy});
  // Reverse geocode only when the area has materially changed, keeping slow-network traffic low.
  const oldPlace=e.placeName||'';
  if(!e._lastGeocodeAt || Date.now()-e._lastGeocodeAt>120000){const place=await reverseGeocode(lat,lng);if(place){e.placeName=place;e._lastGeocodeAt=Date.now();}else if(!oldPlace)e.placeName='GPS location available';}
  if(!saveDatabase('routine'))return res.status(500).json({ok:false,message:'Location save nahi hui.'});
  res.json({ok:true,placeName:e.placeName||'GPS location available',location:e.location});
});

app.post('/api/card-update',(req,res)=>{if(!requireRole(req,res,['employee']))return;
  const empId=clean(req.body.empId), count=Number(req.body.count), note=clean(req.body.note);
  if(!Number.isInteger(count)||count<1||count>10000)return res.status(400).json({ok:false,message:'Cards ki sankhya 1 se 10000 ke beech honi chahiye.'});
  const e=dbState.employees.find(x=>x.id===empId);if(!e)return res.json({ok:false,message:'Employee not found.'});
  const clientId=clean(req.body.clientId);
  if(clientId){ const existing=dbState.cardUpdates.find(x=>x.clientId===clientId); if(existing) return res.json({ok:true,duplicate:true,update:existing,totalCards:e.cards}); }
  const u={id:'UPD-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6),clientId,employeeId:e.id,employeeName:e.name,district:e.district||e.area||'—',count,note,date:getISTDate(),dateKey:dateKey()};
  dbState.cardUpdates.unshift(u); e.cards=Number(e.cards||0)+count; e.last=getISTDate();
  if(!saveDatabase())return res.status(500).json({ok:false,message:'Card update save nahi hua.'});
  res.json({ok:true,update:u,totalCards:e.cards});
});

app.get('/api/card-summary',(req,res)=>{
  const key=clean(req.query.date)||dateKey(), byEmployee={}, byDistrict={};
  dbState.cardUpdates.filter(x=>x.dateKey===key).forEach(u=>{byEmployee[u.employeeId]=(byEmployee[u.employeeId]||0)+Number(u.count||0);byDistrict[u.district]=(byDistrict[u.district]||0)+Number(u.count||0);});
  res.json({ok:true,date:key,byEmployee,byDistrict,total:Object.values(byEmployee).reduce((a,b)=>a+b,0),updates:dbState.cardUpdates.filter(x=>x.dateKey===key).slice(0,300)});
});

app.post('/api/add-customer',(req,res)=>{if(!requireRole(req,res,['employee']))return;
  const empId=clean(req.body.empId),name=clean(req.body.name),mobile=clean(req.body.mobile),abha=clean(req.body.abha),clientId=clean(req.body.clientId); if(!name)return res.json({ok:false,message:'Customer name is required.'});
  const e=dbState.employees.find(x=>x.id===empId); if(clientId){const existing=dbState.customers.find(x=>x.clientId===clientId);if(existing)return res.json({ok:true,duplicate:true,customer:existing});} const c={id:'CUS-'+Date.now().toString(36).toUpperCase(),clientId,employeeId:e?e.id:(empId||'SYSTEM'),employeeName:e?e.name:'Field Staff',name,mobile:mobile||'—',abha:abha||'—',date:getISTDate()};dbState.customers.unshift(c);if(e)e.cards=dbState.customers.filter(x=>x.employeeId===e.id).length;
  if(!saveDatabase()){dbState.customers.shift();return res.status(500).json({ok:false,message:'Customer entry save nahi hui.'});}res.json({ok:true,customer:c});
});
app.post('/api/delete-customer',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader','employee']))return;const id=clean(req.body.id),c=dbState.customers.find(x=>x.id===id);if(!c)return res.json({ok:false,message:'Customer entry not found.'});c.deletedAt=getISTDate();c.deletedBy=clean(req.body.actor)||'SYSTEM';c.active=false;audit('CUSTOMER_ARCHIVE',c.deletedBy,{customerId:id});if(!saveDatabase('customer-archive'))return res.status(500).json({ok:false,message:'Archive save nahi hua.'});res.json({ok:true,archived:true});});

function ensureTeamGroup(tl){
  let g=dbState.groups.find(x=>x.type==='team' && x.teamLeaderId===tl.id);
  if(!g){g={id:'TEAM-'+tl.id,name:'SS ENTERPRISES • '+tl.name+' TEAM',district:tl.district,type:'team',teamLeaderId:tl.id,members:[tl.id]};dbState.groups.push(g);}
  if(!g.members.includes(tl.id)) g.members.unshift(tl.id);
  g.members=g.members.filter(id=>id===tl.id || tl.staffIds.includes(id));
  return g;
}

// ---------- Production team / history APIs ----------
app.get('/api/districts',(req,res)=>res.json({ok:true,districts:BIHAR_DISTRICTS}));
app.get('/api/team-leaders',(req,res)=>{const district=normalizeDistrict(req.query.district||'');let list=dbState.teamLeaders.filter(t=>t.active!==false);if(district)list=list.filter(t=>normalizeDistrict(t.district)===district);res.set('Cache-Control','no-store');res.json({ok:true,teamLeaders:list.map(t=>{const {password,...safe}=t;return {...safe,staff:t.staffIds.map(id=>dbState.employees.find(e=>e.id===id)).filter(Boolean)}})});});
app.post('/api/team-leader/create',(req,res)=>{if(!requireRole(req,res,['owner']))return;const name=clean(req.body.name),phone=clean(req.body.phone),district=normalizeDistrict(req.body.district),password=typeof req.body.password==='string'?req.body.password:'';if(name.length<2||!/^[0-9]{10}$/.test(phone)||!district)return res.status(400).json({ok:false,message:'Name, 10 digit mobile aur district required.'});if(password.length<6)return res.status(400).json({ok:false,message:'Password minimum 6 characters.'});if(!BIHAR_DISTRICTS.includes(district))return res.status(400).json({ok:false,message:'Bihar ka valid district select kijiye.'});if(dbState.teamLeaders.some(t=>t.phone===phone&&t.active!==false))return res.status(409).json({ok:false,message:'Is mobile se TL already registered hai.'});let max=0;dbState.teamLeaders.forEach(t=>{const m=String(t.id).match(/^TL(\d+)$/);if(m)max=Math.max(max,+m[1]);});const id='TL'+String(max+1).padStart(3,'0');const tl={id,name,phone,district,password,status:'Active',active:true,maxStaff:10,staffIds:[]};dbState.teamLeaders.push(tl);ensureTeamGroup(tl);audit('TL_REGISTER',id,{district});if(!saveDatabase('tl-register'))return res.status(500).json({ok:false,message:'TL save nahi hua.'});res.json({ok:true,teamLeader:{id,name,phone,district,status:'Active',maxStaff:10,staffIds:[]},password});});
app.post('/api/team-leader/assign',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader']))return;const tlId=clean(req.body.tlId),employeeId=clean(req.body.employeeId),tl=dbState.teamLeaders.find(t=>t.id===tlId&&t.active!==false),e=dbState.employees.find(x=>x.id===employeeId&&x.active!==false);if(!tl||!e)return res.status(404).json({ok:false,message:'TL ya staff nahi mila.'});if(req.user.role==='team_leader' && tl.id!==req.user.id)return res.status(403).json({ok:false,message:'TL sirf apni team manage kar sakta hai.'});if(!canAccessDistrict(req,e.district))return res.status(403).json({ok:false,message:'District access denied.'});if(normalizeDistrict(tl.district)!==normalizeDistrict(e.district))return res.status(400).json({ok:false,message:'TL aur staff same district mein hone chahiye.'});if(tl.staffIds.length>=10&&!tl.staffIds.includes(e.id))return res.status(400).json({ok:false,message:'TL ke under maximum 10 staff allowed hain.'});for(const other of dbState.teamLeaders)other.staffIds=other.staffIds.filter(id=>id!==e.id);tl.staffIds.push(e.id);e.teamLeaderId=tl.id; const tg=ensureTeamGroup(tl); if(!tg.members.includes(e.id))tg.members.push(e.id); for(const g of dbState.groups.filter(x=>x.type==='team'&&x.teamLeaderId!==tl.id))g.members=g.members.filter(id=>id!==e.id);audit('TL_ASSIGN',clean(req.body.actor)||'SYSTEM',{tlId,employeeId});if(!saveDatabase('tl-assign'))return res.status(500).json({ok:false,message:'Assignment save nahi hua.'});res.json({ok:true,teamLeader:tl,employee:e});});
app.get('/api/team-state',(req,res)=>{const role=clean(req.query.role),id=clean(req.query.id),district=normalizeDistrict(req.query.district);let employees=dbState.employees, tls=dbState.teamLeaders.filter(t=>t.active!==false);if(role==='district_head') {employees=employees.filter(e=>normalizeDistrict(e.district)===district);tls=tls.filter(t=>normalizeDistrict(t.district)===district);} else if(role==='team_leader'){const tl=tls.find(t=>t.id===id);if(!tl)return res.status(404).json({ok:false,message:'TL not found.'});employees=employees.filter(e=>tl.staffIds.includes(e.id));tls=tl?[tl]:[];} else if(role==='employee'){employees=employees.filter(e=>e.id===id);tls=tls.filter(t=>t.id===(employees[0]?.teamLeaderId||''));}res.set('Cache-Control','no-store');res.json({ok:true,district:district||null,teamLeaders:tls,employees});});
app.get('/api/location-history',(req,res)=>{const employeeId=clean(req.query.employeeId);if(req.user.role==='employee' && req.user.id!==employeeId)return res.status(403).json({ok:false,message:'Sirf apni location history dekh sakte hain.'});const target=dbState.employees.find(e=>e.id===employeeId);if(!target)return res.status(404).json({ok:false,message:'Employee not found.'});if(req.user.role!=='owner' && req.user.role!=='employee' && !canAccessDistrict(req,target.district))return res.status(403).json({ok:false,message:'District access denied.'});const limit=Math.min(5000,Math.max(1,Number(req.query.limit||1000)));let rows=dbState.locationHistory;if(employeeId)rows=rows.filter(x=>x.employeeId===employeeId);res.set('Cache-Control','no-store');res.json({ok:true,history:rows.slice(-limit)});});
app.post('/api/work-update',(req,res)=>{if(!requireRole(req,res,['employee','team_leader','district_head','owner']))return;const employeeId=clean(req.body.employeeId),e=dbState.employees.find(x=>x.id===employeeId);if(!e)return res.status(404).json({ok:false,message:'Employee not found.'});const u={id:'WORK-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6),employeeId,employeeName:e.name,district:e.district||e.area||'—',type:clean(req.body.type)||'hourly',text:clean(req.body.text),cards:Number(req.body.cards||0),date:getISTDate(),dateMs:Date.now()};if(!u.text&&!u.cards)return res.status(400).json({ok:false,message:'Work update required.'});dbState.workUpdates.push(u);audit('WORK_UPDATE',employeeId,{type:u.type});if(!saveDatabase('work-update'))return res.status(500).json({ok:false,message:'Work update save nahi hua.'});res.json({ok:true,update:u});});
app.get('/api/work-updates',(req,res)=>{const employeeId=clean(req.query.employeeId),district=normalizeDistrict(req.query.district);let rows=dbState.workUpdates;if(employeeId)rows=rows.filter(x=>x.employeeId===employeeId);if(district)rows=rows.filter(x=>normalizeDistrict(x.district)===district);res.json({ok:true,updates:rows.slice(-1000).reverse()});});
app.post('/api/notification',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader']))return;const n={id:'NTF-'+Date.now().toString(36).toUpperCase(),to:clean(req.body.to),from:clean(req.body.from)||'SYSTEM',title:clean(req.body.title),text:clean(req.body.text),date:getISTDate(),read:false};if(!n.to||!n.text)return res.status(400).json({ok:false,message:'Notification recipient and text required.'});dbState.notifications.push(n);if(dbState.notifications.length>20000)dbState.notifications=dbState.notifications.slice(-20000);if(!saveDatabase('notification'))return res.status(500).json({ok:false,message:'Notification save nahi hua.'});res.json({ok:true,notification:n});});
app.get('/api/notifications',(req,res)=>{const to=clean(req.query.to);res.json({ok:true,notifications:dbState.notifications.filter(n=>!to||n.to===to||n.to==='ALL').slice(-200).reverse()});});
app.post('/api/meeting',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader','employee']))return;const m={id:'MTG-'+Date.now().toString(36).toUpperCase(),createdBy:clean(req.body.createdBy)||'SYSTEM',scope:clean(req.body.scope)||'ALL',district:normalizeDistrict(req.body.district),title:clean(req.body.title)||'SS ENTERPRISES Training / Meeting',roomId:clean(req.body.roomId)||crypto.randomUUID(),mode:clean(req.body.mode)||'video',screenShare:false,date:getISTDate(),dateMs:Date.now(),status:'scheduled'};dbState.meetings.push(m);audit('MEETING_CREATE',m.createdBy,{meetingId:m.id,scope:m.scope,district:m.district});if(!saveDatabase('meeting'))return res.status(500).json({ok:false,message:'Meeting save nahi hui.'});res.json({ok:true,meeting:m});});
app.get('/api/meetings',(req,res)=>{const district=normalizeDistrict(req.query.district);let rows=dbState.meetings;if(district)rows=rows.filter(m=>!m.district||normalizeDistrict(m.district)===district);res.json({ok:true,meetings:rows.slice(-100).reverse()});});
app.get('/api/audit-log',(req,res)=>{const limit=Math.min(5000,Math.max(1,Number(req.query.limit||500)));res.json({ok:true,log:dbState.auditLog.slice(-limit).reverse()});});
app.get('/api/backup-status',(req,res)=>{let backups=[];try{const dir=path.join(DATA_DIR,'backups');if(fs.existsSync(dir))backups=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort().reverse().slice(0,20).map(name=>({name,size:fs.statSync(path.join(dir,name)).size}));}catch{}res.json({ok:true,schemaVersion:dbState.schemaVersion,backups,records:{employees:dbState.employees.length,customers:dbState.customers.length,cardUpdates:dbState.cardUpdates.length,locations:dbState.locationHistory.length,workUpdates:dbState.workUpdates.length,audit:dbState.auditLog.length}});});

app.get('/api/groups',(req,res)=>{let groups=dbState.groups;const employeeId=clean(req.query.employeeId),district=normalizeDistrict(req.query.district||'');if(employeeId){const e=dbState.employees.find(x=>x.id===employeeId);if(e&&e.teamLeaderId){groups=groups.filter(g=>g.type==='team'&&g.teamLeaderId===e.teamLeaderId);}else if(e){groups=groups.filter(g=>g.type!=='team'&&normalizeDistrict(g.district)===normalizeDistrict(e.district));}}else if(district){groups=groups.filter(g=>normalizeDistrict(g.district)===district);}res.set('Cache-Control','no-store');res.json({ok:true,groups:groups.map(g=>({...g,members:g.members.map(id=>{const e=dbState.employees.find(x=>x.id===id);if(e)return e;const tl=dbState.teamLeaders.find(t=>t.id===id);return tl?{id:tl.id,name:tl.name,role:'Team Leader'}:null}).filter(Boolean)}))});});
app.get('/api/groups/:groupId/messages',(req,res)=>{const g=clean(req.params.groupId);res.json({ok:true,messages:dbState.messages.filter(m=>m.groupId===g).slice(0,100).reverse()});});
app.post('/api/group-message',(req,res)=>{if(!requireRole(req,res,['owner','district_head','team_leader','employee']))return;
  const groupId=clean(req.body.groupId),empId=clean(req.body.empId),text=clean(req.body.text),headDistrict=clean(req.body.headDistrict);
  if(!groupId||!text)return res.status(400).json({ok:false,message:'Message required.'});
  const g=dbState.groups.find(x=>x.id===groupId); if(!g)return res.json({ok:false,message:'Group not found.'});
  if(empId.startsWith('HEAD:')) {
    if(!headDistrict || String(g.district).toLowerCase()!==headDistrict.toLowerCase()) return res.status(403).json({ok:false,message:'Coordinator sirf apne district group me message kar sakta hai.'});
    const h=dbState.districtHeads.find(x=>String(x.district).toLowerCase()===headDistrict.toLowerCase() && x.status==='Active');
    const m={id:'MSG-'+Date.now().toString(36).toUpperCase(),groupId,employeeId:empId,senderName:h?h.name:'District Coordinator',text,date:getISTDate()};
    dbState.messages.push(m); 
    if(!saveDatabase('message'))return res.status(500).json({ok:false,message:'Message save nahi hua.'}); return res.json({ok:true,message:m});
  }
  const e=dbState.employees.find(x=>x.id===empId);
  if(!e)return res.json({ok:false,message:'Employee not found.'});
  if(String(g.district).toLowerCase()!==String(e.district||e.area||'').toLowerCase()) return res.status(403).json({ok:false,message:'Staff sirf apne district group me message kar sakta hai.'});
  if(!g.members.includes(empId))g.members.push(empId);
  const m={id:'MSG-'+Date.now().toString(36).toUpperCase(),groupId,employeeId:empId,senderName:e.name,text,date:getISTDate()};
  dbState.messages.push(m);if(!saveDatabase('message'))return res.status(500).json({ok:false,message:'Message save nahi hua.'});res.json({ok:true,message:m});
});


app.post('/api/staff-archive',(req,res)=>{
  if(!requireRole(req,res,['owner']))return;
  const id=clean(req.body.id), e=dbState.employees.find(x=>x.id===id);
  if(!e)return res.status(404).json({ok:false,message:'Staff not found.'});
  if(e.active===false)return res.json({ok:true,archived:true,employee:e});
  e.active=false; e.enabled=false; e.status='Offline'; e.archivedAt=getISTDate(); e.archivedBy=req.user.id;
  for(const tl of dbState.teamLeaders) tl.staffIds=tl.staffIds.filter(x=>x!==id);
  for(const g of dbState.groups) g.members=g.members.filter(x=>x!==id);
  audit('STAFF_ARCHIVE',req.user.id,{employeeId:id});
  if(!saveDatabase('staff-archive'))return res.status(500).json({ok:false,message:'Staff archive save nahi hua.'});
  res.json({ok:true,archived:true,employee:e});
});

app.post('/api/create-group',(req,res)=>{if(!requireRole(req,res,['owner']))return;const district=clean(req.body.district);if(!district)return res.json({ok:false,message:'District required.'});const g=ensureGroup(district);if(!saveDatabase('group'))return res.status(500).json({ok:false,message:'Group save nahi hua.'});res.json({ok:true,group:g});});


app.post('/api/logout',(req,res)=>{
  const header=req.headers.authorization||''; const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(token)sessions.delete(token);
  res.json({ok:true});
});

app.get('/health',(req,res)=>res.status(200).json({ok:true,service:'SS ENTERPRISES ABHA',schemaVersion:dbState.schemaVersion,time:new Date().toISOString()}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

const PORT=Number(process.env.PORT)||10000;server.listen(PORT,'0.0.0.0',()=>console.log(`🚀 SS Enterprises gateway running on port ${PORT}`));
