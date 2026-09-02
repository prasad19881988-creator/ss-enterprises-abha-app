const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

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
  ]
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
  safe.employees.forEach(e => { if (typeof e.enabled !== 'boolean') e.enabled = true; });
  safe.employees.forEach(e => {
    e.district = e.district || e.area || '—';
    e.placeName = e.placeName || '';
    e.cards = Number(e.cards || 0);
  });
  for (const e of safe.employees) { const g = safe.groups.find(x => String(x.district).toLowerCase() === String(e.district).toLowerCase()); if (g && !g.members.includes(e.id)) g.members.push(e.id); }
  return safe;
}
function saveDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
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
loadDatabase();
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function getISTDate() { return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }); }
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); }
function ensureGroup(district) {
  const name = clean(district) || 'Unassigned';
  let g = dbState.groups.find(x => x.district.toLowerCase() === name.toLowerCase());
  if (!g) { g = { id: 'DIST-' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '-'), name: 'SS ENTERPRISES ABHA TEAM ' + name.toUpperCase(), district: name, members: [] }; dbState.groups.push(g); }
  return g;
}
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

app.get('/health', (req,res) => res.json({ ok:true, employees:dbState.employees.length, customers:dbState.customers.length, version:'3.2.0' }));

app.post('/api/signup', (req,res) => {
  const name=clean(req.body.name), phone=clean(req.body.phone), area=clean(req.body.area), district=clean(req.body.district || area);
  if (name.length<2) return res.json({ok:false,message:'Name is required (at least 2 letters).'});
  let max=100; dbState.employees.forEach(e=>{const m=String(e.id||'').match(/^EMP(\d+)$/i); if(m) max=Math.max(max,Number(m[1]));});
  const id='EMP'+(max+1); const g=ensureGroup(district);
  const e={id,name,phone:phone||'—',status:'Offline',last:'—',cards:0,location:'Not sharing',placeName:'',lat:null,lng:null,accuracy:null,area:area||district||'—',district:district||'—',details:'Field Executive'};
  dbState.employees.push(e); g.members.push(id);
  if(!saveDatabase()){dbState.employees.pop();g.members=g.members.filter(x=>x!==id);return res.status(500).json({ok:false,message:'Registration save nahi ho saki.'});}
  res.json({ok:true,employee:e,password:'SS@12345',group:g});
});

app.post('/api/district-coordinator-signup',(req,res)=>{
  try {
    const name=clean(req.body.name), phone=clean(req.body.phone), district=clean(req.body.district), password=typeof req.body.password==='string'?req.body.password:'';
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
    ensureGroup(district);
    if(!saveDatabase()){dbState.districtHeads.pop();return res.status(500).json({ok:false,message:'Coordinator account save nahi ho saka.'});}
    return res.json({ok:true,coordinator:{id,name,district,phone,status:'Active'}});
  } catch(err){ console.error('Coordinator Signup Error:',err); return res.status(500).json({ok:false,message:'Coordinator registration server error.'}); }
});

app.post('/api/login',(req,res)=>{
  const role=clean(req.body.role), id=clean(req.body.id), password=typeof req.body.password==='string'?req.body.password:'';
  if(role==='owner' && (id.toUpperCase()==='SS'||id.toUpperCase()==='ADMIN') && password==='ADMIN@12345') return res.json({ok:true,role:'owner',state:dbState});
  if(role==='district_head'){const h=dbState.districtHeads.find(x=>String(x.id).toUpperCase()===id.toUpperCase());if(h&&h.status==='Active'&&password===h.password)return res.json({ok:true,role:'district_head',head:h,state:districtState(h.district)});}
  if(role==='employee'){const e=dbState.employees.find(x=>String(x.id).toUpperCase()===id.toUpperCase());if(e&&e.enabled!==false&&password==='SS@12345') return res.json({ok:true,role:'employee',employee:e});}
  res.json({ok:false,message:'Invalid ID or Password.'});
});
app.get('/api/state',(req,res)=>{res.set('Cache-Control','no-store');res.json(dbState);});
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
app.post('/api/staff-control',(req,res)=>{const id=clean(req.body.id), action=clean(req.body.action), district=clean(req.body.district);const e=dbState.employees.find(x=>x.id===id);if(district && String(e?.district||e?.area||'').toLowerCase()!==district.toLowerCase())return res.status(403).json({ok:false,message:'Staff is not in this district.'});if(!e)return res.json({ok:false,message:'Staff not found.'});if(action==='disable')e.enabled=false;else if(action==='enable')e.enabled=true;else if(action==='logout')e.status='Offline';else return res.status(400).json({ok:false,message:'Invalid action.'});if(!saveDatabase())return res.status(500).json({ok:false,message:'Control change save nahi hua.'});res.json({ok:true,employee:e});});


app.post('/api/work-status',(req,res)=>{
  const id=clean(req.body.id), status=req.body.status==='Online'?'Online':'Offline', e=dbState.employees.find(x=>x.id===id);
  if(!e)return res.json({ok:false,message:'Employee not found.'}); e.status=status;e.last=getISTDate();
  if(!saveDatabase())return res.status(500).json({ok:false,message:'Work status save nahi hua.'}); res.json({ok:true,employee:e});
});

