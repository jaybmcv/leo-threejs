import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {CABINS} from '../model.js';
import {floorY} from '../transit.js';

// Deck 15 (Neighborhood 10) dressed for Halloween, from tester feedback: as if an alien invasion has just swept through.
// While the camera is on the deck the walk's lights (shared by the whole ship) drop almost to nothing and the haze turns
// black. The lanes' ceiling diffusers are dead, but for a power surge now and then. Fluorescent tubes hang down on their
// cables, some steady, some stuttering, some dark but for a flash every few seconds, and red emergency beacons pulse on
// the walls. Glowing alien goo is splashed over the floors and walls with claw gouges, and "FEEL THE FEAR?" is daubed in
// it along the lanes. Ceiling panels have come down and lean on the walls, cables hang from the holes they left, and
// broken bits lie about. With the Sound button on, a low suspense drone and a heartbeat play while you're on the deck.
// A clown hides in three cabins' showers and gives the Halloween badge's code (see CLOWN_CABINS below).
// It is temporary: it shows until END and after that nothing here is built, so the deck is exactly as usual.
// ?halloween=0 turns it off for a visit and ?halloween=1 shows it after END. Move END to extend it; to remove it for
// good, delete this file and its lines in main.js. For visitors who ask for reduced motion nothing flashes or swings.
// Walk only: the ship's models are unchanged, and nothing here is solid.
export const END=Date.parse('2026-11-01T12:00:00Z');
export function halloweenOn(now=Date.now(),search=globalThis.location?.search||''){
 const q=new URLSearchParams(search).get('halloween');return q==='1'||(q!=='0'&&now<END);
}

// The deck (model.js createNeighborhood): five lanes along x, 26 m apart and 4 m wide, cabin fronts 2 m off each lane's
// centre with a 1.4 m door in each 4.4 m cabin; the ceiling's underside is 3.42 m up. The group sits on the floor.
const DECK=15,FLOOR=floorY(DECK),CEILING=3.42,LANES=[-52,-26,0,26,52],FACE=2;
// The goo's colour. Alien green, not blood: one value to change.
const GOO='#7dff3c',RED=0xff2a1a;
// The lights' share of their usual strength on the deck, their colours, and the haze.
const MOOD={hemi:.05,fill:.02,env:.04,sky:0x6d8494,ground:0x2a1012,fog:0x040506,near:4,far:46};
// The hanging tubes' kinds: two stuttering and two flashing sets keep neighbours out of step.
const KINDS=[['steady',.25],['stutter',.14],['stutter',.14],['flash',.14],['flash',.11],['dead',.22]];
const CABLE=.25,TUBE=1.1;

// The clown: a tall cat in a clown suit, standing in the shower of three cabins behind the ensuite's glass screen, so
// the lane never shows it: step into the cabin and turn round. E at the glass knocks. It turns its head to you, its eyes
// flare, and it gives the code for the Leo Halloween 2026 badge, claimed at CLAIM_URL. Leo live hands the code out
// (server/leo-live.mjs reads it from a file on the server), so it is never in this public code.
export const CLOWN_CABINS=['N10-163','N10-334','N10-456'],CLAIM_URL='https://oswiki.xyz/claim';
// In a cabin's own frame (model.js: the door toward -z): the shower tray's centre and top, and the glass screen's line.
const TRAY=[1.62,.08,-2.48],GLASS=-1.32;
const CODE=/^[\w-]{3,64}$/;

const paint=(geo,hex)=>{const c=new T.Color(hex),n=geo.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)c.toArray(a,i*3);
 geo.setAttribute('color',new T.BufferAttribute(a,3));return geo;};
const stripeTexture=()=>canvasTexture(256,256,(g,w,h)=>{const r=seeded(31);for(let i=0;i<8;i++){g.fillStyle=i%2?'#5a2a86':'#9be04a';g.fillRect(i*w/8,0,w/8,h);}
 g.fillStyle='rgba(20,10,10,.35)';for(let i=0;i<60;i++)g.fillRect(r()*w,r()*h,2+r()*3,4+r()*8);},[2,1]);
