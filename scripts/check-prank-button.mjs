import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {crc32} from 'node:zlib';
import WebSocket from 'ws';
import sharp from 'sharp';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {plannedStanding} from '../src/v2/standing.js';
import {Colliders} from '../src/walk/collision.js';
import {prankFittings,attachPrankCollider,stainWeights,stainSources,createPrankMess,photoCrop,PRANK} from '../src/walk/prank-button.js';
import {installPreparedColliders} from '../src/v2/prepared-codec.public.js';
import {createPrankTiming,PRANK_TIME} from '../src/walk/prank-timing.js';
import {LIFTS} from '../src/walk/lifts.js';
import {connectLive} from '../src/walk/net/live.js';
import {PROTOCOL} from '../src/walk/net/wire.js';
import {LIVE_IDENTITY} from '../src/v2/live-identity.js';

let checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
{
 // Embedded textures need no decoding for these geometry and skinning probes.
 const load=T.ImageLoader.prototype.loadAsync;let asset;
 try{T.ImageLoader.prototype.loadAsync=async()=>({width:1,height:1});const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');asset=await createDLCat({height:1.75});}finally{T.ImageLoader.prototype.loadAsync=load;}
 assert.deepEqual(stainSources(asset).map(m=>m.userData.originalName).sort(),['body','hoodie.001','hoodie.002']);
 const mess=createPrankMess({figure:{asset}});assert(mess.body.length>=12);assert(mess.body.some(o=>o.userData.prankSurface==='hoodie.001'),'stains sit on the outer hoodie');assert(mess.body.some(o=>o.userData.prankSurface==='hoodie.002'),'stains also follow the raised pocket');
 for(const o of mess.body){assert(o.isSkinnedMesh);assert(o.geometry.attributes.skinWeight);assert(o.geometry.attributes.position.array.every(Number.isFinite));}
 mess.dispose();asset.dispose();pass('the real avatar uses original clothing names and receives skinned stains on its hoodie and pocket');
}
{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,0,0,0,1,0,0,0,1,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,.35,.65,0,0,0,1,0,0],4));
 const face={a:0,b:1,c:2},skin=stainWeights(g,{face,point:new T.Vector3(.25,.5,0)}),weight=id=>skin.weights.reduce((n,w,k)=>n+(skin.ids[k]===id?w:0),0);assert(Math.abs(weight(0)-.3375)<1e-6);assert(Math.abs(weight(1)-.6625)<1e-6);
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();a.add(b);root.add(a);const source=new T.SkinnedMesh(g,new T.MeshBasicMaterial());root.add(source);source.add(a);source.bind(new T.Skeleton([a,b]));
 const v=new T.Vector3().fromBufferAttribute(g.attributes.position,1),atVertex=stainWeights(g,{face,point:v}),overlay=new T.BufferGeometry();overlay.setAttribute('position',new T.Float32BufferAttribute(v.toArray(),3));overlay.setAttribute('skinIndex',new T.Uint16BufferAttribute(atVertex.ids,4));overlay.setAttribute('skinWeight',new T.Float32BufferAttribute(atVertex.weights,4));const stain=new T.SkinnedMesh(overlay,new T.MeshBasicMaterial());root.add(stain);stain.bind(source.skeleton,source.bindMatrix);
 for(const angle of [0,.4,-.6]){b.rotation.y=angle;b.position.set(.1,angle,.2);root.updateMatrixWorld(true);source.skeleton.update();assert(source.getVertexPosition(1,new T.Vector3()).distanceTo(stain.getVertexPosition(0,new T.Vector3()))<1e-6,'stain follows the clothing through blended bone poses');}
 g.dispose();overlay.dispose();source.material.dispose();stain.material.dispose();pass('stains inherit surface bone weights and follow the clothing through torso poses');
}
function clock(overrides={}){
 let now=1000,id=0;const jobs=new Map(),events=[];
 const hooks=Object.fromEntries(['begin','photo','release','reset','clean','error'].map(k=>[k,()=>events.push(k)]));
 const timing=createPrankTiming({...hooks,...overrides},{now:()=>now,set:(fn,ms)=>{jobs.set(++id,{fn,at:now+ms});return id;},clear:id=>jobs.delete(id)});
 return {timing,events,advance(ms){const end=now+ms;for(;;){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=end;},get jobs(){return jobs.size;}};
}
{
 let c;c=clock({begin(){c.advance(800);}});assert(c.timing.start());assert.equal(c.timing.elapsed,0);c.advance(2000);assert.equal(c.timing.elapsed,2);assert(c.timing.locked);assert(!c.events.includes('photo'));c.advance(500);assert(c.events.includes('photo'));c.advance(500);assert(!c.timing.locked);c.timing.dispose();
 pass('effect setup time cannot put the animation clock ahead of its photo and release timers');
}
{
 const c=clock(),t=c.timing;assert.equal(c.jobs,0);assert(!t.locked&&!t.messy);assert(t.start());assert(t.locked&&t.messy);assert(!t.start());
 c.advance(PRANK_TIME.photo);assert(c.events.includes('photo'));assert(t.locked);c.advance(PRANK_TIME.release-PRANK_TIME.photo);assert(!t.locked&&t.cooling);assert.equal(c.events.filter(e=>e==='release').length,1);
 c.advance(PRANK_TIME.reset-PRANK_TIME.release);assert(!t.cooling);assert(c.events.includes('reset'));assert(t.messy);assert(t.start());c.advance(PRANK_TIME.mess-1);assert(t.messy);c.advance(1);assert(!t.messy);assert(c.events.includes('clean'));assert.equal(c.jobs,0);
 pass('photo at 2.5 s, guaranteed release at 3 s, reset at 7 s, repeat restarts the full five minutes');
}
for(const point of ['begin','photo']){
 const c=clock({[point](){throw Error('capture unavailable');}});c.timing.start();c.advance(PRANK_TIME.photo);assert(!c.timing.locked&&!c.timing.cooling);assert(c.events.includes('release'));assert(c.events.includes('reset'));assert(c.events.includes('error'));c.advance(300000);
 pass(point+' error releases and resets without leaving a pending sequence');
}
{
 const c=clock();c.timing.start();c.advance(1000);c.timing.cancel();assert(!c.timing.locked);c.advance(3000);assert(!c.events.includes('photo'));assert.equal(c.events.filter(e=>e==='release').length,1);c.timing.dispose();assert(!c.timing.messy);assert.equal(c.jobs,0);
 pass('Escape or navigation cancels capture; disposal clears every timer and attached mess');
}
const f=prankFittings(),colliders=new Colliders(),prepared=new Colliders();prepared.v2PreparedMovers=new Map();prepared.v2Ground=new Colliders();prepared.v2Ground.movers=prepared.movers;
installPreparedColliders(colliders,prepared);
assert.throws(()=>colliders.addMover('Do_not_press_button',f.triangles),/Missing prepared movable collision/);
const mover=attachPrankCollider(colliders,f.triangles);assert.equal(colliders.movers[0],mover);assert.equal(colliders.v2Ground.movers[0],mover);assert.equal(colliders.v2PreparedMovers.size,0);
pass('local collider attaches to the public prepared world and shared ground queries without a baked mover entry');
const [x,y,z]=PRANK.at,c=Math.cos(PRANK.yaw),s=Math.sin(PRANK.yaw),world=(u,v)=>[x+c*u+s*v,y,z-s*u+c*v];
const blocked=p=>colliders.overlaps(new T.Line3(new T.Vector3(p[0],p[1]+.35,p[2]),new T.Vector3(p[0],p[1]+1.65,p[2])),.35);
assert(blocked(PRANK.at),'pedestal is solid');
const deck=layout.decks.find(d=>d.number===6);assert.equal(Math.round(y*10),Math.round(deck.y*10));
for(const p of [PRANK.at,world(0,PRANK.behind),world(0,-1),world(0,.94)]){assert(plannedStanding(layout,...p));assert(contains(deck.slab.outline,[p[0],p[2]]));}
for(let u=-3;u<=3;u+=.1)assert(!blocked(world(u,.94)),'standing capsule fits between pedestal and sign');
pass('pedestal collides, both fittings stand on Deck 6, and the full capsule fits through the gap');
for(const lift of LIFTS.filter(l=>l.id.startsWith('forward-'))){const stop=lift.stops.find(s=>s.deck===6);for(let dx=-1;dx<=1;dx+=.25)for(let out=.4;out<=3;out+=.25){const p=[lift.car.x+dx,stop.y,lift.car.z+lift.door.sign*(lift.car.depth/2+out)];assert(!blocked(p));}}
pass('both forward lift entrances and their three-metre approaches stay clear of the new fitting');
for(const suffix of ['', '.public', '.prepared', '.authoring']){const source=fs.readFileSync(new URL('../src/walk/main'+suffix+'.js',import.meta.url),'utf8');for(const hook of ['prank=createPrankButton','follow,live:()=>live,name:','prank?.locked?prank.camera','prank?.near(p)','prank?.update()','prank.cancel()'])assert(source.includes(hook),suffix+' '+hook);}
pass('all four walk entry points install the same station, camera, prompt, update and cancellation');
{
 // The souvenir's photo window is 1012×620. Phones held upright (and wide desktops) crop to it rather than squeeze.
 for(const [w,h] of [[1080,1920],[1170,2532],[1920,1080],[2560,1080],[1012,620]]){
  const [x,y,cw,ch]=photoCrop(w,h,1012,620);
  assert(Math.abs(cw/ch-1012/620)<1e-9,'the crop keeps the photo window shape, so nothing is stretched');
  assert(x>=0&&y>=0&&x+cw<=w+1e-9&&y+ch<=h+1e-9,'the crop stays inside the capture');
  assert(Math.abs(x+cw/2-w/2)<1e-9&&Math.abs(y+ch/2-h/2)<1e-9,'the crop is centred where the lens aims');
  assert(Math.abs(cw-w)<1e-9||Math.abs(ch-h)<1e-9,'the crop uses the full width or the full height');
 }
 pass('the souvenir photo crops portrait and wide captures to its window instead of stretching them');
}
// Two isolated live servers, with a local signing key and a stub for the Discord webhook.
{
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const posts=[],replies=[],logs=[],workers=[],sockets=[];
 const photo=sharp({create:{width:32,height:32,channels:3,background:'#347b8d'}});
 const image=await photo.clone().png().toBuffer(),jpeg=await photo.jpeg().toBuffer();
 // These keep their headers and end markers, but their compressed picture data is broken.
 const badPng=Buffer.from(image),idat=badPng.indexOf('IDAT'),end=idat+4+badPng.readUInt32BE(idat-4);
 badPng.fill(0,idat+4,end);badPng.writeUInt32BE(crc32(badPng.subarray(idat,end)),end);
 const sos=jpeg.indexOf(Buffer.from([0xff,0xda])),scan=sos+2+jpeg.readUInt16BE(sos+2);
 const badJpeg=Buffer.concat([jpeg.subarray(0,scan+1),jpeg.subarray(-2)]);
 let webhookStatus=200,received=0;
 const secretPath='/stub-webhook-'+randomBytes(12).toString('hex');
 const stub=http.createServer(async(req,res)=>{
  if(req.url==='/keys'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[{...jwk,kid:'prank-check',alg:'EdDSA'}]}));return;}
  if(req.url!==secretPath+'?wait=true'||req.method!=='POST'){res.writeHead(404).end();return;}
  try{
   const chunks=[];for await(const c of req)chunks.push(c);
   const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers['content-type']}}).formData();
   const file=form.get('files[0]');received++;
   if(webhookStatus===200)posts.push({payload:JSON.parse(form.get('payload_json')),name:file.name,type:file.type,bytes:Buffer.from(await file.arrayBuffer())});
   res.writeHead(webhookStatus,{'Content-Type':'application/json'}).end(JSON.stringify({url:base+secretPath}));
  }catch{res.writeHead(500).end();}
 });
 const dir=fs.mkdtempSync(path.resolve('output','prank-share-check-'));
 let base;
 try{
  stub.listen(0,'127.0.0.1');await once(stub,'listening');base='http://127.0.0.1:'+stub.address().port;
  const webhook=base+secretPath,origin='http://localhost:4180',core=new URL('../server/live-core.mjs',import.meta.url).href;
  async function start(enabled){
   const files=['SCORES','HEARTS','CHAT_LOG','GRAFFITI','GRAFFITI_CLEAR','TV','TV_CLEAR','MAZE','TREASURE','PINBALL','GIVEAWAY','GIVEAWAY_CLAIMS','ARENA_STATS','HALLOWEEN'];
   const env={PORT:'0',LEO_LIVE_ORIGINS:origin,LEO_PASS_ISS:base,LEO_PASS_JWKS_URL:base+'/keys',
    ...Object.fromEntries(files.map(k=>['LEO_LIVE_'+k,path.join(dir,k)])),...(enabled?{LEO_DISCORD_GAMING_WEBHOOK:webhook}:{})};
   const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    import(workerData).then(({server})=>{const ready=()=>parentPort.postMessage(server.address().port);
     if(server.listening)ready();else server.once('listening',ready);});`,{eval:true,execArgv:[],workerData:core,env,stdout:true,stderr:true});
   workers.push(worker);worker.stdout.on('data',c=>logs.push(String(c)));worker.stderr.on('data',c=>logs.push(String(c)));
   const [port]=await once(worker,'message',{signal:AbortSignal.timeout(20000)});return port;
  }
  const id='914141414141414141',b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const t=Math.floor(Date.now()/1000),claims=b64({iss:base,aud:'leo.marscatsvoyage.com',sub:'discord:'+id,
   discord:{id,global_name:'Rook_* @everyone'},iat:t,exp:t+600});
  const signed=b64({alg:'EdDSA',kid:'prank-check'})+'.'+claims;
  const passToken=signed+'.'+Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,Buffer.from(signed))).toString('base64url');
  async function join(port,hello,headers){
   const ws=new WebSocket('ws://127.0.0.1:'+port+'/live',{origin,headers}),seen=[];sockets.push(ws);
   ws.on('error',()=>{});
   ws.on('message',(data,binary)=>{if(!binary){const msg=JSON.parse(data);seen.push(msg);replies.push(String(data));}});
   await once(ws,'open',{signal:AbortSignal.timeout(5000)});
   const send=(m,extra)=>ws.send(JSON.stringify({m,...extra}));
   const wait=async test=>{for(let i=0;i<250;i++){const got=seen.find(test);if(got)return got;await new Promise(r=>setTimeout(r,20));}assert.fail('missing live reply');};
   send('hello',{v:PROTOCOL,layout:2,layoutIdentity:LIVE_IDENTITY,key:randomBytes(32).toString('hex'),...hello});
   const welcome=await wait(m=>m.m==='welcome');let request=0;
   return {welcome,async ticket(){send('prank-ticket',{request:++request,discordId:'99999',caption:'@here'});return wait(m=>m.m==='prank-ticket'&&m.request===request);}};
  }
  async function upload(port,ticket,body=image,type='image/png'){
   const res=await fetch('http://127.0.0.1:'+port+'/prank-photo',{method:'POST',headers:{Origin:origin,'Content-Type':type,'X-Leo-Prank-Ticket':ticket||'missing'},body,signal:AbortSignal.timeout(4000)});
   const text=await res.text();replies.push(text,JSON.stringify([...res.headers]));return [res.status,JSON.parse(text)];
  }
  const off=await start(false),offline=await join(off,{name:'Guest'});
  assert.equal(offline.welcome.prankShare,false);
  assert.equal((await offline.ticket()).why,'unavailable');
  assert.deepEqual(await upload(off),[503,{ok:false,why:'unavailable'}]);assert.equal(posts.length,0);
  pass('an unset webhook advertises no post button and refuses both ticket and upload');
  const on=await start(true),rook=await join(on,{pass:passToken}),guest=await join(on,{name:'Guest <@99999>'});
  assert.equal(rook.welcome.prankShare,true);assert.equal(rook.welcome.you.verified,true);assert.equal(guest.welcome.you.verified,false);
  assert.equal(posts.length,0);assert.deepEqual(await upload(on),[403,{ok:false,why:'ticket'}]);
  const first=await rook.ticket();assert(first.ok);
  assert.deepEqual(await upload(on,first.ticket),[200,{ok:true}]);
  assert.equal(posts[0].payload.content,`Do Not Press the Button souvenir from Rook everyone (<@${id}>).`);
  assert.deepEqual(posts[0].payload.allowed_mentions,{parse:[],users:[id]});
  assert.deepEqual(posts[0].payload.attachments,[{id:0,filename:'leo-ha-gottem.png'}]);
  assert.equal(posts[0].name,'leo-ha-gottem.png');assert.equal(posts[0].type,'image/png');assert.deepEqual(posts[0].bytes,image);
  pass('an opt-in upload attaches the photo and allows only the verified session’s Discord mention');
  assert.equal((await rook.ticket()).why,'slow');assert.equal((await upload(on,first.ticket))[0],403);
  const rejoined=await join(on,{pass:passToken});assert.equal((await rejoined.ticket()).why,'slow');assert.equal(posts.length,1);
  pass('a second post inside ten minutes is refused even after rejoining');
  const invalid=await join(on,{name:'Guest'});
  assert.deepEqual(await upload(on,(await invalid.ticket()).ticket,Buffer.from('not a photo')),[415,{ok:false,why:'image'}]);
  assert.deepEqual(await upload(on,(await invalid.ticket()).ticket,Buffer.alloc(5*1024*1024+1)),[413,{ok:false,why:'large'}]);
  assert.deepEqual(await upload(on,(await guest.ticket()).ticket,badPng),[415,{ok:false,why:'image'}]);
  assert.deepEqual(await upload(on,(await guest.ticket()).ticket,badJpeg,'image/jpeg'),[415,{ok:false,why:'image'}]);
  assert.equal(received,1);
  pass('non-images, corrupt PNG and JPEG picture data, and oversized uploads never reach the webhook');
  assert.deepEqual(await upload(on,(await guest.ticket()).ticket,jpeg,'image/jpeg'),[200,{ok:true}]);
  assert.equal(posts[1].payload.content,'Do Not Press the Button souvenir from Guest 99999.');
  assert.deepEqual(posts[1].payload.allowed_mentions,{parse:[],users:[]});
  assert.equal(posts[1].name,'leo-ha-gottem.jpg');assert.equal(posts[1].type,'image/jpeg');assert.deepEqual(posts[1].bytes,jpeg);
  pass('a guest posts by cleaned display name with no mention or browser-supplied caption');
  const rekeyed=await join(on,{name:'Guest again'},{'X-Forwarded-For':'192.0.2.9','CF-Connecting-IP':'invalid'});
  assert.notEqual(rekeyed.welcome.id,guest.welcome.id);assert.equal((await rekeyed.ticket()).why,'slow');
  pass('a fresh guest key and arbitrary forwarded header cannot bypass the socket address cooldown');
  const tunnel={'CF-Connecting-IP':'192.0.2.10'};
  webhookStatus=400;
  for(let i=0;i<6;i++){
   const retry=await join(on,{name:'Retry'},tunnel);
   for(let n=0;n<2;n++)assert.deepEqual(await upload(on,(await retry.ticket()).ticket),[502,{ok:false,why:'failed'}]);
  }
  assert.equal(received,14);assert.equal(posts.length,2);
  pass('twelve confirmed webhook rejections use neither the player cooldown nor the hourly cap');
  // Node’s stand-in browser supplies the Origin a browser would set itself.
  const previousSocket=globalThis.WebSocket,previousFetch=globalThis.fetch,previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin,headers:tunnel});sockets.push(this);}};
  globalThis.fetch=(url,options)=>previousFetch(url,{...options,headers:{...options?.headers,Origin:origin}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem(){}}});
  let link;
  try{
   let welcomed;const ready=new Promise((resolve,reject)=>{
    welcomed=resolve;AbortSignal.timeout(5000).addEventListener('abort',()=>reject(Error('missing walk link welcome')),{once:true});
   });
   link=connectLive('ws://127.0.0.1:'+on+'/live',{welcome:welcomed});
   const blob=new Blob([image],{type:'image/png'});
   assert.equal(link.prankShare,false);assert.equal(await link.postPrankPhoto(blob),'failed');
   await ready;assert.equal(link.prankShare,true);assert.equal(posts.length,2);
   webhookStatus=429;assert.equal(await link.postPrankPhoto(blob),'slow');
   webhookStatus=200;
   assert.equal(await link.postPrankPhoto(blob),'posted');assert.equal(posts.length,3);
   assert.equal(await link.postPrankPhoto(blob),'slow');
   link.close();assert.equal(link.prankShare,false);
   pass('the walk link waits for availability and maps the upload and rate-limit replies');
  }finally{
   link?.close();globalThis.WebSocket=previousSocket;globalThis.fetch=previousFetch;
   if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;
  }
  const sameAddress=await join(on,{name:'Guest'},tunnel);
  assert.equal((await sameAddress.ticket()).why,'slow');
  pass('guest cooldown also survives a new connection through the local tunnel');
  for(let i=posts.length;i<11;i++){
   const guest=await join(on,{name:'Voyager'},{'CF-Connecting-IP':'203.0.113.'+i});
   assert.deepEqual(await upload(on,(await guest.ticket()).ticket),[200,{ok:true}]);
  }
  const finalGuests=await Promise.all([20,21].map(i=>join(on,{name:'Voyager'},{'CF-Connecting-IP':'203.0.113.'+i})));
  const finalTickets=await Promise.all(finalGuests.map(g=>g.ticket()));assert(finalTickets.every(t=>t.ok));
  const results=await Promise.all(finalTickets.map(t=>upload(on,t.ticket)));
  assert.deepEqual(results.map(r=>r[0]).sort(),[200,429]);
  const next=await join(on,{name:'Voyager'},{'CF-Connecting-IP':'203.0.113.22'});
  assert.equal((await next.ticket()).why,'slow');assert.equal(posts.length,12);
  pass('the hourly channel cap holds across different guest addresses and simultaneous uploads');
  assert(![...replies,...logs].some(value=>value.includes(secretPath)));
  pass('the webhook URL stays out of live messages, HTTP replies and server logs');
 }finally{
  for(const ws of sockets)ws.terminate();
  await Promise.all(workers.map(worker=>worker.terminate()));
  await new Promise(resolve=>stub.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 }
}
console.log('prank button: '+checks+' checks passed');
