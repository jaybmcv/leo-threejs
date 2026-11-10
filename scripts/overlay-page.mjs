// A stand-in page for the walk's full-window games (walk/invasion/game.js, walk/pool/game.js), enough to open one in
// Node and run its frames by hand. Every element and canvas call does nothing; the lettering each frame draws is kept
// (drawn); the frame loop is run by the check (frame(), a tenth of a second of play each time); and timers of a second
// or more are held for the check to fire (timers: {f, ms, cancelled}), so nothing here waits on a real clock.
export function overlayPage(){
 const drawn=[],timers=[],saved={};let loop=null,now=performance.now();
 const stub=()=>new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='then'?undefined:(t[k]??=stub()),set:(t,k,v)=>{t[k]=v;return true;},apply:()=>stub(),construct:()=>stub()});
 const element=()=>{const e=stub(),g=stub();g.fillText=s=>{drawn.push(String(s));};e.getContext=()=>g;return e;};
 const page=stub();page.createElement=element;page.hidden=false;
 const globals={document:page,matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},requestAnimationFrame:f=>{loop=f;return 1;},cancelAnimationFrame(){},
  innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  setTimeout:(f,ms,...a)=>{if(!(ms>=1000))return saved.setTimeout(f,ms,...a);const t={f,ms,held:true,cancelled:false};timers.push(t);return t;},
  clearTimeout:t=>{if(t?.held)t.cancelled=true;else saved.clearTimeout(t);}};
 for(const k of Object.keys(globals)){saved[k]=globalThis[k];globalThis[k]=globals[k];}
 return {drawn,timers,
  // The open game's next frame, and what it wrote.
  frame(){drawn.length=0;now=Math.max(now,performance.now())+200;loop?.(now);return drawn;},
  restore(){for(const k of Object.keys(globals)){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}},
 };
}
