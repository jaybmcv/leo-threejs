// Stuck? Pop out (src/walk/unstuck.js): when the walk senses a visitor is stuck, and where the pop puts them. Rules only,
// no ship build: the sense runs on made-up frames, the landing search on a stand-in floor, the button on a stand-in
// element. The landing checks themselves (findStand, gotoStand, restrictedAt) have their own checks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};

// The button listens for U on the window; a stand-in window for Node.
const keys=[];globalThis.addEventListener=(type,fn,capture)=>{if(type==='keydown')keys.push({fn,capture});};
const {STUCK,createStuckSense,popStand,createUnstuck}=await import('../src/walk/unstuck.js');

// Frames at 120 a second: each gives the sense's state at time t and returns why it is stuck, if it is.
const STEP=1/120;
function run(sense,seconds,state,{from=0}={}){let first=null,last=null;
 for(let i=0;i<Math.round(seconds/STEP);i++){const t=from+i*STEP,s=state(t);const r=sense.update(STEP,{free:true,trying:false,air:false,...s,at:s.at||{x:0,y:0,z:0}});if(r&&first===null)first={t,r};last=r;}
 return {first,last};}
const still=()=>({});
const near=(t,{x=0,y=0,z=0}={})=>({x:x+Math.sin(t*37)*.04,y,z:z+Math.cos(t*29)*.04});

// Standing about, sitting, riding and walking freely are never stuck.
assert.equal(run(createStuckSense(),60,still).first,null);
assert.equal(run(createStuckSense(),60,t=>({free:false,trying:true,at:near(t)})).first,null);
assert.equal(run(createStuckSense(),60,t=>({free:false,air:true})).first,null);
assert.equal(run(createStuckSense(),60,t=>({trying:true,at:{x:4*t,y:0,z:0}})).first,null);
assert.equal(run(createStuckSense(),60,t=>({trying:true,at:{x:Math.cos(t/3)*6,y:0,z:Math.sin(t/3)*6}})).first,null,'round a 6 m circle');
pass('never stuck: standing still, seated or riding (not free), walking freely');

// Blocked: the keys held against something that won't give, the walker jittering in place.
let r=run(createStuckSense(),10,t=>({trying:true,at:near(t)}));
assert.equal(r.first.r,'blocked');assert(Math.abs(r.first.t-STUCK.push)<.05,'after '+STUCK.push+' s: '+r.first.t);
// A pause to look round doesn't start the count again; standing about wears it away.
r=run(createStuckSense(),20,t=>({trying:t<3||t>=4,at:near(t)}));assert.equal(r.first.r,'blocked');assert(Math.abs(r.first.t-6)<.05,String(r.first.t));
r=run(createStuckSense(),20,t=>({trying:t<3||(t>=13&&t<16),at:near(t)}));assert.equal(r.first,null,'3 s, a 10 s rest, 3 s');
// Inching along a wall at under 0.19 m/s is still blocked; a slow crawl at 0.5 m/s is not.
assert.equal(run(createStuckSense(),10,t=>({trying:true,at:{x:t*.15,y:0,z:0}})).first?.r,'blocked');
assert.equal(run(createStuckSense(),30,t=>({trying:true,at:{x:t*.5,y:0,z:0}})).first,null);
pass(`blocked: ${STUCK.push} s of trying to move without getting ${STUCK.budge} m; a pause doesn't reset it, a rest does`);

// Wedged in the air: off the ground and going nowhere, keys or none.
r=run(createStuckSense(),5,t=>({air:true,at:near(t,{y:3})}));assert.equal(r.first.r,'wedged');assert(Math.abs(r.first.t-STUCK.hang)<.05,String(r.first.t));
// A long fall, a glide down (the sense only sees it as not free) and jumping in place are not.
assert.equal(run(createStuckSense(),5,t=>({air:true,at:{x:0,y:-10*t,z:0}})).first,null);
assert.equal(run(createStuckSense(),20,t=>{const s=t%1.2;return {air:s<.85,at:{x:0,y:s<.85?6.6*s-11*s*s:0,z:0}};}).first,null,'hops');
// Sliding slowly off a slope (about 0.3 m/s) is moving.
assert.equal(run(createStuckSense(),8,t=>({air:true,at:{x:t*.3,y:-t*.3,z:0}})).first,null);
pass(`wedged: off the ground ${STUCK.hang} s within ${STUCK.drift} m; falls, hops and slides are not`);

// Boxed in: trying all the while in a pocket, back and forth (and jumping) without getting 2 m from where it began.
r=run(createStuckSense(),12,t=>({trying:true,air:t%2>1.4,at:{x:Math.sin(t*2.5)*1.5,y:t%2>1.4?.8:0,z:0}}));
assert.equal(r.first.r,'boxed');assert(Math.abs(r.first.t-STUCK.boxed)<.05,String(r.first.t));
// A strip three times as long is room enough.
assert.equal(run(createStuckSense(),30,t=>({trying:true,at:{x:Math.sin(t*1.2)*4.5,y:0,z:0}})).first,null);
pass(`boxed in: ${STUCK.boxed} s of trying within ${STUCK.roam} m of one spot`);

