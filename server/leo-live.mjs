// Leo live: the multiplayer server for walk mode (src/walk/walk.html). One process is one shuttle: everyone connected
// walks the same Leo. It passes poses on and runs the lifts, nothing else; the ship itself is static and every visitor
// builds it in their own browser. Modelled on Voyager's Reach's authority (packages/server: pose fan-out by distance,
// poses as bytes, the visitor's id proved by a key their browser keeps), cut down to what a walk needs.
//
//   node server/leo-live.mjs          (or npm run live)
//   PORT=8090                         where it listens; the websocket is at /live, a health check at /health
//   LEO_LIVE_MAX=150                  most visitors at once; the next is told the ship is full
//   LEO_LIVE_ORIGINS=...              pages allowed to connect, comma separated; a * stands for any port
//
// Movement is trusted from the client, as in Reach: the server checks that a pose is well formed and inside the ship,
// and limits how often anyone may send. Lifts are the server's: a call goes to the server, which steps every car
// (lift-motion.js) and tells everyone when a car's plans change.
import http from 'node:http';
import {WebSocketServer} from 'ws';
import {LIFTS} from '../src/walk/lifts.js';
import {liftState,callLift,stepLift,liftWire} from '../src/walk/lift-motion.js';
import {encodeRecord,encodeIdentity,assembleFrame,actorIdOf,cleanName,PROTOCOL,STANCES} from '../src/walk/net/wire.js';

const PORT=Number(process.env.PORT||8090),MAX=Number(process.env.LEO_LIVE_MAX||150);
const ORIGINS=(process.env.LEO_LIVE_ORIGINS||'https://leo.marscatsvoyage.com,http://localhost:*,http://127.0.0.1:*').split(',').map(o=>o.trim()).filter(Boolean)
 .map(o=>new RegExp('^'+o.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:\*$/,'(:\\d+)?')+'$'));
const FLUSH_MS=50,FAR_MS=500,KEEPALIVE_MS=2000,HELLO_MS=5000,PING_MS=25000,SLOW_BYTES=256*1024,SLOW_MS=5000;
// Near: on the same or the next deck and within 64 m, every flush; anyone else twice a second.
const NEAR_DY=9,NEAR_M=64;
// The ship's bounds, generously: a pose outside them is not a pose from this page.
const BOUNDS={x:[-400,400],y:[-80,200],z:[-200,200]};
const BUDGETS={pose:[20,25],call:[3,6],name:[.5,3],ping:[1,4]};

const visitors=new Set();
const slots=new Map();let nextSlot=1;
const lifts=LIFTS.map(spec=>({spec,stops:spec.stops,state:liftState(spec),sent:''}));
const log=(...a)=>console.log(new Date().toISOString(),...a);

function send(ws,msg){if(ws.readyState===1)ws.send(typeof msg==='string'||msg instanceof Uint8Array?msg:JSON.stringify(msg));}
function broadcast(msg,except){const text=JSON.stringify(msg);for(const v of visitors)if(v.ready&&v!==except)send(v.ws,text);}
function takeSlot(){for(let i=0;i<0xffff;i++){const s=nextSlot;nextSlot=nextSlot%0xfffe+1;if(!slots.has(s))return s;}return 0;}
// A token bucket per message kind: [refill per second, burst].
function allowed(v,kind){
 const [rate,burst]=BUDGETS[kind],b=v.budget[kind]||(v.budget[kind]={tokens:burst,at:Date.now()}),now=Date.now();
 b.tokens=Math.min(burst,b.tokens+(now-b.at)/1000*rate);b.at=now;if(b.tokens<1)return false;b.tokens-=1;return true;
}
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
// The pose a client sends, checked and made into one record (encoded once, copied into every frame that carries it).
function readPose(v,p){
 if(!p||!Array.isArray(p.pos)||p.pos.length!==3)return false;
 const [x,y,z]=p.pos;if(!finite(x,...BOUNDS.x)||!finite(y,...BOUNDS.y)||!finite(z,...BOUNDS.z)||!finite(p.yaw,-1e3,1e3))return false;
 const pose={pos:[x,y,z],yaw:p.yaw,grounded:!!p.g,stance:STANCES.includes(p.st)?p.st:'stand',jumpCount:finite(p.jc,0,3)?Math.round(p.jc):0,
  jumpS:finite(p.js,-1,60)?p.js:-1,rise:finite(p.r,-100,100)?p.r:0,emote:typeof p.e==='string'&&/^[a-z0-9_]{1,32}$/.test(p.e)?p.e:null,rest:p.rest==='sit'||p.rest==='lie'?p.rest:null};
 try{v.record=encodeRecord(v.slot,pose);}catch{return false;}
 v.pos=pose.pos;v.version++;return true;
}

