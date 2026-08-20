const express=require('express');
const http=require('http');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const {Server}=require('socket.io');
const app=express(); const server=http.createServer(app); const io=new Server(server,{cors:{origin:'*'}});
app.use(express.json()); app.use(express.static(__dirname));
const DB=path.join(__dirname,'data.json');
const defaultDB={employees:[{id:'EMP101',name:'Dev Krishna Rai',phone:'',status:'Offline',last:'—',cards:0,location:'Not sharing',lat:null,lng:null,accuracy:null,area:'',details:''},{id:'EMP102',name:'Employee 2',phone:'',status:'Offline',last:'—',cards:0,location:'Not sharing',lat:null,lng:null,accuracy:null,area:'',details:''}],customers:[]};
let db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):defaultDB;
db.employees=db.employees||[]; db.customers=db.customers||[]; function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2))} function token(){return crypto.randomBytes(24).toString('hex')}; const sessions=new Map();
function employeeById(id){return db.employees.find(e=>e.id===id)} function publicState(){return {employees:db.employees,customers:db.customers}} function broadcast(){io.emit('state',publicState())}
function nextEmployeeId(){let n=102; for(const e of db.employees){const m=String(e.id||'').match(/^EMP(\d+)$/);if(m)n=Math.max(n,Number(m[1]))} return 'EMP'+String(n+1)}
function clean(s){return String(s??'').trim().slice(0,500)}
io.on('connection',socket=>{
 socket.on('login',(p,cb)=>{p=p||{}; if(p.role==='owner'&&p.id==='SS'&&p.password==='ADMIN@12345'){const t=token();sessions.set(t,{role:'owner',id:'SS',socket:socket.id});return cb({ok:true,token:t,state:publicState()})} if(p.role==='employee'&&p.password==='SS@12345'){const e=employeeById(p.id);if(!e)return cb({ok:false,message:'Employee ID not found.'});const t=token();sessions.set(t,{role:'employee',id:e.id,socket:socket.id});return cb({ok:true,token:t,employee:e})} cb({ok:false,message:'Invalid ID or password.'})});
 socket.on('signup',(p,cb)=>{p=p||{};const name=clean(p.name),phone=clean(p.phone),area=clean(p.area);if(name.length<2)return cb({ok:false,message:'Name is required.'});const id=nextEmployeeId();const e={id,name,phone,status:'Offline',last:'—',cards:0,location:'Not sharing',lat:null,lng:null,accuracy:null,area,details:''};db.employees.push(e);save();broadcast();cb({ok:true,employee:e,password:'SS@12345'})});
 socket.on('getState',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='owner')return cb({ok:false,message:'Unauthorized'});cb({ok:true,state:publicState()})});
 socket.on('startWork',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='employee')return cb({ok:false,message:'Unauthorized'});const e=employeeById(s.id);e.status='Online';e.last=new Date().toLocaleString('en-IN');save();broadcast();cb({ok:true,employee:e})});
 socket.on('locationUpdate',p=>{const s=sessions.get(p?.token);if(!s||s.role!=='employee')return;const e=employeeById(s.id);e.lat=Number(p.lat);e.lng=Number(p.lng);e.accuracy=Number(p.accuracy||0);e.location=`${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;e.status='Online';e.last=new Date().toLocaleString('en-IN');save();broadcast()});
 socket.on('saveReport',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='employee')return cb({ok:false,message:'Unauthorized'});const e=employeeById(s.id);e.cards=Number(p.cards||0);e.area=clean(p.area);e.details=clean(p.details);e.last=new Date().toLocaleString('en-IN');save();broadcast();cb({ok:true,employee:e})});
 socket.on('addCustomer',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='employee')return cb({ok:false,message:'Unauthorized'});const name=clean(p.name),mobile=clean(p.mobile),abha=clean(p.abha),area=clean(p.area),status=clean(p.status)||'Completed',remarks=clean(p.remarks);if(!name)return cb({ok:false,message:'Customer name is required.'});const e=employeeById(s.id);const c={id:'CUS-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase(),employeeId:e.id,employeeName:e.name,name,mobile,abha,area,status,remarks,date:new Date().toLocaleString('en-IN')};db.customers.unshift(c);e.cards=db.customers.filter(x=>x.employeeId===e.id&&x.status==='Completed').length;e.last=c.date;save();broadcast();cb({ok:true,customer:c,employee:e})});
 socket.on('deleteCustomer',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='owner')return cb({ok:false,message:'Unauthorized'});db.customers=db.customers.filter(c=>c.id!==p.id);for(const e of db.employees)e.cards=db.customers.filter(c=>c.employeeId===e.id&&c.status==='Completed').length;save();broadcast();cb({ok:true})});
 socket.on('closeWork',(p,cb)=>{const s=sessions.get(p?.token);if(!s||s.role!=='employee')return cb({ok:false,message:'Unauthorized'});const e=employeeById(s.id);e.status='Offline';e.last=new Date().toLocaleString('en-IN');save();broadcast();cb({ok:true,employee:e})});
 socket.on('logout',p=>sessions.delete(p?.token)); socket.on('disconnect',()=>{for(const [t,s] of sessions)if(s.socket===socket.id)sessions.delete(t)});
});
app.get('/health',(req,res)=>res.json({ok:true,service:'SS ENTERPRISES ABHA REALTIME PORTAL'})); app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const PORT=process.env.PORT||3000; server.listen(PORT,()=>console.log('SS ENTERPRISES realtime portal on :'+PORT));
