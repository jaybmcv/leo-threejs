import {WireReader,PROTOCOL} from './wire.js';

// The page's link to Leo live (server/leo-live.mjs). It says hello with this browser's key and name, sends the
// walker's pose ten times a second (a pose that has not changed only every two seconds, to say they are still here),
// passes lift calls on, and hands everything that comes back to the page. If the server cannot be reached the page
// carries on alone, and the link keeps trying, waiting longer each time.
const SEND_MS=100,STILL_MS=2000,RETRY_MS=[1000,2000,5000,10000,30000];

function storage(key,make){try{let v=localStorage.getItem(key);if(!v&&make){v=make();localStorage.setItem(key,v);}return v;}catch{return make?make():null;}}
// A random key, kept by this browser; the server derives the visitor's id from it (wire.js actorIdOf).
const browserKey=()=>storage('leo-live-key',()=>[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join(''));
export const savedName=()=>storage('leo-live-name')||'';
export function saveName(name){try{localStorage.setItem('leo-live-name',name);}catch{}}

// on: {status(s), welcome(msg), poses(list), gone(id), lift(id,state), aboard(n)}; status is 'connecting', 'live',
// 'offline', 'full' or 'replaced' (this visitor opened Leo in another tab).
export function connectLive(url,on){
 const reader=new WireReader(),key=browserKey();
 let ws=null,tries=0,stopped=false,last='',lastAt=0,sentAt=0,name=savedName(),id=null;
 const status=s=>on.status?.(s);
 function open(){
  if(stopped)return;status('connecting');
  try{ws=new WebSocket(url);}catch{retry();return;}
  ws.binaryType='arraybuffer';
  ws.onopen=()=>ws.send(JSON.stringify({m:'hello',v:PROTOCOL,key,name}));
  ws.onmessage=e=>{
   if(e.data instanceof ArrayBuffer){const poses=reader.read(e.data);if(poses.length)on.poses?.(poses.filter(p=>p.id!==id));return;}
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   switch(msg.m){
    case 'welcome':tries=0;id=msg.id;last='';status('live');on.welcome?.(msg);on.aboard?.(msg.aboard);break;
    case 'gone':on.gone?.(msg.id);break;
    case 'lift':on.lift?.(msg.id,msg.s);break;
    case 'aboard':on.aboard?.(msg.n);break;
    case 'full':stopped=true;status('full');break;
    case 'replaced':stopped=true;status('replaced');break;
    case 'reload':stopped=true;status('offline');break;
   }
  };
  ws.onclose=()=>{reader.reset();id=null;on.reset?.();if(!stopped)retry();};
  ws.onerror=()=>{};
 }
 function retry(){status('offline');setTimeout(open,RETRY_MS[Math.min(tries++,RETRY_MS.length-1)]);}
 const live=()=>ws&&ws.readyState===1&&id;
 open();
 return {
  get id(){return id;},
  // The walker's pose: {pos, yaw, g, st, jc, js, r, e, rest}. Sent at most ten times a second.
  pose(p,now=performance.now()){
   if(!live()||now-sentAt<SEND_MS)return;
   const text=JSON.stringify({m:'pose',p});
   // Unchanged to the centimetre and the degree: only a keepalive now and then.
   const same=JSON.stringify([p.pos.map(v=>Math.round(v*100)),Math.round(p.yaw*57),p.g,p.st,p.jc,p.e,p.rest]);
   if(same===last&&now-lastAt<STILL_MS)return;
   last=same;lastAt=now;sentAt=now;ws.send(text);
  },
  call(lift,stop,now){if(live())ws.send(JSON.stringify({m:'call',lift,stop,now:!!now}));},
  rename(next){name=next;saveName(next);if(live())ws.send(JSON.stringify({m:'name',name:next}));},
  get live(){return !!live();},
  close(){stopped=true;ws?.close();},
 };
}
