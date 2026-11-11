import * as T from 'three';
import {inOpenAtrium} from '../v2/atrium-visibility.js';
import {walkCanvas} from './canvas.js';
import {nightTarget,subscribeTime} from './ship-time.js';
import {paintDuskSky,paintDownlightPool,paintLampPool} from './atrium-light-paint.js';
import layout from '../plan/selected-layout.js';
import {welcomeCourtGlows} from '../v2/welcome-court.js';

// 4B: the atrium's own warm golden light. The ship-wide base stays the cool 2B light; while the walker is in the open
// atrium (the Deck 6 floor or a balcony facing it, as atrium-visibility.js classifies it) the shared lights ease to a
// warm tint, like the lounge and recovery moods do for their rooms. No lights are added, so it costs nothing per frame
// beyond a few colour lerps.
// The tint follows the ship's clock (ship-time.js). Day is concept A softened: warm golden daylight, warmer cream walls,
// soft pools of light under the balconies, deeper turquoise water. Night is concept C: a dusk sky panel, windows and
// balcony glass lit warm from inside, every downlight and promenade lamp on. Intensities multiply the base light.
// Tuned side by side with the concepts on a GPU render that matches the live site (three r187, its baked environment
// light on): golden undersides by day; at night a pink-lavender dusk light, rooms glowing amber behind the balcony glass.
const DAY={hemi:1.35,fill:1.13,env:.55,sky:0xffcf9c,ground:0xc8a070,fillColour:0xffe0c0,fog:0xf2dcc4};
// Night is a dusk interior: the sky light drops well below day so the building's own light carries the scene, and the
// undersides fall off between the downlights. The fill turns into a warm overhead glow standing for the downlights, so
// the floor reads lamp-lit peach as in concept C while the walls stay dim behind the amber rooms.
const NIGHT={hemi:.34,fill:.91,env:.15,sky:0xe0a8a8,ground:0xb08870,fillColour:0xffb894,fog:0x8a7080,glass:0xffa04a,glassOpacity:1.96,glassIntensity:2};
// What only the atrium shows follows the time of day wherever the walker is. Day, then night. The rooms go above 1 so
// they glow amber through the tone mapping; a plain colour tops out at tan.
const WATER=[new T.Color(0x2b9ea6),new T.Color(0x4a7086)],RETURNS_NIGHT=new T.Color(0xffb35a).multiplyScalar(1.9),POOLS=[.5,1];
const SOFFIT=[{emissive:new T.Color(0xffd090),intensity:.55},{emissive:new T.Color(0xffc890),intensity:.55}];
const LAMP_NIGHT=4;
// Warm pools of lamplight on the floor round the promenade lamps at night, LAMP_POOL m across, at LAMP_POOL_OPACITY so
// they stay a glow on the peach floor rather than a white blot. The lamp stems stand with their middle STEM_RISE above
// the floor (phase6-programme.js, reflection-terraces.js).
const LAMP_POOL=6,LAMP_POOL_OPACITY=.5,STEM_RISE=.38;
// Shared with the rest of the ship, so changed only while the walker is in the open atrium.
const SHARED=new Set(['V2_smart_glass','V2_cabin_view_glass']);
const OWN=new Set(['P6_lake_water','V2_atrium_soffit','P4_reflection_light','P6_atrium_room_returns']);
const POOL_SCALE=3.2,SKY_STEPS=16,NIGHT_EASE=2;
const lerp=(a,b,t)=>a+(b-a)*t;