// The face, painted round the front of the head (u 0.25 faces +z): black diamonds round the eyes, a blue tear, a huge red
// grin full of teeth, whiskers.
const faceTexture=()=>canvasTexture(1024,512,(g,w,h)=>{
 const cx=256;g.fillStyle='#ece6d6';g.fillRect(0,0,w,h);
 g.fillStyle='#111';for(const s of [-1,1]){const ex=cx+s*62,ey=205;g.beginPath();g.moveTo(ex,ey-58);g.lineTo(ex+30,ey);g.lineTo(ex,ey+58);g.lineTo(ex-30,ey);g.closePath();g.fill();}
 g.fillStyle='#2a5bd7';g.beginPath();g.ellipse(cx+62,282,7,13,0,0,Math.PI*2);g.fill();
 g.fillStyle='#b5121b';g.beginPath();g.moveTo(cx-120,280);g.quadraticCurveTo(cx,410,cx+120,280);g.quadraticCurveTo(cx,340,cx-120,280);g.fill();
 g.fillStyle='#f4f1e4';for(let i=-4;i<=4;i++){const x=cx+i*20,y=312-Math.abs(i)*4;g.beginPath();g.moveTo(x-8,y);g.lineTo(x+8,y);g.lineTo(x,y+18);g.fill();}
 g.strokeStyle='#333';g.lineWidth=3;for(const s of [-1,1])for(const dy of [-10,4,18]){g.beginPath();g.moveTo(cx+s*80,290+dy*.4);g.lineTo(cx+s*150,280+dy);g.stroke();}
});
// A point on the head, `az` round from the front and `el` up from the middle, at radius r.
const onHead=(az,el,r)=>new T.Vector3(Math.sin(az)*Math.cos(el)*r,Math.sin(el)*r,Math.cos(az)*Math.cos(el)*r);
const along=(geo,dir,at)=>geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize())).translate(at.x,at.y,at.z);
// One clown's parts, facing +z, standing on the origin: the suit (striped), the rest of the body, the face, the rest of
// the head and the eyes. The head's parts are round its own centre, HEAD up.
const HEAD=1.66;
function clownParts(){
 const body=[],suit=[],head=[];
 for(const s of [-1,1]){
  body.push(paint(new T.BoxGeometry(.13,.09,.34).translate(s*.1,.045,.07),0xc41a1a));
  suit.push(new T.CylinderGeometry(.07,.08,.72,8).translate(s*.1,.45,0));
  suit.push(new T.CylinderGeometry(.055,.06,.6,8).rotateZ(s*.12).translate(s*.28,1.12,.03));
  body.push(paint(new T.SphereGeometry(.075,10,8).translate(s*.31,.81,.05),0xf2f0ea));
  // Ears, dark outside, and orange tufts of hair round the sides.
  head.push(paint(along(new T.ConeGeometry(.065,.15,8).translate(0,.075,0),onHead(s*.6,.9,1),onHead(s*.6,.9,.16)),0x3a1f4f));
  for(const [az,el,r] of [[1.4,.35,.085],[1.6,.05,.09],[1.75,-.25,.075],[1.25,.6,.07]])head.push(paint(new T.SphereGeometry(r,8,6).translate(...onHead(s*az,el,.19).toArray()),0xf0661c));
 }
 suit.push(new T.CylinderGeometry(.2,.27,.62,12).translate(0,1.12,0));
 for(const y of [1,1.15,1.3])body.push(paint(new T.SphereGeometry(.035,8,6).translate(0,y,.22-(y-1)*.1),0xc41a1a));
 body.push(paint(new T.TorusGeometry(.16,.055,8,18).rotateX(Math.PI/2).translate(0,1.45,0),0xf2f0ea));
 // A red nose and a little tilted hat with a bobble.
 head.push(paint(new T.SphereGeometry(.045,10,8).translate(0,0,.19),0xd0141c));
 head.push(paint(new T.ConeGeometry(.07,.2,10).rotateZ(-.35).translate(.05,.27,0),0xc41a1a),paint(new T.SphereGeometry(.035,8,6).translate(.1,.36,0),0xf2f0ea));
 const eyes=mergeGeometries([-1,1].map(s=>new T.SphereGeometry(.022,8,6).translate(...onHead(s*.38,.31,.18).toArray())));
 return {suit:mergeGeometries(suit),body:mergeGeometries(body),face:new T.SphereGeometry(.19,32,16),head:mergeGeometries(head),eyes};
}

