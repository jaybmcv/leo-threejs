import {frogInReach,FROG_LEASE_MS} from '../src/walk/frog-lick.js';

// One claim at a time. The lease also returns a frog whose holder stopped sending.
export function createFrogHold({send,broadcast,now=Date.now}){
 let hold=null;
 function clear(){hold=null;broadcast({m:'frog',hold:null});}
 function expire(){if(hold&&now()-hold.started>=FROG_LEASE_MS)clear();}
 function state(){
  if(!hold)return null;
  const {visitor,request,at,yaw,started}=hold;
  return {id:visitor.id,request,at,yaw,elapsed:now()-started};
 }
 return {state,expire,left(v){if(hold?.visitor===v)clear();},
  message(v,{op,request,p},readPose){
   if(!Number.isSafeInteger(request)||request<=0)return;
   if(op==='end'){if(hold?.visitor===v&&hold.request===request)clear();return;}
   if(op!=='take')return;
   expire();
   if(hold||p?.g!==true||p.st!=='stand'||p.pl||p.b||p.gl||p.hk||p.rest||!readPose(p)||!frogInReach(...v.pos)){
    send(v.ws,{m:'frog',refused:request});return;
   }
   hold={visitor:v,request,at:v.pos,yaw:p.yaw,started:now()};broadcast({m:'frog',hold:state()});
  },
 };
}
