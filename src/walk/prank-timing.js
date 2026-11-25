// Wall-clock timers release the visitor even if drawing stops in a hidden tab.
export const PRANK_TIME={photo:2500,release:3000,reset:7000,mess:300000};
export function createPrankTiming(hooks,{now=Date.now,set=setTimeout,clear=clearTimeout}={}){
 let started=0,locked=false,cooling=false,messUntil=0,timers=[],cleanTimer=null;
 const release=()=>{if(!locked)return;locked=false;hooks.release();};
 const cancel=()=>{for(const t of timers)clear(t);timers=[];try{release();}finally{cooling=false;hooks.reset();}};
 const safe=fn=>()=>{try{fn();}catch(error){cancel();hooks.error?.(error);}};
 return {
  get locked(){return locked;},get cooling(){return cooling;},get messy(){return messUntil>now();},get messUntil(){return messUntil;},
  get elapsed(){return (now()-started)/1000;},get shocked(){return messUntil>now()&&now()-started<6000;},
  start(){if(cooling)return false;started=now();locked=cooling=true;messUntil=started+PRANK_TIME.mess;clear(cleanTimer);
   cleanTimer=set(safe(()=>{messUntil=0;hooks.clean();}),PRANK_TIME.mess);
   try{hooks.begin();started=now();messUntil=started+PRANK_TIME.mess;clear(cleanTimer);cleanTimer=set(safe(()=>{messUntil=0;hooks.clean();}),PRANK_TIME.mess);
    timers=[set(safe(hooks.photo),PRANK_TIME.photo),set(safe(release),PRANK_TIME.release),set(safe(()=>{cooling=false;hooks.reset();timers=[];}),PRANK_TIME.reset)];}
   catch(error){cancel();hooks.error?.(error);return false;}return true;
  },cancel,
  dispose(){try{cancel();}finally{clear(cleanTimer);messUntil=0;hooks.clean();}},
 };
}