// The atrium's pieces, looked for by material name (authored, prepared and distant copies alike) every 2 s for the
// first 30 s, so meshes that arrive late join in. Each material keeps the values it was loaded with. The waterfall's
// streaks (atrium-gardens.js, P6_atrium_waterfall) scroll down at about 2 m/s while the walker is in the open atrium;
// its texture is shared by the near and distant copies, so one offset moves them all.
function finder(scene){
 const found={fall:null,downlights:null,stems:null,skies:new Set(),materials:new Map()};let tries=0,next=0;
 // A material joins untouched (nothing changes it before it is kept), so what it holds then is its own. Glass and soffit
 // copies without an emissive colour (a Basic stand-in) are left alone.
 const keep=m=>{if((SHARED.has(m.name)||m.name==='V2_atrium_soffit')&&!m.emissive)return;if(!found.materials.has(m))found.materials.set(m,{colour:m.color?.clone(),emissive:m.emissive?.clone(),intensity:m.emissiveIntensity,opacity:m.opacity});};
 return()=>{
  const now=performance.now();if(tries>=15||now<next)return found;next=now+2000;tries++;
  scene.traverse(o=>{if(!o.isMesh)return;if(o.isInstancedMesh&&o.name==='P6_atrium_downlights')found.downlights??=o;
   if(o.isInstancedMesh&&o.name==='P4_p6_reflection_lamp_stem'&&!o.material?.isMeshBasicMaterial)found.stems??=o;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;
    if(m.name==='P6_atrium_waterfall'&&m.map)found.fall??=m.map;
    if(/P6_sky_ceiling$/.test(m.name)&&m.map)found.skies.add(m.map);
    if(SHARED.has(m.name)||OWN.has(m.name))keep(m);}});
  return found;
 };
}

// The sky panel's picture: the authored day sky, concept C's dusk made from it, or the two mixed in SKY_STEPS steps.
// Swapped on the texture every copy shares, so the near, distant and phone panels change together.
const skies=new Map(),skyShown=new WeakMap();
const loaded=image=>!!image&&image.complete!==false&&(image.width||image.naturalWidth)>0;
function skyImage(s,q){
 if(q===0)return s.day;
 if(!s.dusk){const c=walkCanvas();if(!c)return null;s.dusk=paintDuskSky(c,s.day);}
 if(q===1)return s.dusk;
 if(!s.mix){s.mix=walkCanvas();s.mix.width=s.dusk.width;s.mix.height=s.dusk.height;}
 const g=s.mix.getContext('2d');g.globalAlpha=1;g.drawImage(s.day,0,0,s.mix.width,s.mix.height);g.globalAlpha=q;g.drawImage(s.dusk,0,0);g.globalAlpha=1;return s.mix;
}
function showSky(maps,n){
 const q=Math.round(n*SKY_STEPS)/SKY_STEPS;
 for(const map of maps){
  let s=skies.get(map.source);
  if(!s){if(!loaded(map.image))continue;skies.set(map.source,s={day:map.image,image:map.image,q:0,version:0});}
  if(s.q!==q){const image=skyImage(s,q);if(!image)continue;s.image=image;s.q=q;s.version++;}
  if((skyShown.get(map)??0)!==s.version){map.image=s.image;map.needsUpdate=true;skyShown.set(map,s.version);}
 }
}

// The downlights become lamps with a soft warm pool round each on the soffit: one additive texture on the same
// instanced draw, its discs scaled up to hold the pool. Faint by day, full at night.
function lightPools(mesh){
 const c=walkCanvas();if(!c)return null;
 const map=new T.CanvasTexture(paintDownlightPool(c));map.colorSpace=T.SRGBColorSpace;
 const m=new T.MeshBasicMaterial({name:'P6_atrium_downlight_pool',map,color:mesh.material.color,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const at=new T.Matrix4(),scale=new T.Matrix4().makeScale(POOL_SCALE,1,POOL_SCALE);
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,at);mesh.setMatrixAt(i,at.multiply(scale));}
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.material=m;return m;
}