// Once stuck it stays so until the walker is free (3 m away) or taken over; then everything starts again.
{const s=createStuckSense();run(s,5,t=>({trying:true,at:near(t)}));assert.equal(s.reason,'blocked');
 assert.equal(run(s,2,t=>({at:near(t)})).last,'blocked','still there, keys let go');
 assert.equal(run(s,.5,t=>({trying:true,at:{x:2.9*t*2,y:0,z:0}})).last,'blocked','2.9 m away');
 run(s,.1,()=>({trying:true,at:{x:3.2,y:0,z:0}}));assert.equal(s.reason,null,'3.2 m away: free');
 run(s,5,t=>({trying:true,at:near(t)}));assert.equal(s.reason,'blocked');
 run(s,STEP,()=>({free:false}));assert.equal(s.reason,null,'a seat or a panel: gone');
 assert.equal(run(s,3.9,t=>({trying:true,at:near(t)})).first,null,'and counts from nothing again');}
pass('stays up until 3 m away or taken over, then counts from nothing');

// The landing search on a stand-in: floor at y 0 for x < 6 (none beyond); a wall along x = 3 that stops sight; a crew
// area for z > 3; Go to's check refuses a ring of spots.
const floor=([x,y,z])=>x<6&&Math.abs(y)<1.6?new T.Vector3(x,0,z):null;
const wall={raycast(ray,far){const t=(3-ray.origin.x)/ray.direction.x;return t>0&&t<=far?{distance:t}:null;}};
const open={raycast:()=>null};
const area=([,,z])=>z>3?'crew':null,check=([x,y,z])=>new T.Vector3(x,y,z),pop=(at,o)=>popStand(at,{colliders:wall,stand:floor,check,restrictedAt:area,...o});
let q=pop([0,0,0]);const d=v=>Math.hypot(v.x,v.z);
assert(q&&d(q)>=STUCK.near-1e-9&&d(q)<=STUCK.far+1e-9,'2 to 4 m: '+q?.toArray());
q=pop([0,0,0],{toward:[-1,0]});assert(q.x<-1.95&&Math.abs(d(q)-2)<1e-9,'facing -x, about straight ahead 2 m: '+q.toArray());
q=pop([0,0,0],{toward:[1,0]});assert(q.x<3&&d(q)<2+1e-9,'facing the wall, the nearest ring still, this side of it: '+q.toArray());
q=pop([2,0,0],{toward:[1,0]});assert(q.x<3,'never through the wall: '+q.toArray());
q=pop([0,0,2],{toward:[0,1]});assert(q.z<=3,'never into a crew area: '+q.toArray());
q=pop([0,0,0],{check:([x,y,z])=>Math.hypot(x,z)>2.6?new T.Vector3(x,y,z):null});assert(d(q)>2.6&&d(q)<=STUCK.far+1e-9,"Go to's check refuses the first rings");
q=pop([0,0,0],{stand:p=>Math.hypot(p[0],p[2])<1.9?floor(p):null});assert.equal(q,null,'floor only within 1.9 m: nowhere to pop (respawn)');
q=pop([0,0,0],{colliders:{raycast:()=>({distance:.1})}});assert.equal(q,null,'boxed in by walls all round: none');
q=pop([0,0,0],{stand:()=>null});assert.equal(q,null,'no floor at all: none');
assert.equal(pop([NaN,0,0]),null);assert.equal(pop([0,0]),null);
// In an area the walker let themselves into, the pop may stay inside it; from anywhere else it never goes in.
const club=([x])=>x<-1?'clubhouse':null;
q=popStand([-3,0,0],{colliders:open,stand:floor,check,restrictedAt:club,toward:[-1,0]});assert.equal(club(q.toArray()),'clubhouse','inside the clubhouse, stays inside');
q=popStand([0,0,0],{colliders:open,stand:floor,check,restrictedAt:club,toward:[-1,0]});assert.equal(club(q.toArray()),null,'outside it, never in');
q=popStand([0,0,4],{colliders:open,stand:floor,check,restrictedAt:area,toward:[0,1]});assert.equal(area(q.toArray()),null,'from a crew area, out to public floor');
pass('the pop: nearest floor 2 to 4 m off, the way they face first, in sight, public, through both landing checks');

// The button, on a stand-in element.
function element(){const label={textContent:'Stuck? Pop out'};const on={};return {hidden:true,dataset:{},attrs:{},label,on,
 querySelector:s=>s==='.label'?label:null,setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){on[type]=fn;}};}