async function hello(v,msg){
 if(msg.v!==PROTOCOL){send(v.ws,{m:'reload'});v.ws.close(4000,'old page');return;}
 const id=await actorIdOf(typeof msg.key==='string'?msg.key:'');
 if(!id){v.ws.close(4001,'no key');return;}
 // One body per visitor: the same browser in a second tab takes over from the first.
 for(const o of visitors)if(o.id===id&&o!==v){send(o.ws,{m:'replaced'});o.ws.close(4002,'replaced');leave(o);}
 if([...visitors].filter(o=>o.ready).length>=MAX){send(v.ws,{m:'full'});v.ws.close(4003,'full');return;}
 v.slot=takeSlot();if(!v.slot){v.ws.close(4003,'full');return;}
 Object.assign(v,{id,name:cleanName(msg.name)||null,ready:true});slots.set(v.slot,v);
 send(v.ws,{m:'welcome',id,aboard:aboard(),lifts:lifts.map(l=>({id:l.spec.id,s:liftWire(l.state)}))});
 countChanged=true;log('aboard',aboard(),'+',id,v.name||'');
}
function leave(v){
 if(!visitors.delete(v))return;
 if(v.slot)slots.delete(v.slot);
 if(v.ready){broadcast({m:'gone',id:v.id});countChanged=true;log('aboard',aboard(),'-',v.id);}
}
const aboard=()=>{let n=0;for(const v of visitors)if(v.ready)n++;return n;};
let countChanged=false;

function onMessage(v,data,binary){
 if(binary||data.length>1024){v.ws.close(1009,'too big');return;}
 let msg;try{msg=JSON.parse(data);}catch{return;}
 if(!msg||typeof msg.m!=='string')return;
 if(!v.ready){if(msg.m==='hello'&&!v.helloSeen){v.helloSeen=true;hello(v,msg).catch(()=>v.ws.close(1011,'hello failed'));}return;}
 switch(msg.m){
  case 'pose':if(allowed(v,'pose'))readPose(v,msg.p);break;
  case 'name':if(allowed(v,'name')){v.name=cleanName(msg.name)||null;v.nameVersion=(v.nameVersion||0)+1;}break;
  case 'call':{
   if(!allowed(v,'call'))break;
   const l=lifts.find(l=>l.spec.id===msg.lift);if(!l||!Number.isInteger(msg.stop)||msg.stop<0||msg.stop>=l.stops.length)break;
   callLift(l.state,msg.stop,{now:!!msg.now});liftChanged(l,true);break;
  }
  case 'ping':if(allowed(v,'ping'))send(v.ws,{m:'pong',t:msg.t});break;
 }
}

// A car's plans as everyone last heard them; told again whenever they change, and once a second while it moves, so a
// page that steps it a little differently never drifts far.
function liftChanged(l,force){
 const s=l.state,key=`${s.phase}|${s.at}|${s.target}|${[...s.calls].sort()}`,now=Date.now();
 if(!force&&key===l.sent&&!(s.phase==='moving'&&now-l.sentAt>1000))return;
 l.sent=key;l.sentAt=now;broadcast({m:'lift',id:l.spec.id,s:liftWire(s)});
}

// Every flush: step the lifts, then send each visitor the poses due to them.
let last=Date.now();
function flush(){
 const now=Date.now(),dt=Math.min(.25,(now-last)/1000);last=now;
 for(const l of lifts){stepLift(l.state,l.stops,dt);liftChanged(l,false);}
 if(countChanged){countChanged=false;broadcast({m:'aboard',n:aboard()});}
 for(const r of visitors){
  if(!r.ready)continue;
  if(r.ws.bufferedAmount>SLOW_BYTES){if(!r.slowSince)r.slowSince=now;else if(now-r.slowSince>SLOW_MS){r.ws.close(4004,'too slow');leave(r);}continue;}
  r.slowSince=0;
  const identities=[],records=[];
  for(const o of visitors){
   if(o===r||!o.ready||!o.record)continue;
   const seen=r.seen.get(o.slot),near=r.pos&&Math.abs(o.pos[1]-r.pos[1])<NEAR_DY&&Math.hypot(o.pos[0]-r.pos[0],o.pos[2]-r.pos[2])<NEAR_M;
   const fresh=!seen||seen.id!==o.id;
   const due=fresh||(seen.version!==o.version&&(near||now-seen.at>=FAR_MS))||now-seen.at>=KEEPALIVE_MS;
   if(!due)continue;
   if(fresh||seen.nameVersion!==(o.nameVersion||0))identities.push(encodeIdentity(o.slot,o.id,o.name));
   records.push(o.record);r.seen.set(o.slot,{id:o.id,version:o.version,at:now,nameVersion:o.nameVersion||0});
  }
  if(records.length)send(r.ws,assembleFrame(identities,records));
 }
}
setInterval(flush,FLUSH_MS);

const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:true,aboard:aboard(),max:MAX}));return;}
 res.writeHead(200,{'Content-Type':'text/plain'});res.end('Leo live: the multiplayer server for Walk around Leo.\n');
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 const origin=req.headers.origin||'';
 if(new URL(req.url,'http://x').pathname!=='/live'||!ORIGINS.some(o=>o.test(origin))){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
 const v={ws,ready:false,id:null,slot:0,name:null,record:null,pos:null,version:0,seen:new Map(),budget:{},alive:true};visitors.add(v);
 const timer=setTimeout(()=>{if(!v.ready)ws.close(4005,'no hello');},HELLO_MS);
 ws.on('message',(data,binary)=>onMessage(v,binary?data:data.toString(),binary));
 ws.on('pong',()=>{v.alive=true;});
 ws.on('close',()=>{clearTimeout(timer);leave(v);});
 ws.on('error',()=>{});
});
// Behind a tunnel an idle socket is cut after a couple of minutes; a ping keeps it open, and one never answered ends it.
setInterval(()=>{for(const v of visitors){if(!v.alive){v.ws.terminate();leave(v);continue;}v.alive=false;v.ws.ping();}},PING_MS);
server.listen(PORT,()=>log(`Leo live on :${PORT} (/live, /health), up to ${MAX} aboard`));
export {server};
