// The Mars Cat Transporters on Deck 1 (src/walk/transporter.js): six carts everyone aboard shares. Leo live
// (leo-live.mjs) passes their messages here. It keeps who drives each cart, so only one visitor at a time has its
// driver's seat, and where each was last parked, so every page draws them in the same places. While someone drives,
// others see the cart under their seated body (their pose); the server only hears where it is once a second, in case
// the driver leaves the ship mid-drive, when the cart stays parked there. Once a day, at RESET_HOUR (this machine's
// local time, the hour of the nightly deploy), every cart nobody is driving goes home to its bay; a restart sends them
// all home too, as the carts live in memory only.
//
// Messages from a page, {m:'mct', e, i, ...}:
//   take  i            climb into cart i's driver's seat: theirs if nobody else has it (one cart each)
//   at    i, at, yaw   where their cart is now (sent once a second while driving)
//   park  i, at, yaw   out of the driver's seat: the cart stays parked there
// and to every page, in the welcome and whenever a cart changes hands:
//   {m:'mcts', carts:[{d, at, yaw}]}   d: the driver's id or null; at: [x,y,z] where it is parked, or null at home
export const CARTS=6,RESET_HOUR=Number(process.env.LEO_LIVE_MCT_RESET_HOUR??4);
// Deck 1's floor, generously: a cart is never anywhere else.
const DECK1={x:[-220,250],y:[-40.5,-38.9],z:[-80,80]};

export function createTransporters({log,broadcast,send,now=()=>new Date(),resetHour=RESET_HOUR}){
 const carts=Array.from({length:CARTS},()=>({v:null,at:null,yaw:null}));
 // The day a reset belongs to: it changes at resetHour, local time.
 const day=t=>{const d=new Date(t.getTime()-resetHour*3600e3);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;};
 let lastDay=day(now());
 const state=()=>carts.map(c=>({d:c.v?c.v.id:null,at:c.at,yaw:c.yaw}));
 const tell=()=>broadcast({m:'mcts',carts:state()});
 const place=(c,msg)=>{const a=msg.at;if(!Array.isArray(a)||a.length!==3||!a.every((n,k)=>typeof n==='number'&&n>=DECK1['xyz'[k]][0]&&n<=DECK1['xyz'[k]][1])||typeof msg.yaw!=='number'||!Number.isFinite(msg.yaw)||Math.abs(msg.yaw)>1e3)return false;
  c.at=a.map(n=>Math.round(n*100)/100);c.yaw=Math.round(msg.yaw*1000)/1000;return true;};
 return {
  state,
  message(v,msg){
   const i=msg.i,c=Number.isInteger(i)&&i>=0&&i<CARTS?carts[i]:null;if(!c)return;
   if(msg.e==='take'){
    // Somebody has it already (perhaps the asker): the asker hears who.
    if(c.v){send(v,{m:'mcts',carts:state()});return;}
    for(const o of carts)if(o.v===v)o.v=null;
    c.v=v;log('mct take',i+1,v.id,JSON.stringify(v.name||''));tell();
   }else if(msg.e==='at'){if(c.v===v)place(c,msg);}
   else if(msg.e==='park'){if(c.v!==v)return;place(c,msg);c.v=null;log('mct park',i+1,v.id,JSON.stringify(c.at));tell();}
  },
  // A visitor gone (or replaced by their second tab): their cart stays where they last had it.
  left(v){let any=false;for(const c of carts)if(c.v===v){c.v=null;any=true;}if(any)tell();},
  // Called every few seconds: the daily reset.
  tick(){
   const d=day(now());if(d===lastDay)return;lastDay=d;
   let n=0;for(const c of carts)if(!c.v&&c.at){c.at=null;c.yaw=null;n++;}
   log('mct reset',n,'carts home');if(n)tell();
  },
 };
}