// The promenade lamps' pools of light on the floor: one instanced draw of flat additive discs, a child of the lamps'
// own instanced stems (so it shows and hides with them), on the floor under each stem. Shown only at night, so by day
// it costs nothing. The culling (phase4-culling.js) packs the lamps in sight to the front of the stems' matrices and
// sets their count, so the pools are placed again whenever those change (placePools): a pool shows where a lamp does.
function lampPools(stems){
 const c=walkCanvas();if(!c)return null;
 const map=new T.CanvasTexture(paintLampPool(c));map.colorSpace=T.SRGBColorSpace;
 const m=new T.MeshBasicMaterial({name:'P6_atrium_lamp_pool',map,transparent:true,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const o=new T.InstancedMesh(new T.PlaneGeometry(LAMP_POOL,LAMP_POOL).rotateX(-Math.PI/2),m,stems.instanceMatrix.count);
 o.name='P6_atrium_lamp_pools';o.userData.noCollide=true;o.visible=false;o.count=0;stems.add(o);return o;
}
const stemAt=new T.Matrix4(),stemFoot=new T.Vector3();
function placePools(stems,o){
 for(let i=0;i<stems.count;i++){stems.getMatrixAt(i,stemAt);stemFoot.setFromMatrixPosition(stemAt);o.setMatrixAt(i,stemAt.makeTranslation(stemFoot.x,stemFoot.y-STEM_RISE+.02,stemFoot.z));}
 o.count=stems.count;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();
}

// The welcome court's lantern light (welcome-court.js): a warm pool under each of its four lamps, a halo round each
// lantern and uplights at the foot of its planters, as one instanced draw of soft additive squares with the promenade
// pools' picture, tinted per kind. Its lanterns' cores are in the garden glow draw, which is one colour day and night,
// so the light they throw is this instead: shown only at night while the walker is in the open atrium, so by day it
// costs nothing and leaves no mark.
const COURT_GLOW={pool:.55,halo:.7,uplight:1};
function courtGlows(scene){
 const c=walkCanvas();if(!c)return null;
 const map=new T.CanvasTexture(paintLampPool(c));map.colorSpace=T.SRGBColorSpace;
 const m=new T.MeshBasicMaterial({name:'P6_atrium_court_glow',map,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const glows=welcomeCourtGlows(layout.decks[5].y),o=new T.InstancedMesh(new T.PlaneGeometry(1,1),m,glows.length);
 const at=new T.Matrix4(),turn=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(),tint=new T.Color();
 glows.forEach((g,i)=>{o.setMatrixAt(i,at.compose(p.fromArray(g.at),turn.setFromEuler(e.set(g.tilt,g.turn,0,'YXZ')),s.set(g.size,g.size,1)));o.setColorAt(i,tint.setScalar(COURT_GLOW[g.kind]));});
 o.computeBoundingSphere();o.name='P6_atrium_court_glows';o.userData.noCollide=true;o.visible=false;scene.add(o);return o;
}

function showOwn(found,n,pools,floorPools){
 if(pools)pools.opacity=lerp(POOLS[0],POOLS[1],n);
 if(floorPools){floorPools.visible=n>.01;floorPools.material.opacity=n*LAMP_POOL_OPACITY;}
 for(const [m,b] of found.materials)switch(m.name){
  case 'P6_lake_water':m.color.lerpColors(WATER[0],WATER[1],n);break;
  case 'V2_atrium_soffit':m.emissive.lerpColors(SOFFIT[0].emissive,SOFFIT[1].emissive,n);m.emissiveIntensity=lerp(SOFFIT[0].intensity,SOFFIT[1].intensity,n);break;
  case 'P4_reflection_light':m.emissiveIntensity=b.intensity*lerp(1,LAMP_NIGHT,n);break;
  case 'P6_atrium_room_returns':m.color.lerpColors(b.colour,RETURNS_NIGHT,n);break;
 }
}
function showShared(found,glass,amount){
 for(const [m,b] of found.materials)if(SHARED.has(m.name)){m.emissive.lerpColors(b.emissive,glass,amount);m.emissiveIntensity=b.intensity*lerp(1,NIGHT.glassIntensity,amount);m.opacity=b.opacity*lerp(1,NIGHT.glassOpacity,amount);}
}

export function createAtriumMood(light){
 if(!light)return null;
 const {hemi,fill,scene}=light,find=finder(scene);
 const base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone(),fillColour:fill.color.clone(),fog:scene.fog?.color.clone()};
 const pair=k=>[new T.Color(DAY[k]),new T.Color(NIGHT[k])],colours={sky:pair('sky'),ground:pair('ground'),fillColour:pair('fillColour'),fog:pair('fog')};
 const keys=Object.keys(colours),now=Object.fromEntries(keys.map(k=>[k,new T.Color()])),glass=new T.Color(NIGHT.glass);
 let mood=0,shown=0,n=nightTarget(),target=n,nextClock=0,pools=null,poolsTried=false,floorPools=null,stemsTried=false,stemsPlaced=-1,ownAt=-1,ownCount=-1,court=null,courtTried=false;
 // The clock is read once a second; a choice made in the Graphics detail sheet takes effect at once.
 subscribeTime(()=>{nextClock=0;});
 // The light for t (0 the ship's base, 1 the atrium's own) at the current time of day n.
 function setMood(t,found){const f=(a,b)=>a+(b-a)*t;
  for(const k of keys)now[k].lerpColors(colours[k][0],colours[k][1],n);
  hemi.intensity=f(base.hemi,base.hemi*lerp(DAY.hemi,NIGHT.hemi,n));fill.intensity=f(base.fill,base.fill*lerp(DAY.fill,NIGHT.fill,n));
  scene.environmentIntensity=f(base.env,base.env*lerp(DAY.env,NIGHT.env,n));
  hemi.color.lerpColors(base.sky,now.sky,t);hemi.groundColor.lerpColors(base.ground,now.ground,t);fill.color.lerpColors(base.fillColour,now.fillColour,t);
  if(base.fog&&scene.fog)scene.fog.color.lerpColors(base.fog,now.fog,t);
  showShared(found,glass,n*t);}
 return {
  // Runs before the room moods each frame. Inside the atrium it reapplies its whole state every frame (so a room mood
  // that settles while the walker crosses back in cannot leave its own light behind); on leaving it restores the base
  // exactly once and then never writes again, so a room mood that takes over is never overwritten by a fade.
  update(dt){
   const step=Math.min(dt,.1),found=find(),time=performance.now();
   if(time>=nextClock){target=nightTarget();nextClock=time+1000;}
   n=Math.abs(target-n)<1e-3?target:n+(target-n)*(1-Math.exp(-NIGHT_EASE*step));
   if(found.downlights&&!poolsTried){poolsTried=true;pools=lightPools(found.downlights);ownAt=-1;}
   if(found.stems&&!stemsTried){stemsTried=true;floorPools=lampPools(found.stems);ownAt=-1;}
   if(ownAt!==n||ownCount!==found.materials.size){showOwn(found,n,pools,floorPools);ownAt=n;ownCount=found.materials.size;}
   if(floorPools?.visible&&stemsPlaced!==found.stems.instanceMatrix.version){stemsPlaced=found.stems.instanceMatrix.version;placePools(found.stems,floorPools);}
   if(!courtTried){courtTried=true;court=courtGlows(scene);}
   if(court){court.visible=n>.01&&inOpenAtrium();court.material.opacity=n;}
   showSky(found.skies,n);
   if(inOpenAtrium()){mood+=(1-mood)*(1-Math.exp(-3*step));shown=mood;setMood(mood,found);if(found.fall)found.fall.offset.y=(found.fall.offset.y+step*.9)%1;}
   else if(shown){mood=shown=0;setMood(0,found);}
  },
  get mood(){return shown;},
  // 0 day, 1 night (ship-time.js), easing over about two seconds when the choice changes.
  get night(){return n;},
 };
}
