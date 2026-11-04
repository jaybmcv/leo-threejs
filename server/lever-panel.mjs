import {PANEL,panelDeck,panelDoor,panelInside,panelFront,panelBack,panelApproach} from '../src/walk/net/panel-rules.js';

// One puzzle per live ship, kept in memory. Poses are trusted as elsewhere aboard; this is a puzzle, not a lock.
export function createSharedPanel({everyone,broadcast,clock=()=>Date.now()}){
 const seen=new WeakMap();
 let phase='sealed',levers=[0,0,0,0,0],owner=null,entered=false,until=0,wait=0,delay=0,down=0;
 const state=()=>({m:'panel',phase,levers:[...levers],owner,down});
 const tell=()=>broadcast(state());
 const clear=()=>{owner=null;entered=false;until=0;};
 const seal=()=>{phase='sealed';levers.fill(0);delay=0;};
 const open=exit=>{phase=exit?'exit':'open';wait=clock()+PANEL.wait*1000;delay=exit?.2:.6;};
 function observe(v){
  const now=clock();seen.set(v,now);
  if(phase==='open'&&down>=.85&&!owner&&panelApproach(v.pos)){
   owner=v.id;until=now+PANEL.wait*1000;tell();
  }
  if(v.id!==owner)return;
  if(panelInside(v.pos)){entered=true;until=now+PANEL.recovery*1000;}
  else if(entered&&(!panelDeck(v.pos)||v.pos[0]>PANEL.outside)){clear();seal();tell();}
 }
 return {
  state,observe,
  message(v,msg){
   if(msg.op==='flip'&&phase==='sealed'&&!owner&&down===0&&panelFront(v.pos)&&Number.isInteger(msg.i)&&msg.i>=0&&msg.i<5){
    let i=0;for(let k=1;k<5;k++)if(Math.abs(v.pos[2]-PANEL.levers[k])<Math.abs(v.pos[2]-PANEL.levers[i]))i=k;
    if(i!==msg.i)return;
    levers[i]^=1;if(levers.every((on,k)=>on===PANEL.code[k]))open(false);tell();
   }else if(msg.op==='exit'&&panelBack(v.pos)){
    // Anyone stranded inside, including a reconnect, can always leave.
    if(!owner){owner=v.id;entered=true;until=clock()+PANEL.recovery*1000;}
    if(phase!=='exit'){open(true);tell();}
   }
  },
  left(v){seen.delete(v);if(owner===v.id){clear();seal();tell();}},
  tick(dt){
   const before=JSON.stringify(state()),now=clock(),people=[...everyone()].filter(v=>v.ready&&v.pos);
   const blocked=people.some(v=>now-(seen.get(v)??-Infinity)<PANEL.recovery*1000&&panelDoor(v.pos));
   if(owner&&(now>=until||!people.some(v=>v.id===owner))){clear();seal();}
   if(phase==='open'||phase==='exit'){
    delay-=dt;if(delay<=0)down=Math.min(1,down+dt/PANEL.sink);
    if(down===1&&!blocked&&((phase==='open'&&entered)||now>=wait||(phase==='exit'&&!owner)))seal();
   }else if(!blocked)down=Math.max(0,down-dt/PANEL.rise);
   if(before!==JSON.stringify(state()))tell();
  },
 };
}
