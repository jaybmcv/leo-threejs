// Lets the Builder's Hub find a walk already open in this browser, so going back to it doesn't build the ship again.
// Only pages of this site can reach the channel. A move asked for while the ship is still building waits until it's ready.
export const HUB_CHANNEL='leo-walk';
export function listenForHub(move=null){
 let channel=null,pending=null;
 try{channel=new BroadcastChannel(HUB_CHANNEL);}catch{return {ready(){}};}
 const say=m=>{try{channel.postMessage(m);}catch{}};
 channel.onmessage=({data})=>{
  if(data?.kind==='who')say({kind:'here',loading:!move});
  else if(data?.kind==='front'){try{window.focus();}catch{}}
  else if(data?.kind==='go'&&typeof data.search==='string'){
   if(!move){pending=data.search;say({kind:'went',id:data.id,ok:true,loading:true});return;}
   let ok=false;try{ok=!!move(data.search);}catch{}
   say({kind:'went',id:data.id,ok,loading:false});
   if(ok){try{window.focus();}catch{}}
  }
 };
 if(typeof addEventListener==='function')addEventListener('pagehide',()=>say({kind:'gone'}));
 say({kind:'here',loading:true});
 return {
  ready(go){move=go;say({kind:'here',loading:false});if(pending!==null){const s=pending;pending=null;try{go(s);}catch{}}},
  close(){channel.close();},
 };
}