app.post('/api/location-sync',async(req,res)=>{
  const id=clean(req.body.id), lat=Number(req.body.lat), lng=Number(req.body.lng), accuracy=Number(req.body.accuracy||0);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return res.status(400).json({ok:false,message:'Invalid GPS coordinates.'});
  const e=dbState.employees.find(x=>x.id===id); if(!e)return res.json({ok:false,message:'Employee not found.'});
  e.lat=lat;e.lng=lng;e.accuracy=Number.isFinite(accuracy)?accuracy:0;e.location=`${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;e.status='Online';e.last=getISTDate();
  // Reverse geocode only when the area has materially changed, keeping slow-network traffic low.
  const oldPlace=e.placeName||'';
  if(!e._lastGeocodeAt || Date.now()-e._lastGeocodeAt>120000){const place=await reverseGeocode(lat,lng);if(place){e.placeName=place;e._lastGeocodeAt=Date.now();}else if(!oldPlace)e.placeName='GPS location available';}
  if(!saveDatabase())return res.status(500).json({ok:false,message:'Location save nahi hui.'});
  res.json({ok:true,placeName:e.placeName||'GPS location available',location:e.location});
});

app.post('/api/card-update',(req,res)=>{
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

app.post('/api/add-customer',(req,res)=>{
  const empId=clean(req.body.empId),name=clean(req.body.name),mobile=clean(req.body.mobile),abha=clean(req.body.abha),clientId=clean(req.body.clientId); if(!name)return res.json({ok:false,message:'Customer name is required.'});
  const e=dbState.employees.find(x=>x.id===empId); if(clientId){const existing=dbState.customers.find(x=>x.clientId===clientId);if(existing)return res.json({ok:true,duplicate:true,customer:existing});} const c={id:'CUS-'+Date.now().toString(36).toUpperCase(),clientId,employeeId:e?e.id:(empId||'SYSTEM'),employeeName:e?e.name:'Field Staff',name,mobile:mobile||'—',abha:abha||'—',date:getISTDate()};dbState.customers.unshift(c);if(e)e.cards=dbState.customers.filter(x=>x.employeeId===e.id).length;
  if(!saveDatabase()){dbState.customers.shift();return res.status(500).json({ok:false,message:'Customer entry save nahi hui.'});}res.json({ok:true,customer:c});
});
app.post('/api/delete-customer',(req,res)=>{const id=clean(req.body.id),before=dbState.customers.length;dbState.customers=dbState.customers.filter(c=>c.id!==id);if(before===dbState.customers.length)return res.json({ok:false,message:'Customer entry not found.'});for(const e of dbState.employees)e.cards=dbState.customers.filter(x=>x.employeeId===e.id).length; if(!saveDatabase())return res.status(500).json({ok:false,message:'Delete save nahi hua.'});res.json({ok:true});});

app.get('/api/groups',(req,res)=>res.json({ok:true,groups:dbState.groups.map(g=>({...g,members:g.members.map(id=>dbState.employees.find(e=>e.id===id)).filter(Boolean)}))}));
app.get('/api/groups/:groupId/messages',(req,res)=>{const g=clean(req.params.groupId);res.json({ok:true,messages:dbState.messages.filter(m=>m.groupId===g).slice(0,100).reverse()});});
app.post('/api/group-message',(req,res)=>{
  const groupId=clean(req.body.groupId),empId=clean(req.body.empId),text=clean(req.body.text),headDistrict=clean(req.body.headDistrict);
  if(!groupId||!text)return res.status(400).json({ok:false,message:'Message required.'});
  const g=dbState.groups.find(x=>x.id===groupId); if(!g)return res.json({ok:false,message:'Group not found.'});
  if(empId.startsWith('HEAD:')) {
    if(!headDistrict || String(g.district).toLowerCase()!==headDistrict.toLowerCase()) return res.status(403).json({ok:false,message:'Coordinator sirf apne district group me message kar sakta hai.'});
    const h=dbState.districtHeads.find(x=>String(x.district).toLowerCase()===headDistrict.toLowerCase() && x.status==='Active');
    const m={id:'MSG-'+Date.now().toString(36).toUpperCase(),groupId,employeeId:empId,senderName:h?h.name:'District Coordinator',text,date:getISTDate()};
    dbState.messages.push(m); if(dbState.messages.length>3000)dbState.messages=dbState.messages.slice(-3000);
    if(!saveDatabase())return res.status(500).json({ok:false,message:'Message save nahi hua.'}); return res.json({ok:true,message:m});
  }
  const e=dbState.employees.find(x=>x.id===empId);
  if(!e)return res.json({ok:false,message:'Employee not found.'});
  if(String(g.district).toLowerCase()!==String(e.district||e.area||'').toLowerCase()) return res.status(403).json({ok:false,message:'Staff sirf apne district group me message kar sakta hai.'});
  if(!g.members.includes(empId))g.members.push(empId);
  const m={id:'MSG-'+Date.now().toString(36).toUpperCase(),groupId,employeeId:empId,senderName:e.name,text,date:getISTDate()};
  dbState.messages.push(m);if(dbState.messages.length>3000)dbState.messages=dbState.messages.slice(-3000);if(!saveDatabase())return res.status(500).json({ok:false,message:'Message save nahi hua.'});res.json({ok:true,message:m});
});

app.post('/api/create-group',(req,res)=>{const district=clean(req.body.district);if(!district)return res.json({ok:false,message:'District required.'});const g=ensureGroup(district);if(!saveDatabase())return res.status(500).json({ok:false,message:'Group save nahi hua.'});res.json({ok:true,group:g});});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const PORT=Number(process.env.PORT)||10000;server.listen(PORT,'0.0.0.0',()=>console.log(`🚀 SS Enterprises gateway running on port ${PORT}`));
