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

// on: {status(s), welcome(msg), poses(list), gone(id), lift(id,state), mark(id,at), aboard(n), board(b), scored(r), hearts(h), hearted(r), selfie(id,ms),
// giveaway(g), claimed(r), clown(r), chat(line), said(r), wall(w), stroke(s), painted(r), gym(msg), mcts(carts), tv(t), tvTicket(r)}; status
// is 'connecting', 'live',
// 'offline', 'full' or 'replaced' (this visitor opened Leo in another tab). opts.pass(): a Leo pass for this
// (re)connection or null (connect.js); opts.refused(): the server would not take it; opts.invite: the invite code the
// page was opened with; opts.hat(): whether this visitor wears the captain's hat (a tester).
// The server's web address, from its websocket's: wss://host/live is https://host (the TV's uploads and video, tv.mjs).
export const httpBase=url=>url.replace(/^ws(s?):\/\//,'http$1://').replace(/\/live\/?$/,'');
export function connectLive(url,on,opts={}){
 const reader=new WireReader(),key=browserKey();
 let ws=null,tries=0,stopped=false,last='',lastAt=0,sentAt=0,name=savedName(),id=null,you=null,sentPass=false,refused=false;
 const status=s=>on.status?.(s);
 function open(){
  if(stopped)return;status('connecting');
  const pass=opts.pass?opts.pass().catch(()=>null):Promise.resolve(null);
  try{ws=new WebSocket(url);}catch{retry();return;}
  ws.binaryType='arraybuffer';
  ws.onopen=async()=>{const p=await pass;sentPass=!!p;if(ws.readyState===1)ws.send(JSON.stringify({m:'hello',v:PROTOCOL,key,name,hat:!!opts.hat?.(),...(p?{pass:p,invite:opts.invite||undefined}:{})}));};
  ws.onmessage=e=>{
   if(e.data instanceof ArrayBuffer){const poses=reader.read(e.data);if(poses.length)on.poses?.(poses.filter(p=>p.id!==id));return;}
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   switch(msg.m){
    case 'welcome':
     tries=0;id=msg.id;last='';you=msg.you||null;status('live');on.welcome?.(msg);on.aboard?.(msg.aboard);
     // A pass the server would not take (an old key, or one from another Creamery): drop it and come back once with
     // a fresh one.
     if(sentPass&&!you?.verified&&!refused){refused=true;opts.refused?.();ws.close();}
     break;
    case 'gone':on.gone?.(msg.id);break;
    case 'lift':on.lift?.(msg.id,msg.s);break;
    case 'mark':on.mark?.(msg.id,msg.at);break;
    case 'aboard':on.aboard?.(msg.n);break;
    // The leaderboards (Alien Cat Invasion's, or Paw Pool's when game is 'pool'): the top ten and this visitor's
    // best, and a game's result.
    case 'board':on.board?.(msg);break;
    case 'scored':on.scored?.(msg);break;
    // The Container Maze's board and a run's result (server/maze.mjs).
    case 'maze':on.maze?.(msg);break;
    case 'treasure':on.treasure?.(msg);break;
    // The ship log boards (walk/changes-board.js): every change's hearts (and this visitor's own), and a heart refused.
    case 'hearts':on.hearts?.(msg);break;
    case 'hearted':on.hearted?.(msg);break;
    // Someone at the selfie booth started its countdown (walk/selfie.js): the photo is due in ms.
    case 'selfie':if(Number.isFinite(msg.ms))on.selfie?.(msg.id,Math.min(5000,Math.max(0,msg.ms)));break;
    // Mudwater Arena's giveaway (server/arena.mjs): its state for this visitor, and the answer to a claim.
    case 'giveaway':on.giveaway?.(msg);break;
    case 'claimed':on.claimed?.(msg);break;
    // Deck 15's Halloween clown (walk/halloween.js): the badge code, or null while there isn't one.
    case 'clown':on.clown?.(msg);break;
    // Chat aboard (walk/chat.js): a line someone said (this visitor's own included), and a line of ours refused.
    case 'chat':if(typeof msg.text==='string'&&typeof msg.id==='string')on.chat?.(msg);break;
    case 'said':on.said?.(msg);break;
    // The Deck 19 graffiti wall (walk/graffiti.js): the whole wall, someone else's stroke, and a stroke of ours refused.
    case 'wall':if(typeof msg.cells==='string')on.wall?.(msg);break;
    case 'stroke':on.stroke?.(msg);break;
    case 'painted':on.painted?.(msg);break;
    // Paws Off's gym round on the treadmills (server/gym.mjs): its countdown, its start, someone out, the results.
    case 'gym':if(typeof msg.e==='string')on.gym?.(msg);break;
    // The Deck 1 transporters (walk/transporter.js): who drives each cart and where each is parked.
    case 'mcts':if(Array.isArray(msg.carts))on.mcts?.(msg.carts);break;
    // The Crown lounge TV (server/tv.mjs): what is on it, and a ticket to upload a video (or why not).
    case 'tv':on.tv?.(msg);break;
    case 'tv-ticket':on.tvTicket?.(msg);break;
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
   const same=JSON.stringify([p.pos.map(v=>Math.round(v*100)),Math.round(p.yaw*57),p.g,p.st,p.jc,p.e,p.rest,p.pl]);
   if(same===last&&now-lastAt<STILL_MS)return;
   last=same;lastAt=now;sentAt=now;ws.send(text);
  },
  call(lift,stop,now){if(live())ws.send(JSON.stringify({m:'call',lift,stop,now:!!now}));},
  // A ping where the walker stands, for everyone else aboard (walk/marks.js).
  mark(at){if(live())ws.send(JSON.stringify({m:'mark',at}));},
  // Alien Cat Invasion, or Paw Pool with game 'pool': a game starts (the server times it), a game's score, and a
  // request for the board.
  play(game){if(live())ws.send(JSON.stringify({m:'play',game}));},
  score(score,wave){if(live())ws.send(JSON.stringify({m:'score',score,wave}));},
  board(game){if(live())ws.send(JSON.stringify({m:'board',game}));},
  // Paw Pool: a rack cleared, in ms by the page's clock, and the kicks it took.
  cleared(ms,shots){if(live())ws.send(JSON.stringify({m:'score',game:'pool',ms,shots}));},
  // The Container Maze: a run starts ('start'), ends at the button ('finish', {ms}), or the board is wanted ('board').
  maze(op,extra={}){if(live())ws.send(JSON.stringify({m:'maze',op,...extra}));},
  treasure(op,extra={}){if(live())ws.send(JSON.stringify({m:'treasure',op,...extra}));},
  // The ship log boards: ask for the hearts; give (on) or take back a heart for a change.
  hearts(){if(live())ws.send(JSON.stringify({m:'hearts'}));},
  heart(change,on){if(live())ws.send(JSON.stringify({m:'heart',change,on:!!on}));},
  // The selfie camera pressed: everyone near the booth counts down with us.
  selfie(){if(live())ws.send(JSON.stringify({m:'selfie'}));},
  // Mudwater Arena: ask for the giveaway's state, claim a pack (to one of this visitor's verified wallets in wallet
  // mode), and count an arena event ('enter', 'play' or 'card').
  giveaway(){if(live())ws.send(JSON.stringify({m:'giveaway'}));},
  claim(wallet){if(live())ws.send(JSON.stringify({m:'claim',...(wallet?{wallet}:{})}));},
  arena(e){if(live())ws.send(JSON.stringify({m:'arena',e}));},
  // Knocked on the Halloween clown's glass: ask for the badge code; false when there is no connection to ask on.
  clown(){if(!live())return false;ws.send(JSON.stringify({m:'clown'}));return true;},
  // A line of chat for everyone aboard; false when there is no connection to say it on.
  say(text){if(!live())return false;ws.send(JSON.stringify({m:'chat',text}));return true;},
  // The graffiti wall: ask for it (and its strokes from then on), and spray one stroke {c, s, p}.
  wall(){if(live())ws.send(JSON.stringify({m:'wall'}));},
  paint(stroke){if(!live())return false;ws.send(JSON.stringify({m:'paint',...stroke}));return true;},
  // Paws Off's gym round: stepped on ('in'), fell, stepped off; false when there is no connection to send it on.
  gym(msg){if(!live())return false;ws.send(JSON.stringify({...msg,m:'gym'}));return true;},
  // The Deck 1 transporters: take a driver's seat, say where the cart is, park it; false when there is no connection.
  mct(msg){if(!live())return false;ws.send(JSON.stringify({...msg,m:'mct'}));return true;},
  // The Crown lounge TV: ask what is on it, ask for a ticket to upload a video, and (an owner) take it down.
  tv(){if(live())ws.send(JSON.stringify({m:'tv'}));},
  tvTicket(){if(!live())return false;ws.send(JSON.stringify({m:'tv-ticket'}));return true;},
  tvDown(){if(live())ws.send(JSON.stringify({m:'tv-down'}));},
  rename(next){name=next;saveName(next);if(live())ws.send(JSON.stringify({m:'name',name:next}));},
  get live(){return !!live();},
  // How the server has this visitor: {name, verified}.
  get you(){return you;},
  close(){stopped=true;ws?.close();},
 };
}
