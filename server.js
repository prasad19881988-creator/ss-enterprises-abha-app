const express=require("express");
const http=require("http");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});
app.use(express.json());
app.use(express.static(__dirname));

const DB=path.join(__dirname,"data.json");
const defaultDB={
  employees:[
    {id:"EMP101",name:"Dev Krishna Rai",phone:"",status:"Offline",last:"—",cards:0,location:"Not sharing",lat:null,lng:null,accuracy:null,area:"",details:""},
    {id:"EMP102",name:"Employee 2",phone:"",status:"Offline",last:"—",cards:0,location:"Not sharing",lat:null,lng:null,accuracy:null,area:"",details:""}
  ]
};
let db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,"utf8")):defaultDB;
function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function token(){return crypto.randomBytes(24).toString("hex")}
const sessions=new Map();

function employeeById(id){return db.employees.find(e=>e.id===id)}
function publicState(){return {employees:db.employees}}
function broadcast(){io.emit("state",publicState())}

io.on("connection",socket=>{
  socket.on("login",(p,cb)=>{
    if(p.role==="owner" && p.id==="SS" && p.password==="ADMIN@12345"){
      const t=token();sessions.set(t,{role:"owner",id:"SS",socket:socket.id});cb({ok:true,token:t,state:publicState()});return;
    }
    if(p.role==="employee" && p.password==="SS@12345"){
      const e=employeeById(p.id);
      if(!e){cb({ok:false,message:"Employee ID not found."});return}
      const t=token();sessions.set(t,{role:"employee",id:e.id,socket:socket.id});cb({ok:true,token:t,employee:e});return;
    }
    cb({ok:false,message:"Invalid ID or password."});
  });

  socket.on("getState",(p,cb)=>{
    const s=sessions.get(p.token);
    if(!s||s.role!=="owner"){cb({ok:false,message:"Unauthorized"});return}
    cb({ok:true,state:publicState()});
  });

  socket.on("startWork",(p,cb)=>{
    const s=sessions.get(p.token); if(!s||s.role!=="employee"){cb({ok:false,message:"Unauthorized"});return}
    const e=employeeById(s.id);e.status="Online";e.last=new Date().toLocaleString("en-IN");save();broadcast();cb({ok:true,employee:e});
  });

  socket.on("locationUpdate",(p)=>{
    const s=sessions.get(p.token); if(!s||s.role!=="employee")return;
    const e=employeeById(s.id);
    e.lat=Number(p.lat);e.lng=Number(p.lng);e.accuracy=Number(p.accuracy||0);
    e.location=`${e.lat.toFixed(5)}, ${e.lng.toFixed(5)} (±${Math.round(e.accuracy)}m)`;
    e.status="Online";e.last=new Date().toLocaleString("en-IN");
    save();broadcast();io.emit("employeeUpdate",{state:publicState()});
  });

  socket.on("saveReport",(p,cb)=>{
    const s=sessions.get(p.token); if(!s||s.role!=="employee"){cb({ok:false,message:"Unauthorized"});return}
    const e=employeeById(s.id);e.cards=Number(p.cards||0);e.area=String(p.area||"");e.details=String(p.details||"");e.last=new Date().toLocaleString("en-IN");save();broadcast();cb({ok:true,employee:e});
  });

  socket.on("closeWork",(p,cb)=>{
    const s=sessions.get(p.token); if(!s||s.role!=="employee"){cb({ok:false,message:"Unauthorized"});return}
    const e=employeeById(s.id);e.status="Offline";e.last=new Date().toLocaleString("en-IN");e.location=e.lat&&e.lng?e.location:"Not sharing";save();broadcast();cb({ok:true,employee:e});
  });

  socket.on("logout",(p)=>{sessions.delete(p.token)});
  socket.on("disconnect",()=>{for(const [t,s] of sessions){if(s.socket===socket.id) sessions.delete(t)}});
});

app.get("/health",(req,res)=>res.json({ok:true,service:"SS ENTERPRISES ABHA REALTIME PORTAL"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`SS ENTERPRISES realtime portal on :${PORT}`));
