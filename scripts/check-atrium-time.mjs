import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {setAtriumView,inOpenAtrium} from '../src/v2/atrium-visibility.js';

// The atrium's day and night (src/walk/ship-time.js, src/walk/atrium-mood.js), without a GPU: the ship's clock, the
// visitor's choice, and what the mood changes and puts back.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
installWalkCanvas((w,h)=>createCanvas(w,h));
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
let visit=0;
// A fresh copy of the clock module, as a page with this query string would load it.
async function load(search){globalThis.location={search};return import('../src/walk/ship-time.js?visit='+(++visit));}

const time=await load('');
assert.equal(time.shipHour(new Date('2026-07-01T00:30:00Z')),20.5);
assert.equal(time.shipHour(new Date('2026-01-15T00:30:00Z')),19.5);
assert.equal(time.shipHour(new Date('2026-03-08T07:00:00Z')),3);
assert.equal(time.shipHour(new Date('2026-11-01T05:30:00Z')),1.5);
pass('the ship keeps New York time through both clock changes');
const tokyo=execFileSync(process.execPath,['--input-type=module','-e',"import {shipHour} from './src/walk/ship-time.js';console.log(shipHour(new Date('2026-07-01T00:30:00Z')))"],{env:{...process.env,TZ:'Asia/Tokyo'},encoding:'utf8'}).trim();
assert.equal(Number(tokyo),20.5);
pass('a visitor in another time zone sees the same ship time');
for(const [hour,night]of[[12,0],[19.4,0],[19.5,0],[20,1],[23,1],[3,1],[6,1],[6.5,0],[9,0]])assert.equal(time.nightAt(hour),night,'hour '+hour);
assert(time.nightAt(19.75)>0&&time.nightAt(19.75)<1);assert(time.nightAt(6.25)>0&&time.nightAt(6.25)<1);
pass('night runs 20:00 to 06:00 with a half-hour blend outside it');

assert.equal(time.getTimeChoice(),'auto');
const heard=[];time.subscribeTime(v=>heard.push(v));time.setTimeChoice('night');
assert.equal(time.nightTarget(new Date('2026-07-01T16:00:00Z')),1);assert.deepEqual(heard,['night']);assert.equal(store.get('leo-walk-time'),'night');
assert.equal((await load('')).getTimeChoice(),'night');
time.setTimeChoice('auto');assert.equal(time.nightTarget(new Date('2026-07-01T16:00:00Z')),0);assert.equal(time.nightTarget(new Date('2026-07-02T02:00:00Z')),1);
assert.throws(()=>time.setTimeChoice('dusk'),RangeError);
pass('Day, Night and Auto are remembered on this browser');
const forced=await load('?lv=2&time=night');assert.equal(forced.getTimeChoice(),'night');assert.equal(store.get('leo-walk-time'),'auto');
assert.equal((await load('?time=noon')).getTimeChoice(),'auto');
pass('?time=night holds night for one visit without changing the saved choice');

// A small atrium: the named materials the mood looks for, a sky with a picture, and the instanced downlights.
function atrium(){
 const scene=new T.Scene();scene.environmentIntensity=.65;scene.fog=new T.Fog(0xd9dcd6,70,148);
 const hemi=new T.HemisphereLight(0xeef4ff,0x4f5d68,1),fill=new T.DirectionalLight(0xf2f6ff,.55);scene.add(hemi,fill);
 const box=new T.BoxGeometry(),mesh=(name,m)=>{m.name=name;const o=new T.Mesh(box,m);o.name=name;scene.add(o);return m;};
 const day=createCanvas(64,8),g=day.getContext('2d');g.fillStyle='#5d9fdc';g.fillRect(0,0,64,8);
 const mats={
  sky:mesh('P6_sky_ceiling',new T.MeshBasicMaterial({map:new T.CanvasTexture(day)})),
  glass:mesh('V2_smart_glass',new T.MeshStandardMaterial({color:0x8ec7d4,transparent:true,opacity:.23})),
  soffit:mesh('V2_atrium_soffit',new T.MeshStandardMaterial({color:0xefdcc0,emissive:0xf8dcb0,emissiveIntensity:.38})),
  lamp:mesh('P4_reflection_light',new T.MeshStandardMaterial({emissive:0xffd69b,emissiveIntensity:.65})),
  water:mesh('P6_lake_water',new T.MeshStandardMaterial({color:0x4f99a4,transparent:true,opacity:.76})),
 };
 const glow=new T.MeshBasicMaterial({name:'P6_atrium_glow',color:0xffe3b8}),lights=new T.InstancedMesh(new T.CircleGeometry(.16,10),glow,3);
 for(let i=0;i<3;i++)lights.setMatrixAt(i,new T.Matrix4().makeTranslation(i*3.6,10,0));lights.name='P6_atrium_downlights';scene.add(lights);
 const stems=new T.InstancedMesh(new T.CylinderGeometry(.05,.05,.72),new T.MeshStandardMaterial({name:'P4_reflection_brass'}),2);
 for(let i=0;i<2;i++)stems.setMatrixAt(i,new T.Matrix4().makeTranslation(6+i*8,-19.32,-5.8));stems.name='P4_p6_reflection_lamp_stem';scene.add(stems);
 return {scene,hemi,fill,mats,lights,stems,day};
}
const run=(mood,frames=200)=>{for(let i=0;i<frames;i++)mood.update(1/30);};
const IN={x:0,y:-18.1,z:0},OUT={x:0,y:-50,z:0};

