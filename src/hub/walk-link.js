import {HUB_CHANNEL} from '../walk/hub-link.js';

// The Hub's side of walk/hub-link.js: is a walk open in this browser, and can it be sent somewhere? Rebuilding the ship
// takes about 1 GB, so a walk already open is always the better way back. While it builds, a walk is too busy to answer,
// so having said it's building counts as an answer: its messages wait for it.
const ANSWER_MS=800;
export function walkLink(){
 let channel=null,open=false,building=false,next=0;
 const waiting=new Map(),heard=new Set();
 try{channel=new BroadcastChannel(HUB_CHANNEL);}catch{return {isOpen:()=>false,check:async()=>false,go:async()=>({sent:false}),front(){},ask(){},close(){}};}
 channel.onmessage=({data})=>{
  if(data?.kind==='here'){open=true;building=!!data.loading;for(const f of heard)f();heard.clear();}
  else if(data?.kind==='gone'){open=false;building=false;ask();}
  else if(data?.kind==='went'&&waiting.has(data.id)){waiting.get(data.id)(data);waiting.delete(data.id);}
 };
 const ask=()=>{try{channel.postMessage({kind:'who'});}catch{}};
 ask();
 return {
  isOpen:()=>open,
  ask,
  // A fresh look: a tab the browser has frozen or dropped won't answer.
  check(){
   if(open&&building)return Promise.resolve(true);
   open=false;
   return new Promise(resolve=>{
    const done=()=>{clearTimeout(t);resolve(true);};
    const t=setTimeout(()=>{heard.delete(done);resolve(false);},ANSWER_MS);
    heard.add(done);ask();
   });
  },
  // Sends the open walk to a walk link's query. {sent:false} when nothing answered.
  go(search){
   if(open&&building){try{channel.postMessage({kind:'go',id:++next,search});return Promise.resolve({sent:true,ok:true,loading:true});}catch{return Promise.resolve({sent:false});}}
   return new Promise(resolve=>{
    const id=++next,t=setTimeout(()=>{waiting.delete(id);open=false;resolve({sent:false});},ANSWER_MS);
    waiting.set(id,m=>{clearTimeout(t);resolve({sent:true,ok:m.ok,loading:m.loading});});
    try{channel.postMessage({kind:'go',id,search});}catch{clearTimeout(t);waiting.delete(id);resolve({sent:false});}
   });
  },
  front(){try{channel.postMessage({kind:'front'});}catch{}},
  close(){channel.close();},
 };
}
