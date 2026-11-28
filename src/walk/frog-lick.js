// Halfway from the 6.5 m seating arc about (108, 30) to the stage front at X 106.
export const FROG_AT=[103.75,-19.7,30],FROG_BODY_Y=.35,FROG_LICK_MS=3700,FROG_LEASE_MS=FROG_LICK_MS+900;
export const FROG_CUES={take:.76,face:1.34,lick:1.7,lower:2.72,release:3.24};
export function frogInReach(x,y,z){
 return Math.abs(y-FROG_AT[1])<.12&&Math.hypot(x-FROG_AT[0],z-FROG_AT[2])<.91;
}
const clamp=x=>Math.max(0,Math.min(1,x));
export function frogEase(t,from,to){const x=clamp((t-from)/(to-from));return x*x*(3-2*x);}
export function frogFrame(hold,t){
 const {take,face,lick,lower,release}=FROG_CUES;
 const yaw=Math.atan2(FROG_AT[0]-hold.at[0],FROG_AT[2]-hold.at[2]),d=yaw-hold.yaw;
 return {...hold,t,yaw:hold.yaw+Math.atan2(Math.sin(d),Math.cos(d))*frogEase(t,0,.44),
  held:t>=take&&t<release,phase:t<take?'reach':t<face?'lift':t<lick?'look':t<lower?'lick':'return'};
}
export function createFrogLick({startTrip,send,now=()=>performance.now()}){
 let local=null,remote=null,serial=0;
 const frame=(hold,at)=>hold&&at-hold.started<FROG_LICK_MS?frogFrame(hold,(at-hold.started)/1000):null;
 function cancel(){
  const request=local?.request;local=null;
  if(request)send('end',request);
 }
 return {
  get locked(){return !!local;},
  get busy(){return !!remote&&now()-remote.started<FROG_LEASE_MS;},
  local:(at=now())=>local&&!local.pending?frame(local,at):null,
  remote:(at=now())=>frame(remote,at),
  start(at,yaw,online){
   if(local||this.busy)return false;
   const request=online?++serial:0;
   if(online&&!send('take',request))return false;
   local={at,yaw,started:now(),request,pending:online};return true;
  },
  hear({hold,refused},ownId){
   if(refused!==undefined){if(local?.pending&&local.request===refused)local=null;return;}
   if(hold&&hold.id===ownId){
    if(local?.pending&&local.request===hold.request)local={...hold,started:now()};
   }else if(local?.request&&!local.pending)local=null;
   remote=hold&&hold.id!==ownId?{...hold,started:now()-hold.elapsed}:null;
  },
  update(at=now(),position){
   if(!local)return;
   const [x,y,z]=local.at;
   if(position&&Math.hypot(x-position.x,y-position.y,z-position.z)>.05){cancel();return;}
   if(local.pending){if(at-local.started>=1500)cancel();return;}
   if(at-local.started>=FROG_LICK_MS){cancel();startTrip();}
  },
  cancel,reset(){local=null;remote=null;},
 };
}