globalThis.location={search:'?time=night'};
const {createAtriumMood}=await import('../src/walk/atrium-mood.js?visit='+(++visit));
// The mood reads the page's own clock module; hold night there (as ?time=night does).
const clock=await import('../src/walk/ship-time.js');clock.setTimeChoice('night',{persist:false});
setAtriumView(IN);assert.equal(inOpenAtrium(),true);
const a=atrium(),glassBase=a.mats.glass.emissive.clone(),fogBase=a.scene.fog.color.clone();
const mood=createAtriumMood({hemi:a.hemi,fill:a.fill,scene:a.scene});
assert.equal(mood.night,1);run(mood);
assert.notEqual(a.mats.sky.map.image,a.day);assert.equal(a.mats.sky.map.image.width,64);
const px=a.mats.sky.map.image.getContext('2d').getImageData(32,4,1,1).data;assert(px[0]-px[2]>0x5d-0xdc+40,'dusk is warmer than the day blue');
pass('at night the sky panel shows the dusk made from its own day picture');
assert(a.mats.glass.emissive.r>.5&&a.mats.glass.opacity>.23);assert(a.mats.lamp.emissiveIntensity>1.5);assert(a.mats.soffit.emissiveIntensity>.38);
assert(a.hemi.intensity<1&&a.hemi.color.r>a.hemi.color.b);assert(a.scene.fog.color.r>a.scene.fog.color.b&&a.scene.fog.color.g<fogBase.g);
assert.equal(a.mats.water.color.getHex(),0x405e74);assert(Math.abs(a.mats.glass.emissiveIntensity-2)<1e-6);assert.equal(a.lights.material.opacity,1);
pass('night lights the glass, lamps and soffits and dims and warms the atrium light');
assert.equal(a.lights.material.name,'P6_atrium_downlight_pool');assert.equal(a.lights.count,3);assert.equal(a.lights.material.blending,T.AdditiveBlending);
const e=new T.Matrix4();a.lights.getMatrixAt(1,e);const s=new T.Vector3(),p=new T.Vector3();e.decompose(p,new T.Quaternion(),s);
assert(Math.abs(p.x-3.6)<1e-6);assert(s.x>3&&Math.abs(s.y-1)<1e-9);
pass('the downlights keep their one instanced draw and gain warm pools');
const lampPools=a.stems.getObjectByName('P6_atrium_lamp_pools');assert(lampPools?.isInstancedMesh&&lampPools.visible);assert.equal(lampPools.count,2);
assert.equal(lampPools.material.blending,T.AdditiveBlending);lampPools.getMatrixAt(1,e);assert(Math.abs(e.elements[12]-14)<1e-6&&Math.abs(e.elements[13]-(-19.32-.38+.02))<1e-6);
pass('at night the promenade lamps throw warm pools on the floor, one instanced draw');
setAtriumView(OUT);assert.equal(inOpenAtrium(),false);run(mood,1);
assert.equal(a.mats.glass.emissive.getHex(),glassBase.getHex());assert.equal(a.mats.glass.opacity,.23);assert.equal(a.mats.glass.emissiveIntensity,1);
assert.equal(a.hemi.intensity,1);assert.equal(a.hemi.color.getHex(),0xeef4ff);assert.equal(a.fill.color.getHex(),0xf2f6ff);assert.equal(a.scene.fog.color.getHex(),fogBase.getHex());
a.mats.glass.emissive.set(0x123456);run(mood,5);assert.equal(a.mats.glass.emissive.getHex(),0x123456);a.mats.glass.emissive.copy(glassBase);
pass('leaving the atrium puts the ship-wide light, fog and glass back, then leaves them alone');
clock.setTimeChoice('day',{persist:false});
setAtriumView(IN);run(mood,400);
assert.equal(mood.night,0);assert.equal(a.mats.sky.map.image,a.day);assert.equal(a.mats.glass.emissive.getHex(),glassBase.getHex());
assert.equal(a.mats.soffit.emissiveIntensity,.55);assert.equal(a.mats.lamp.emissiveIntensity,.65);assert(a.hemi.intensity>1);
assert.equal(a.mats.water.color.getHex(),0x2b9ea6);assert.equal(a.lights.material.opacity,.5);assert.equal(lampPools.visible,false);
pass('switching to Day eases back to the day sky and daylight');
console.log(checks+' checks passed');