const key=(code,o={})=>{const e={code,repeat:false,ctrlKey:false,metaKey:false,altKey:false,target:{closest:()=>null},prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...o};for(const k of keys.slice(-1))k.fn(e);return e;};
{const b=element(),pops=[];const u=createUnstuck(b,{pop:m=>pops.push(m)});
 assert(keys.at(-1).capture,'U is heard before the walk keys');
 const frames=(n,s)=>{for(let i=0;i<Math.round(n/STEP);i++)u.update(STEP,{free:true,trying:false,air:false,at:{x:0,y:0,z:0},...s(i*STEP)});};
 assert.equal(u.press(),false);assert.equal(key('KeyU').prevented,false);assert.equal(pops.length,0,'nothing to press while hidden');
 frames(3,t=>({trying:true,at:near(t)}));assert(b.hidden&&!u.shown);
 frames(1.2,t=>({trying:true,at:near(t)}));assert(!b.hidden&&u.shown&&b.dataset.mode==='pop');assert.equal(b.label.textContent,'Stuck? Pop out');
 assert.match(b.attrs['aria-label'],/Pop out a couple of metres away \(U\)/);
 assert.equal(key('KeyU',{target:{closest:()=>({})}}).prevented,false,'not while typing');assert.equal(key('KeyU',{ctrlKey:true}).prevented,false);
 const e=key('KeyU');assert(e.prevented&&e.stopped);assert.deepEqual(pops,['pop']);assert(b.hidden&&!u.shown);
 // Stuck again right where the last pop was, within 30 s: Respawn.
 frames(4.2,t=>({trying:true,at:near(t,{x:1})}));assert.equal(b.dataset.mode,'respawn');assert.equal(b.label.textContent,'Still stuck? Respawn');
 b.on.click({preventDefault(){}});assert.deepEqual(pops,['pop','respawn']);
 // After a respawn, or a pop long ago or far away, it is a pop again.
 frames(4.2,t=>({trying:true,at:near(t)}));assert.equal(b.dataset.mode,'pop');assert(u.press());assert.deepEqual(pops,['pop','respawn','pop']);
 frames(31,()=>({}));frames(4.2,t=>({trying:true,at:near(t)}));assert.equal(b.dataset.mode,'pop','31 s later');u.press();
 frames(4.2,t=>({trying:true,at:near(t,{x:8})}));assert.equal(b.dataset.mode,'pop','8 m away');
 // Walking away or being taken over puts it away without a pop.
 frames(.2,()=>({trying:true,at:{x:12,y:0,z:0}}));assert(b.hidden);
 frames(4.2,t=>({trying:true,at:near(t)}));assert(!b.hidden);frames(STEP,()=>({free:false}));assert(b.hidden);
 assert.equal(pops.length,4);}
pass('the button: shows when stuck, U, a click or press() pops; stuck again at once offers Respawn; walking off hides it');

// Every main variant wires it the same way: the sense, the pop and Enter or E with nothing in front.
const lines=s=>s.split(/\r?\n/);
const wiring=s=>{const L=lines(s),i=L.findIndex(l=>l.startsWith('const unstuck=createUnstuck(')),j=L.findIndex(l=>l.includes('unstuck.update(dt,'));
 return {imp:L.find(l=>l.includes("from './unstuck.js'")),use:L.find(l=>l.includes('unstuck.press()')),pop:L.slice(i,i+6).join('\n'),update:L[j],debug:/globalThis\.__walk=\{unstuck,/.test(s)};};
const mains={};for(const f of ['main','main.authoring','main.prepared','main.public'])mains[f]=wiring(await fs.readFile(`src/walk/${f}.js`,'utf8'));
for(const [f,w] of Object.entries(mains)){
 assert.equal(w.imp,"import {createUnstuck,popStand} from './unstuck.js';",f);assert.equal(w.use,'  const t=target();if(!t){unstuck.press();return;}',f);
 assert(w.pop.includes("popStand([p.x,p.y,p.z],{colliders,restrictedAt,")&&w.pop.includes('findStand(colliders,at,{radius:0})')&&w.pop.includes('v2GotoStand(colliders,at)')&&w.pop.includes('goTo({at:q.toArray(),yaw:Math.atan2(q.x-p.x,q.z-p.z),resolved:true})')&&w.pop.includes('actions.respawn();'),f);
 for(const not of ['canHook','input.enabled','!inCar','!controller.hook','!controller.gliding','!pawsOff?.active','!maze?.running','!playing()'])assert(w.update?.includes(not),f+' free needs '+not);
 assert(w.debug,f);assert.deepEqual(w,mains.main,f+' differs from main.js');}
pass('all four main variants: the same sense, pop (findStand, Go to check, goTo, Respawn) and keys');

// The page: the button, hidden until needed, with its key and label; the help lists it.
const html=await fs.readFile('src/walk/walk.html','utf8');
assert.match(html,/<button id="unstuck" type="button" hidden aria-label="[^"]+"><span class="key">U<\/span><span class="label">Stuck\? Pop out<\/span><\/button>/);
assert.match(html,/#unstuck\[hidden\]\{display:none\}/);assert.match(html,/@media \(pointer:coarse\)\{#unstuck\{/);
assert.match(await fs.readFile('src/walk/help.js','utf8'),/\[\['U'\],'Pop out',/);
pass('walk.html has the button (hidden, key U), touch placement; help lists U');
console.log(`\n${checks} checks passed`);
