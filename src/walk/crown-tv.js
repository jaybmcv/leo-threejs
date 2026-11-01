import {inOtherside} from './net/otherside.js';
import * as T from 'three';
import {placed,placedV1,placedFacing,placeObject} from '../plan/placements.js';

// The Crown lounge TV: a large flat screen on the crown lift's aft face, facing the lounge as you come round the lift.
// It plays one shared video through Leo live (server/tv.mjs): anyone signed in with Discord may put an mp4 on it, with no
// approval step, and everyone aboard sees it until the next one replaces it or it is taken down. Who shared it is on
// the strip under the screen. The video plays muted, looping, only while the walker is in the lounge; E at the screen
// opens the TV's card, to unmute it (it then fades with distance), share a video, or, for the TV's owners, take it down.
// Without Leo live, or with nothing shared yet, the screen shows its idle card.
const KEY='tv/Crown_lounge',FLOOR=120.3,SCREEN=[3.2,1.8],BEZEL=.06,REACH=5,LOAD_M=45,LOUD_M=5,QUIET_M=24;
const INK='#07090d',TEXT='#f4f0e8',DIM='#a6b4bb',ORANGE='#f85800',TEAL='#2fd6c5';
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace'};
const WHY={
 'sign-in':inOtherside?'Everyone aboard can watch. Sharing a video isn’t available from Otherside yet.':'Connect Discord to share a video. Everyone aboard can watch.',
 slow:'One video a minute each: try again in a moment.',
 busy:'Someone else is uploading right now: try again in a moment.',
 big:'That file is too big.',long:'That video is too long.',
 large:'That video is bigger than 1080p. Export it at 1080p or smaller and try again.',
 'not-mp4':'That isn’t an MP4 video the TV can play. Export it as MP4 (H.264) and try again.',
 codec:'That MP4 isn’t H.264, so many browsers couldn’t play it. Export it as MP4 (H.264) and try again.',
 'no-video':'That MP4 has no picture. Choose a video file.',
 offline:'The TV shares videos through Leo live, which isn’t connected right now.',
 'not-owner':'Only the TV’s owners can take a video down.',
 failed:'The upload didn’t go through. Try again.',
};
const minutes=s=>s%60?`${s} seconds`:s===60?'1 minute':`${s/60} minutes`;
const ago=at=>{const s=(Date.now()-Date.parse(at))/1000;if(!(s>=0))return '';if(s<90)return 'just now';if(s<5400)return `${Math.round(s/60)} min ago`;if(s<129600)return `${Math.round(s/3600)} h ago`;return `${Math.round(s/86400)} days ago`;};