const glowTexture=()=>canvasTexture(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
 r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
// Goo splashes: a blob, ragged lobes and flung drops.
const splatTexture=seed=>canvasTexture(512,512,(g,w,h)=>{
 const r=seeded(seed);g.fillStyle=GOO;g.shadowColor=GOO;g.shadowBlur=14;
 const blob=(x,y,s)=>{g.beginPath();g.ellipse(x,y,s,s*(.6+r()*.5),r()*3,0,Math.PI*2);g.fill();};
 blob(w/2,h/2,80+r()*30);
 for(let i=0;i<9;i++){const a=r()*Math.PI*2,d=60+r()*80;blob(w/2+Math.cos(a)*d,h/2+Math.sin(a)*d,18+r()*30);}
 for(let i=0;i<26;i++){const a=r()*Math.PI*2,d=110+r()*130;blob(w/2+Math.cos(a)*d,h/2+Math.sin(a)*d,3+r()*9);}
 g.globalAlpha=.35;for(let i=0;i<5;i++){const a=r()*Math.PI*2;g.lineWidth=6+r()*8;g.strokeStyle=GOO;g.beginPath();g.moveTo(w/2,h/2);g.lineTo(w/2+Math.cos(a)*230,h/2+Math.sin(a)*230);g.stroke();}
});
// Four claw gouges dragged down the wall, goo in the grooves.
const clawTexture=()=>canvasTexture(512,512,(g,w,h)=>{
 const r=seeded(4401);g.lineCap='round';
 for(let i=0;i<4;i++){const x0=120+i*70+r()*14,y0=60+r()*40,x1=x0+70+r()*30,y1=420+r()*50;
  for(const [width,colour,blur] of [[30,'rgba(10,14,8,.85)',0],[12,GOO,18]]){
   g.lineWidth=width*(i===0||i===3?.75:1);g.strokeStyle=colour;g.shadowColor=GOO;g.shadowBlur=blur;
   g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo((x0+x1)/2+20,(y0+y1)/2,x1,y1);g.stroke();}}
});
// "FEEL THE FEAR?" daubed with a finger of goo, running in drips.
const signTexture=()=>canvasTexture(1024,384,(g,w,h)=>{
 const r=seeded(1031);g.fillStyle=GOO;g.strokeStyle=GOO;g.shadowColor=GOO;g.shadowBlur=16;g.textBaseline='middle';
 g.font='900 112px "Archivo", system-ui, sans-serif';
 const text='FEEL THE FEAR?';let x=(w-g.measureText(text).width)/2;
 for(const c of text){g.save();g.translate(x,150+(r()-.5)*18);g.rotate((r()-.5)*.16);g.fillText(c,0,0);g.restore();x+=g.measureText(c).width+2;}
 g.lineCap='round';for(let i=0;i<22;i++){const dx=90+r()*(w-180),len=30+r()*150;g.lineWidth=4+r()*7;
  g.beginPath();g.moveTo(dx,190);g.lineTo(dx,190+len);g.stroke();g.beginPath();g.arc(dx,190+len,g.lineWidth*.9,0,Math.PI*2);g.fill();}
});

// The cabins' fronts on one side of a lane: the middle of each stretch of wall between two neighbours' doors. Neighbours
// stand 0.2 m apart; a wider gap is a cross corridor.
function walls(mid,s){
 const row=CABINS.filter(c=>c.deck===DECK&&Math.abs(c.z-(mid+s*5.2))<.1).sort((a,b)=>a.x-b.x),out=[];
 for(let i=1;i<row.length;i++){const a=row[i-1],b=row[i],x0=a.x+a.width/2,x1=b.x-b.width/2;if(x1-x0<.5&&x1<118)out.push((x0+x1)/2);}
 return out;
}
// A flat quad on a lane wall, facing into the lane, just in front of the lining's panels (2.2 cm proud, wall-kit.js),
// or on the floor. Lights and glows ignore the deck's black haze, as a lamp in a dark corridor would.
const onWall=(mid,s,x,y,w,h)=>{const g=new T.PlaneGeometry(w,h);if(s>0)g.rotateY(Math.PI);return g.translate(x,y,mid+s*(FACE-.035));};
const onFloor=(x,z,size,turn)=>new T.PlaneGeometry(size,size).rotateX(-Math.PI/2).rotateY(turn).translate(x,.016,z);

// `sheet`: the clown's card (walk.html #clown-sheet).
export function createHalloween(ship,light,{still=false,sheet=null}={}){
 if(typeof document==='undefined'||!light||!halloweenOn())return null;
 const r=seeded(1015),group=new T.Group();group.name='Deck15_halloween';group.position.y=FLOOR;
 // The lanes' ceiling diffusers go dead (a copy of their material, on this deck only), before the walk merges them.
 const dead=new T.MeshStandardMaterial({name:'Walk_halloween_diffusers',color:0x34383a,emissive:0xf6eed9,emissiveIntensity:0,roughness:.6});
 ship.root.updateMatrixWorld(true);
 ship.root.traverse(o=>{if(!o.isMesh||o.name!=='Residential_corridor_diffusers')return;
  const y=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).y-FLOOR;if(y>3&&y<3.6)o.material=dead;});

 // Hanging tubes where some of the diffusers were, each swinging a little on its last cable.
 const lamps=[];
 for(const mid of LANES)for(let x=-117;x<=123;x+=9.2){if(r()>.48)continue;
  let k=0,pick=r();while(pick>KINDS[k][1]&&k<KINDS.length-1){pick-=KINDS[k][1];k++;}
  lamps.push({kind:k,at:new T.Vector3(x+(r()-.5)*.6,CEILING-.02,mid+(r()-.5)*.8),heading:(r()<.5?0:Math.PI)+(r()-.5)*.6,lean:.3+r()*.4,phase:r()*7,rate:.5+r()*.5});}
 const tubeGeo=new T.CylinderGeometry(.045,.045,TUBE,8).translate(0,-CABLE-TUBE/2,0);
 const darkGeo=mergeGeometries([new T.CylinderGeometry(.008,.008,CABLE,4).translate(0,-CABLE/2,0),
  new T.BoxGeometry(.08,.06,.08).translate(0,-CABLE,0),new T.BoxGeometry(.08,.06,.08).translate(0,-CABLE-TUBE,0)]);
 const darkMat=new T.MeshStandardMaterial({name:'Walk_halloween_fitting',color:0x2b2e30,roughness:.7,metalness:.3});
 const glow=glowTexture(),pose=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),one=new T.Vector3(1,1,1),mid=new T.Vector3();
 const fittings=new T.InstancedMesh(darkGeo,darkMat,lamps.length);fittings.name='Halloween_lamp_fittings';group.add(fittings);
 const sets=KINDS.map(([kind],k)=>{
  const mine=lamps.filter(l=>l.kind===k);if(kind==='dead'||!mine.length)return {kind,lamps:mine};
  const tubeMat=new T.MeshBasicMaterial({name:'Walk_halloween_tube',color:0xdff6ff,toneMapped:false,fog:false});
  const tubes=new T.InstancedMesh(tubeGeo,tubeMat,mine.length);tubes.name='Halloween_tubes';
  const poolMat=new T.MeshBasicMaterial({name:'Walk_halloween_pool',map:glow,color:0x8fb4c4,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});
  const pools=new T.InstancedMesh(new T.PlaneGeometry(3,3).rotateX(-Math.PI/2).translate(0,.02,0),poolMat,mine.length);pools.name='Halloween_light_pools';
  const halo=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(mine.length*3),3)),
   new T.PointsMaterial({name:'Walk_halloween_halo',map:glow,size:1.5,color:0xbfe6ff,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));
  halo.name='Halloween_tube_halos';halo.frustumCulled=false;
  // Each pool lies on the floor under its tube's middle at rest.
  mine.forEach((l,i)=>{l.tube=i;q.setFromEuler(e.set(0,l.heading,l.lean,'YZX'));mid.set(0,-CABLE-TUBE/2,0).applyQuaternion(q).add(l.at);
   pools.setMatrixAt(i,pose.makeTranslation(mid.x,0,mid.z));});
  group.add(tubes,pools,halo);
  return {kind,lamps:mine,tubes,pools,halo,mats:[tubeMat,poolMat,halo.material],tint:tubeMat.color.clone(),level:1,next:r()*4,flash:0};
 });
 lamps.forEach((l,i)=>l.index=i);
 function hang(t){
  for(const l of lamps){
   const swing=still?0:Math.sin(t*l.rate+l.phase)*.06;
   q.setFromEuler(e.set(0,l.heading,l.lean+swing,'YZX'));pose.compose(l.at,q,one);fittings.setMatrixAt(l.index,pose);
   const set=sets[l.kind];if(!set.tubes)continue;set.tubes.setMatrixAt(l.tube,pose);
   mid.set(0,-CABLE-TUBE/2,0).applyQuaternion(q).add(l.at);set.halo.geometry.attributes.position.setXYZ(l.tube,mid.x,mid.y,mid.z);
  }
  fittings.instanceMatrix.needsUpdate=true;
  for(const s of sets)if(s.tubes){s.tubes.instanceMatrix.needsUpdate=true;s.halo.geometry.attributes.position.needsUpdate=true;}
 }
 hang(0);

 // Red emergency beacons on the walls between doors, about every 22 m, each washing the wall round it.
 const beacons=[];
 for(const mid of LANES)[-1,1].forEach(s=>{let last=-200+(s>0?11:0);for(const x of walls(mid,s))if(x-last>=22){last=x;beacons.push({mid,s,x});}});
 const redMat=new T.MeshBasicMaterial({name:'Walk_halloween_beacon',color:RED,toneMapped:false,fog:false});
 const washMat=new T.MeshBasicMaterial({name:'Walk_halloween_wash',map:glow,color:RED,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});
 const lamp=mergeGeometries(beacons.map(b=>new T.BoxGeometry(.26,.12,.08).translate(b.x,2.72,b.mid+b.s*(FACE-.04))));
 const wash=mergeGeometries(beacons.map(b=>onWall(b.mid,b.s,b.x,2.45,1.8,1.8)));
 const beaconMesh=new T.Mesh(lamp,redMat),washMesh=new T.Mesh(wash,washMat);beaconMesh.name='Halloween_beacons';washMesh.name='Halloween_beacon_wash';
 group.add(beaconMesh,washMesh);

 // Goo on the floors, goo and claw gouges on the walls, and the signs.
 const floor=[],splash=[],claws=[],signs=[],taken=new Set();
 for(const mid of LANES){
  // Floor splashes stay clear of the walls, so none runs under a wall into a cabin.
  for(let x=-120;x<=120;x+=6)if(r()<.42){const size=.8+r()*1.6;floor.push(onFloor(x+(r()-.5)*4,mid+(r()-.5)*2*Math.max(0,FACE-.1-size/2),size,r()*6));}
  [-1,1].forEach(s=>{let lastSign=-200+(s>0?20:0);
   for(const x of walls(mid,s)){
    if(x-lastSign>40&&r()<.5){lastSign=x;signs.push(onWall(mid,s,x,1.75,2.4,.9));taken.add(`${mid}:${s}:${x}`);continue;}
    const roll=r();
    if(roll<.1)claws.push(onWall(mid,s,x+(r()-.5)*1.4,1.4+r()*.6,1.1,1.1));
    else if(roll<.18)splash.push(onWall(mid,s,x+(r()-.5)*1.2,.4+r()*1.6,.7+r()*.8,.7+r()*.8));
   }});
 }
 const decal=(list,map,name)=>{if(!list.length)return;const m=new T.Mesh(mergeGeometries(list),new T.MeshBasicMaterial({name,map,transparent:true,depthWrite:false,toneMapped:false,color:0xb8b8b8,polygonOffset:true,polygonOffsetFactor:-4}));m.name=name;group.add(m);};
 decal(floor,splatTexture(77),'Halloween_floor_goo');decal(splash,splatTexture(91),'Halloween_wall_goo');decal(claws,clawTexture(),'Halloween_claw_marks');decal(signs,signTexture(),'Halloween_signs');

 // Wreckage, with its own dice so the marks above stay put: a ceiling panel fallen against the wall between two doors,
 // broken bits round it, and the hole it left over the lane's edge with cables hanging out. Never under a sign.
 const w=seeded(666),fallen=[],holes=[],wires=[],bits=[];
 for(const mid of LANES)[-1,1].forEach(s=>{for(const x of walls(mid,s)){if(taken.has(`${mid}:${s}:${x}`)||w()>.11)continue;
  const tilt=.25+w()*.25,len=1.1+w()*.3;
  fallen.push(new T.BoxGeometry(.62,len,.03).rotateX(s*tilt).translate(x+(w()-.5)*.8,len/2*Math.cos(tilt),mid+s*(FACE-.06-len/2*Math.sin(tilt))));
  for(let i=0;i<5;i++)bits.push(new T.BoxGeometry(.05+w()*.14,.02+w()*.05,.05+w()*.12).rotateY(w()*3).translate(x+(w()-.5)*1.6,.02,mid+s*(FACE-.3-w()*.9)));
  const hx=x+(w()-.5)*2,hz=mid+s*(.9+w()*.4);holes.push(new T.PlaneGeometry(.62,1.2).rotateX(Math.PI/2).translate(hx,CEILING-.006,hz));
  for(let i=0;i<3;i++){const l=.3+w()*.9;wires.push(new T.CylinderGeometry(.012,.012,l,4).translate(0,-l/2,0).rotateX((w()-.5)*.5).rotateZ((w()-.5)*.5).translate(hx+(w()-.5)*.4,CEILING,hz+(w()-.5)*.8));}
 }});
 const panelMat=new T.MeshStandardMaterial({name:'Walk_halloween_fallen',color:0xb9bdbd,roughness:.6,metalness:.2});
 const holeMat=new T.MeshBasicMaterial({name:'Walk_halloween_hole',color:0x020203,polygonOffset:true,polygonOffsetFactor:-2});
 for(const [list,mat,name] of [[[...fallen,...bits],panelMat,'Halloween_fallen_panels'],[holes,holeMat,'Halloween_ceiling_holes'],[wires,darkMat,'Halloween_hanging_cables']]){
  if(!list.length)continue;const m=new T.Mesh(mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),mat);m.name=name;group.add(m);}

 // The clowns, each in its cabin's shower, lit by a sickly green light that stutters. Unlit materials scaled by that
 // light, so they read in the dark cabin whatever the deck's lights are doing.
 const parts=clownParts(),clownMats={
  suit:new T.MeshBasicMaterial({name:'Walk_clown_suit',map:stripeTexture()}),body:new T.MeshBasicMaterial({name:'Walk_clown',vertexColors:true}),
  face:new T.MeshBasicMaterial({name:'Walk_clown_face',map:faceTexture()}),eyes:new T.MeshBasicMaterial({name:'Walk_clown_eyes',color:0xff2010,toneMapped:false})};
 const clowns=CLOWN_CABINS.map(id=>CABINS.find(c=>c.id===id)).filter(Boolean).map(c=>{
  const k=Math.sign(c.z-Math.round(c.z/26)*26)||1,g=new T.Group(),head=new T.Group();g.name='Halloween_clown';
  g.position.set(c.x+k*TRAY[0],TRAY[1],c.z+k*TRAY[2]);g.rotation.y=k>0?0:Math.PI;
  g.add(new T.Mesh(parts.suit,clownMats.suit),new T.Mesh(parts.body,clownMats.body));
  head.position.y=HEAD;head.add(new T.Mesh(parts.face,clownMats.face),new T.Mesh(parts.head,clownMats.body),new T.Mesh(parts.eyes,clownMats.eyes));
  g.add(head);group.add(g);
  return {cabin:c,k,g,head,yaw:0,tilt:0,flare:0,phase:r()*6};
 });
 const lampPts=new Float32Array(clowns.length*3);clowns.forEach((c,i)=>lampPts.set([c.g.position.x,2.3,c.g.position.z],i*3));
 const showerLight=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(lampPts,3)),
  new T.PointsMaterial({name:'Walk_clown_light',map:glow,size:1.4,color:0x9dff7a,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
 showerLight.name='Halloween_clown_light';showerLight.frustumCulled=false;group.add(showerLight);
 const flicker={level:.6,next:1};
 // Where a visitor stands, in a clown's cabin frame; null outside that cabin.
 const inCabin=(c,p)=>{const dx=(p.x-c.cabin.x)*c.k,dz=(p.z-c.cabin.z)*c.k;return p.y>FLOOR-.5&&p.y<FLOOR+3.4&&Math.abs(dx)<2&&dz>-3&&dz<3.1?{dx,dz}:null;};

 // The clown's card: the code from Leo live, or word that it isn't out yet.
 const text=sheet?.querySelector('.clown-text'),codeEl=sheet?.querySelector('.clown-code'),claim=sheet?.querySelector('.clown-claim');
 let waiting=0;
 function show(code){
  if(!sheet)return;clearTimeout(waiting);const ok=typeof code==='string'&&CODE.test(code);
  text.textContent=code===undefined?'It presses its face to the glass…':ok?'It breathes on the glass and writes a code in the fog. Claim your Leo Halloween 2026 badge with it:':
   'It only grins and taps the glass. The badge code isn\'t out yet: come back before 1 November.';
  codeEl.textContent=ok?code:'';codeEl.hidden=!ok;claim.hidden=!ok;claim.href=CLAIM_URL;
 }

 // The deck's sound: a low drone, two close high tones beating against each other, and now and then a heartbeat.
 let ctx=null,master=null,lastSound=false;
 function sound(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=170;low.Q.value=3;low.connect(master);
  for(const f of [41.2,41.8,61.9]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;const v=ctx.createGain();v.gain.value=.1;o.connect(v).connect(low);o.start();}
  const breathe=ctx.createOscillator();breathe.frequency.value=.07;const depth=ctx.createGain();depth.gain.value=80;breathe.connect(depth).connect(low.frequency);breathe.start();
  const high=ctx.createGain();high.gain.value=.5;high.connect(master);
  for(const f of [880,932.3]){const o=ctx.createOscillator();o.frequency.value=f;const v=ctx.createGain();v.gain.value=.012;o.connect(v).connect(high);o.start();}
  const swell=ctx.createOscillator();swell.frequency.value=.045;const sd=ctx.createGain();sd.gain.value=.5;swell.connect(sd).connect(high.gain);swell.start();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else ctx.resume();});
 }
 function thump(at,g){const o=ctx.createOscillator();o.frequency.setValueAtTime(70,at);o.frequency.exponentialRampToValueAtTime(38,at+.18);
  const v=ctx.createGain();v.gain.setValueAtTime(0,at);v.gain.linearRampToValueAtTime(g,at+.015);v.gain.exponentialRampToValueAtTime(.0001,at+.3);o.connect(v).connect(master);o.start(at);o.stop(at+.32);}
 // The clown's laugh: five falling "ha"s, a buzzing voice through a band like a mouth.
 function laugh(){
  const now=ctx.currentTime+.05,band=ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=900;band.Q.value=3;band.connect(master);
  for(let i=0;i<5;i++){const at=now+i*.21,o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(330-i*22,at);o.frequency.linearRampToValueAtTime(300-i*24,at+.15);
   const v=ctx.createGain();v.gain.setValueAtTime(0,at);v.gain.linearRampToValueAtTime(.5,at+.02);v.gain.exponentialRampToValueAtTime(.001,at+.16);o.connect(v).connect(band);o.start(at);o.stop(at+.18);}
 }

 // The shared lights' usual values, to ease from and back to.
 const {hemi,fill,scene}=light,fog=scene.fog,base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,
  sky:hemi.color.clone(),ground:hemi.groundColor.clone(),fog:fog?.color.clone(),near:fog?.near,far:fog?.far};
 const sky=new T.Color(MOOD.sky),ground=new T.Color(MOOD.ground),black=new T.Color(MOOD.fog);
 let t=0,mood=0,shown=0,surge=0,surgeAt=8+r()*8,steps=[],heartAt=6;
 function setMood(m,s){const f=(a,b)=>a+(b-a)*m,up=1+s*1.6;
  hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi*up);fill.intensity=f(base.fill,base.fill*MOOD.fill*up);scene.environmentIntensity=f(base.env,base.env*MOOD.env*up);
  hemi.color.lerpColors(base.sky,sky,m);hemi.groundColor.lerpColors(base.ground,ground,m);
  if(fog){fog.color.lerpColors(base.fog,black,m);fog.near=f(base.near,MOOD.near);fog.far=f(base.far,MOOD.far);}}
 // A tube's brightness for its kind. Changes come at least 0.18 s apart, so nothing flashes more than three times a second.
 function level(set,dt){
  if(still)return set.kind==='flash'?.25:.6;
  set.next-=dt;
  if(set.kind==='steady')return .62+Math.sin(t*31)*.03;
  if(set.kind==='stutter'){if(set.next<=0){const off=set.level>.5;set.level=off?.04:.8;set.next=off?.18+r()*.25:(r()<.7?.18+r()*.3:1.5+r()*4);}return set.level;}
  if(set.next<=0){if(set.flash>0){set.flash=0;set.next=3+r()*4;}else{set.flash=1;set.next=.12+r()*.08;}}
  return set.flash?1:.03;
 }
 return {
  group,
  update(dt,eye,soundOn){
   t+=dt;if(!still)hang(t);
   for(const s of sets){if(!s.tubes)continue;const v=level(s,dt);s.mats[0].color.copy(s.tint).multiplyScalar(.12+v*1.3);s.mats[1].opacity=v*.7;s.mats[2].opacity=v*.8;}
   washMat.opacity=still?.35:.15+.35*(.5+.5*Math.sin(t*4.4));redMat.color.setHex(RED).multiplyScalar(still?.8:.45+.55*(.5+.5*Math.sin(t*4.4)));
   // Now and then the power surges back: the dead diffusers and the deck's light stutter on, then die again.
   if(!still&&(surgeAt-=dt)<=0){surgeAt=10+r()*14;steps=[[.15,1],[.4,0],[.7,.8]];}
   if(steps.length){steps[0][0]-=dt;surge=steps[0][1];if(steps[0][0]<=0)steps.shift();}else surge=0;
   dead.emissiveIntensity=surge*.45;
   // Arriving on the deck from a link, it's dark already; walking in, the dark comes on over a second or so.
   const on=eye.y>FLOOR-.3&&eye.y<FLOOR+3.9;
   if(t===dt)mood=on?1:0;else mood+=((on?1:0)-mood)*(1-Math.exp(-3*dt));
   if(mood>.002||shown){shown=mood>.002?mood:0;setMood(shown,shown?surge:0);}
   // The sound follows the Sound button and fades in as you arrive on the deck.
   if(soundOn&&shown&&!ctx)sound();
   if(ctx){master.gain.setTargetAtTime(soundOn?shown*.45:0,ctx.currentTime,.4);
    if(soundOn&&shown>.5&&(heartAt-=dt)<=0){heartAt=14+r()*12;const now=ctx.currentTime;for(let i=0;i<6;i++){thump(now+i*1.05,.5);thump(now+i*1.05+.28,.32);}}}
   lastSound=soundOn;
   // The clowns' light stutters. Each head follows whoever is in its cabin, or sways; after a knock the eyes flare.
   if(!still&&(flicker.next-=dt)<=0){const off=flicker.level>.3;flicker.level=off?.08:.45+r()*.25;flicker.next=off?.18+r()*.4:.5+r()*3;}
   const lit=still?.55:flicker.level;let flare=0;
   for(const m of [clownMats.suit,clownMats.body,clownMats.face])m.color.setScalar(lit);showerLight.material.opacity=lit*.9;
   for(const c of clowns){
    const at=inCabin(c,eye),yaw=at?Math.max(-1.1,Math.min(1.1,Math.atan2(at.dx-TRAY[0],at.dz-TRAY[2]))):still?0:Math.sin(t*.3+c.phase)*.25;
    c.yaw+=(yaw-c.yaw)*(1-Math.exp(-(c.flare>0?12:2)*dt));c.flare=Math.max(0,c.flare-dt*.5);flare=Math.max(flare,c.flare);
    c.head.rotation.set((still?0:.1*Math.sin(t*.5+c.phase))+c.flare*.2,c.yaw,0);
   }
   clownMats.eyes.color.setHex(0xff2010).multiplyScalar(.6+flare*3);
  },
  // E at the glass of a clown's shower knocks.
  near(p){
   for(const [i,c] of clowns.entries()){const at=inCabin(c,p);if(at&&at.dz>GLASS&&Math.hypot(at.dx-1.45,at.dz-GLASS-.45)<1.3)return {kind:'clown',clown:i,label:'Knock on the glass'};}
   return null;
  },
  // The knock: the clown flares and laughs, and its card opens to wait for the code `ask` sends for (false when there's
  // no Leo live to ask); with no answer in 4 s the card says the code isn't out yet.
  knock(i,ask){
   if(clowns[i])clowns[i].flare=1;if(ctx&&lastSound)laugh();
   if(!sheet)return;sheet.hidden=false;show(undefined);if(ask?.())waiting=setTimeout(()=>show(null),4000);else show(null);
  },
  got(code){if(sheet&&!sheet.hidden)show(code);},
 };
}