// live(): the Leo live link or null; base: Leo live's web address (net/live.js httpBase), or '' with no server;
// connect(): connect Discord. els: the TV's card (walk.html #tv-sheet) and its parts. onOpen/onClose: the walk stops
// and starts again.
export function createCrownTv({live,base,connect,els,onOpen,onClose}){
 const [x,y,z]=placedV1(KEY),f=new T.Vector3(-1,0,0),group=new T.Group();group.name='Crown_tv';
 // Its origin on the floor, so main.js files it with the crown's deck band.
 group.position.set(x,FLOOR,z);group.rotation.y=Math.atan2(f.x,f.z);
 const mid=y-FLOOR;
 const bezel=new T.Mesh(new T.BoxGeometry(SCREEN[0]+.12,SCREEN[1]+.12,BEZEL),new T.MeshStandardMaterial({name:'Crown_tv_bezel',color:0x0b0c0f,roughness:.32,metalness:.45}));
 bezel.name='Crown_tv_bezel';bezel.position.set(0,mid,BEZEL/2);group.add(bezel);
 const glass=new T.Mesh(new T.PlaneGeometry(...SCREEN),new T.MeshBasicMaterial({name:'Crown_tv_black',color:0x020304}));
 glass.name='Crown_tv_glass';glass.position.set(0,mid,BEZEL+.001);group.add(glass);
 // The picture: the idle card, or the video fitted inside the screen at its own shape.
 const card=document.createElement('canvas');card.width=1280;card.height=720;
 const cardTexture=new T.CanvasTexture(card);cardTexture.colorSpace=T.SRGBColorSpace;cardTexture.anisotropy=4;
 const picture=new T.Mesh(new T.PlaneGeometry(...SCREEN),new T.MeshBasicMaterial({name:'Crown_tv_picture',map:cardTexture,toneMapped:false}));
 picture.name='Crown_tv_picture';picture.position.set(0,mid,BEZEL+.002);group.add(picture);
 // The strip under the screen: who shared what is on, and whether its sound is on.
 const strip=document.createElement('canvas');strip.width=1024;strip.height=80;
 const stripTexture=new T.CanvasTexture(strip);stripTexture.colorSpace=T.SRGBColorSpace;stripTexture.anisotropy=4;
 const plate=new T.Mesh(new T.BoxGeometry(2.6,.22,.025),new T.MeshStandardMaterial({name:'Crown_tv_plate',color:0x0b0c0f,roughness:.4,metalness:.4}));
 plate.name='Crown_tv_plate';plate.position.set(0,mid-SCREEN[1]/2-.24,.0125);group.add(plate);
 const label=new T.Mesh(new T.PlaneGeometry(2.56,.2),new T.MeshBasicMaterial({name:'Crown_tv_label',map:stripTexture,toneMapped:false,transparent:true}));
 label.name='Crown_tv_label';label.position.set(0,mid-SCREEN[1]/2-.24,.0255);group.add(label);
 placeObject(group,KEY);
 const centre=new T.Vector3(...placed(KEY)),facing=new T.Vector3(...placedFacing(KEY,[-1,0,0]));

 let info=null,verified=false,owner=false,max={mb:40,seconds:120},state='idle',sound=false,video=null,texture=null,retry=0,near=false,open=false,busy=false,note='',sure=false;
 const link=()=>live()?.live?live():null;

 function paintCard(){
  const c=card.getContext('2d'),w=card.width,h=card.height;
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#101a24');g.addColorStop(1,'#05070b');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.strokeStyle='rgba(47,214,197,.18)';c.lineWidth=2;for(let i=0;i<9;i++){c.beginPath();c.arc(w*.82,h*.2,60+i*48,0,Math.PI*2);c.stroke();}
  c.fillStyle=ORANGE;c.font=`500 26px ${FONT.mono}`;c.textBaseline='alphabetic';c.fillText('CROWN LOUNGE',96,250);
  c.fillStyle=TEXT;c.font=`600 112px ${FONT.display}`;c.fillText('Crown TV',90,370);
  c.fillStyle=DIM;c.font=`400 34px ${FONT.mono}`;
  const lines=state==='tuning'?['Tuning in…']:state==='broken'?['This video won’t play in this browser.']
   :!base?['Nothing on.']:inOtherside?['Nothing on yet.']:['Nothing on yet.','Signed in with Discord? Press E here','to put a video on for everyone aboard.'];
  lines.forEach((t,i)=>c.fillText(t,96,450+i*52));
  cardTexture.needsUpdate=true;
 }
 function paintStrip(){
  const c=strip.getContext('2d'),w=strip.width,h=strip.height;c.clearRect(0,0,w,h);
  c.textBaseline='middle';c.font=`500 34px ${FONT.mono}`;
  if(info){
   let name=info.name||'Voyager';c.fillStyle=TEXT;
   const lead='SHARED BY ';c.fillStyle=DIM;c.fillText(lead,24,h/2);const lw=c.measureText(lead).width;
   c.fillStyle=TEAL;while(name.length>1&&c.measureText(name).width>w-lw-330)name=name.slice(0,-1);c.fillText(name,24+lw,h/2);
   c.fillStyle=sound?TEAL:ORANGE;c.textAlign='right';c.fillText(sound?'SOUND ON':'MUTED · E',w-24,h/2);c.textAlign='left';
  }else{c.fillStyle=DIM;c.fillText('CROWN TV · PRESS E',24,h/2);}
  stripTexture.needsUpdate=true;
 }
 // The picture plane at the video's shape, inside the screen.
 function fit(aspect){const s=SCREEN[0]/SCREEN[1];picture.scale.set(aspect>s?1:aspect/s,aspect>s?s/aspect:1,1);}
 function showCard(next){state=next;if(texture){texture.dispose();texture=null;}picture.material.map=cardTexture;picture.material.needsUpdate=true;fit(SCREEN[0]/SCREEN[1]);paintCard();}
 function unload(){if(!video)return;video.pause();video.removeAttribute('src');video.load();video=null;}
 function load(){
  unload();const v=document.createElement('video');video=v;
  Object.assign(v,{muted:true,loop:true,playsInline:true,preload:'auto',crossOrigin:'anonymous'});v.setAttribute('playsinline','');v.dataset.id=info.id;
  v.addEventListener('playing',()=>{if(video!==v||texture)return;texture=new T.VideoTexture(v);texture.colorSpace=T.SRGBColorSpace;
   picture.material.map=texture;picture.material.needsUpdate=true;fit(v.videoWidth&&v.videoHeight?v.videoWidth/v.videoHeight:16/9);state='playing';});
  v.addEventListener('error',()=>{if(video===v){unload();showCard('broken');}});
  v.src=base+info.src;showCard('tuning');
 }
 function setVideo(next){
  const changed=(next?.id||null)!==(info?.id||null);info=next||null;
  if(!changed)return;
  // A new video starts muted again, whoever unmuted the last one.
  sound=false;unload();showCard('idle');paintStrip();showSheet();
 }

 // The card: what's on, sound, sharing a video, and (owners) taking it down.
 els.sound.addEventListener('click',()=>{sound=!sound;if(video){video.muted=!sound;video.play().catch(()=>{});}paintStrip();showSheet();});
 els.pick.addEventListener('click',()=>{if(!busy)els.file.click();});
 els.connect.addEventListener('click',()=>connect());
 els.file.addEventListener('change',()=>{const file=els.file.files[0];els.file.value='';if(file)share(file);});
 els.down.addEventListener('click',()=>{if(!sure){sure=true;showSheet();return;}sure=false;link()?.tvDown();note='';showSheet();});
 function showSheet(){
  if(!open)return;
  const online=!!link();
  els.now.textContent=info?`Now showing: shared by ${info.name||'Voyager'}${info.at?' '+ago(info.at):''}${info.seconds?` · ${Math.round(info.seconds)} s`:''}.`:'Nothing on the TV yet.';
  els.sound.hidden=!info;els.sound.textContent=sound?'Mute':'Unmute';
  els.pick.hidden=!online||!verified;els.pick.disabled=busy;els.pick.textContent=info?'Share a video instead':'Share a video';
  els.connect.hidden=!online||verified||inOtherside;
  els.down.hidden=!online||!owner||!info;els.down.textContent=sure?'Sure? Take it down':'Take it down';
  els.limits.textContent=`MP4 (H.264), up to ${minutes(max.seconds)} and ${max.mb} MB, 1080p at most. It plays for everyone aboard until someone shares the next one, so keep it friendly: it can be taken down.`;
  els.status.textContent=note||(!online?WHY.offline:!verified?WHY['sign-in']:'');
 }
 const say=text=>{note=text;showSheet();};
 // Checked here first (type, size, length, and that this browser can play it), then a ticket, then the upload.
 let ticketWait=null;
 async function share(file){
  if(busy)return;
  const l=link();if(!l)return say(WHY.offline);
  if(!/\.mp4$/i.test(file.name)&&file.type!=='video/mp4')return say('Choose an MP4 video.');
  if(file.size>max.mb*1048576)return say(`That file is over ${max.mb} MB. Trim or shrink it and try again.`);
  busy=true;say('Checking the video…');
  try{
   const probe=await new Promise(resolve=>{
    const v=document.createElement('video'),url=URL.createObjectURL(file),done=r=>{clearTimeout(t);URL.revokeObjectURL(url);v.removeAttribute('src');resolve(r);};
    const t=setTimeout(()=>done(null),15000);v.preload='metadata';v.muted=true;
    v.onloadedmetadata=()=>done({seconds:v.duration,width:v.videoWidth,height:v.videoHeight});v.onerror=()=>done(null);v.src=url;
   });
   if(!probe||!probe.width)return say('This browser can’t play that file, so others may not either. Export it as MP4 (H.264) and try again.');
   if(probe.seconds>max.seconds+.5)return say(`That video is longer than ${minutes(max.seconds)}. Trim it and try again.`);
   say('Getting ready…');
   const ticket=await new Promise(resolve=>{ticketWait=resolve;if(!l.tvTicket())resolve({ok:false,why:'offline'});setTimeout(()=>resolve({ok:false,why:'failed'}),8000);});ticketWait=null;
   if(!ticket.ok)return say(WHY[ticket.why]||WHY.failed);
   const answer=await new Promise(resolve=>{
    const r=new XMLHttpRequest();r.open('POST',base+'/tv/upload');r.setRequestHeader('Content-Type','video/mp4');r.setRequestHeader('X-Leo-Tv-Ticket',ticket.ticket);
    r.upload.onprogress=e=>{if(e.lengthComputable)say(`Uploading… ${Math.floor(e.loaded/e.total*100)}%`);};
    r.onload=()=>{let body=null;try{body=JSON.parse(r.responseText);}catch{}resolve(body||{ok:false,why:'failed'});};r.onerror=()=>resolve({ok:false,why:'failed'});r.send(file);
   });
   if(!answer.ok)return say(answer.why==='big'?`That file is over ${max.mb} MB.`:answer.why==='long'?`That video is longer than ${minutes(max.seconds)}.`:WHY[answer.why]||WHY.failed);
   if(answer.video)setVideo(answer.video);
   say('It’s on. Everyone aboard sees it now.');
  }finally{busy=false;showSheet();}
 }
 function openSheet(){open=true;note='';sure=false;els.sheet.hidden=false;link()?.tv();showSheet();onOpen?.();}

 paintCard();paintStrip();
 document.fonts?.ready.then(()=>{paintStrip();if(picture.material.map===cardTexture)paintCard();});
 return {
  group,
  get video(){return video;},get info(){return info;},get sound(){return sound;},get state(){return state;},
  // What E offers: on the lounge floor in front of the screen, more or less facing it.
  near(p){
   const dx=p.x-centre.x,dz=p.z-centre.z,out=dx*facing.x+dz*facing.z,along=Math.abs(dx*facing.z-dz*facing.x);
   if(Math.abs(p.y-FLOOR)>1.5||out<.2||out>REACH||along>SCREEN[0]/2+1)return null;
   return {kind:'tv',label:info?(sound?'Watch the TV':'Unmute or share on the TV'):'Share a video on the TV'};
  },
  open:openSheet,
  close(){if(!open)return;open=false;els.sheet.hidden=true;onClose?.();},
  // Leo live's word on the TV: what is on it and what this visitor may do; and the answer to a ticket asked for.
  tv(msg){verified=msg.verified===true;owner=msg.owner===true;if(msg.max&&Number.isFinite(msg.max.mb)&&Number.isFinite(msg.max.seconds))max=msg.max;
   const v=msg.video;setVideo(v&&/^[0-9a-f]{16}$/.test(v.id)&&v.src===`/tv/${v.id}.mp4`?v:null);if(msg.down&&open)say('The video was taken down.');showSheet();},
  ticket(msg){ticketWait?.(msg);},
  // Every HUD tick: in the lounge, the video loads and plays; away from it, it stops.
  update(p){
   const d=p.distanceTo(centre);near=Math.abs(p.y-FLOOR)<4&&d<LOAD_M;
   if(!info||!base){if(video)unload();return;}
   if(!near){if(video&&!video.paused)video.pause();return;}
   if(!video||video.dataset.id!==info.id)load();
   video.muted=!sound;if(sound)video.volume=T.MathUtils.clamp(1-(d-LOUD_M)/(QUIET_M-LOUD_M),0,1);
   const now=performance.now();if(video.paused&&now>retry){retry=now+3000;video.play().catch(()=>{});}
  },
 };
}
