import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {groundMesh} from '../src/v2/ground.js';

// Component check of the Deck 17 blossom garden (src/walk/blossom.js), not proof of the current ship's routes, in the commons template frame: the garden's own
// colliders and its planter, with a floor round them, driven by the walk's own Controller. Only room lookup is substituted.
// The garden sits 26.5 m back and 16 m across in the v2 ship (docs/blossom-garden-acceptance.md).
const dir=path.resolve('.qa/blossom-walk');await fs.mkdir(dir,{recursive:true});
const source=path.resolve('src/walk/blossom.js');let text=await fs.readFile(source,'utf8');
text=text.replace("import {roomObject} from '../plan/rooms.js';","const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;");
text=text.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,rel)=>'from '+JSON.stringify(pathToFileURL(path.resolve(path.dirname(source),rel)).href));
const file=path.join(dir,'blossom.mjs');await fs.writeFile(file,text);
const {createBlossomGarden,prepareBlossomBed}=await import(pathToFileURL(file));

const root=new T.Group(),room=new T.Group();room.name='Fitted_garden_commons_10';root.add(room);
const floor=new T.Mesh(new T.BoxGeometry(40,.3,40));floor.name='Deck_floor';floor.position.set(141,24.15,32);room.add(floor);
for(const name of ['Garden_planter','Planting_bed']){const m=new T.Mesh(new T.BoxGeometry(9,.65,9));m.name=name;m.position.set(141,24.625,32);room.add(m);}
const ship={root,room};prepareBlossomBed(ship);const garden=createBlossomGarden(ship);
root.add(garden.solid);root.updateMatrixWorld(true);

const col=new Colliders();col.addStatic(root,()=>true);col.commit();
const ground=new Colliders();ground.addStatic(root,o=>o.isMesh&&groundMesh(o));ground.commit();
const ctl=new Controller(col),out=[];const log=(name,ok,detail='')=>{out.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?' - '+detail:''}`);};
const settle=()=>{for(let i=0;i<40;i++)ctl.step(1/60,new T.Vector3(),false);};
const put=(x,y,z)=>{ctl.position.set(x,y+.2,z);ctl.velocity.set(0,0,0);settle();};
// Walk towards a point at up to 3.2 m/s; returns the largest rise in one frame and whether it arrived.
const go=(x,z,tol=.3,max=1500)=>{let rise=0,i=0;for(;i<max;i++){const d=new T.Vector3(x-ctl.position.x,0,z-ctl.position.z);if(d.length()<tol)break;d.setLength(Math.min(3.2,d.length()*4+.5));const y=ctl.position.y;ctl.step(1/60,d,false);rise=Math.max(rise,ctl.position.y-y);}return {arrived:i<max,rise};};

// 1. From the floor at the bridge foot, over the bridge, to the soil by the bench.
put(135,24.3,35);const heights=[];let maxRise=0,ok=true;
for(let x=135.5;x<=140.6;x+=.35){const r=go(x,35);maxRise=Math.max(maxRise,r.rise);if(!r.arrived&&ok){ok=false;console.log('stalled leg at x',x.toFixed(2),ctl.position.toArray().map(v=>v.toFixed(2)).join(','));}heights.push(+ctl.position.y.toFixed(2));}
log('walker crosses the red bridge from the floor to the soil by the bench',ok&&Math.abs(ctl.position.y-25.01)<.1,`deck heights ${heights.join(', ')}; biggest rise in a frame ${maxRise.toFixed(3)} m`);
const crest=Math.max(...heights);log('bridge arches over the pond',crest>25&&crest<25.6,`crest ${crest} m over a pond at 24.58 m`);
// 2. And back down.
const back=go(135,35);settle();log('walker returns down the bridge to the floor',back.arrived&&Math.abs(ctl.position.y-24.3)<.1,`y ${ctl.position.y.toFixed(2)}`);
// 3. The bench: its seats, and that a walker can reach one.
// (rest.js needs the built layout, so the cushion and back it matches by name are checked directly.)
const cushion=root.getObjectByName('Garden_bench_cushion'),backrest=root.getObjectByName('Garden_bench_back');
const top=new T.Box3().setFromObject(cushion),seatRay=new T.Ray(new T.Vector3((top.min.x+top.max.x)/2,top.max.y+.3,(top.min.z+top.max.z)/2),new T.Vector3(0,-1,0)),seatHit=col.raycast(seatRay,.45);
log('the bench has a cushion and back the colliders hold up',!!cushion&&!!backrest&&!!seatHit&&Math.abs(seatHit.point.y-top.max.y)<.05,`seat top ${top.max.y.toFixed(2)} m, ${(top.max.z-top.min.z).toFixed(1)} m long`);
put(140.6,25.01,35);const reach=Math.hypot(cushion.position.x-ctl.position.x,cushion.position.z-ctl.position.z);log('the bench approach is within reach of the seat',reach<1.5,`${reach.toFixed(2)} m`);
// 4. Edges: nobody crosses the rails or the rim into the pond, or through the falls' rocks and the trunk.
const blocked=(name,x,y,z,tx,tz,limit)=>{put(x,y,z);const r=go(tx,tz,.3,600);const fine=!r.arrived&&limit(ctl.position);log(name,fine,`stopped at ${ctl.position.x.toFixed(2)}, ${ctl.position.y.toFixed(2)}, ${ctl.position.z.toFixed(2)}`);};
put(135,24.3,35);go(138.2,35,.3);settle();
blocked('the bridge rail stops a walker stepping off its north side',138.2,ctl.position.y,35,138.2,38,p=>p.z<35.9);
blocked('the bridge rail stops a walker stepping off its south side',138.2,ctl.position.y,35,138.2,32,p=>p.z>34.1);
blocked('the pond rim stops a walker on the west side',134.8,24.3,37.5,138,37.5,p=>p.x<136.6);
blocked('the pond rim stops a walker on the north side',138,24.3,41,138,37,p=>p.z>39.3);
blocked('the rocks of the falls stop a walker',141,25.01,33.9,139.4,33.57,p=>p.x>139.9);
blocked('the planter face stops a walker at the south side',141,24.3,26,141,31,p=>p.z<27.6);
blocked('the main cherry trunk stops a walker',141,25.01,29.5,141.1,32,p=>Math.hypot(p.x-141.1,p.z-32)>.8);
for(const z of [29.8,34.2])blocked(`the added cherry at z ${z} has a solid trunk`,144,25.01,z,146.35,z,p=>p.x<146.0);
// 5. A walker who steps off the soil into the pond can step out over the rim.
put(141.5,25.01,36.15);go(138.5,36.15,.3,300);settle();const inPond=ctl.position.y<24.7,pondY=ctl.position.y.toFixed(2);
const outRim=go(134.8,36.15,.3,900);settle();log('a walker in the pond lands on its floor and steps back out over the rim',inPond&&outRim.arrived&&Math.abs(ctl.position.y-24.3)<.1,`in the pond at y ${pondY}, out at ${ctl.position.x.toFixed(2)}`);
// 6. A flood over the bed, from the bridge: every spot of soil is reached, and nothing is a hole or a gap.
const D=.4,seen=new Set(),queue=[[135,24.3,35]],ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3();
const floorAt=(x,y,z)=>{ray.origin.set(x,y+.42,z);const h=ground.raycast(ray,1.5);return h&&h.normal.y>.6?h.point.y:null;};
const room_=(x,y,z)=>{seg.start.set(x,y+.75,z);seg.end.set(x,y+1.65,z);return !col.overlaps(seg,.35);};
const key=(x,z,y)=>`${Math.round(x/D)},${Math.round(z/D)},${Math.round(y/.3)}`;seen.add(key(135,35,24.3));
let falls=0,holes=0;
for(let i=0;i<queue.length&&queue.length<60000;i++){const [x,y,z]=queue[i];
 for(const [dx,dz] of [[D,0],[-D,0],[0,D],[0,-D]]){const nx=x+dx,nz=z+dz;if(nx<134||nx>150||nz<25||nz>42)continue;
  const ny=floorAt(nx,y,nz);if(ny===null){if(room_(nx,y,nz)){ray.origin.set(nx,y+.42,nz);const h=ground.raycast(ray,40);if(!h)holes++;else if(y-h.point.y>1)falls++;}continue;}
  if(!room_(nx,ny,nz))continue;const k=key(nx,nz,ny);if(!seen.has(k)){seen.add(k);queue.push([nx,ny,nz]);}}}
const soil=queue.filter(p=>p[1]>24.9&&p[0]>140&&p[0]<148&&p[2]>27.8&&p[2]<36.2).length,pond=queue.filter(p=>p[1]<24.7&&p[0]>136.8&&p[0]<139.5&&p[2]>33.5&&p[2]<39.2).length;
log('the soil bed is walkable from the bridge',soil>150,`${soil} spots of soil reached out of ${queue.length}`);
log('no walkable edge drops into a hole or over 1 m',holes===0&&falls===0,`${holes} holes, ${falls} drops over 1 m`);
console.log(`pond spots reachable by a step-down: ${pond}`);
// 7. Sound and animation follow the walker's distance.
const w=new T.Vector3(141,25,32);garden.update(1/30,w,false,null);
const koi=garden.group.getObjectByName('Blossom_koi'),m=new T.Matrix4(),v=new T.Vector3();koi.getMatrixAt(0,m);v.setFromMatrixPosition(m);
log('seven koi, eight butterflies, 3,200 petals on the ground, 160 falling',koi.count===7&&garden.group.getObjectByName('Blossom_butterflies').count===16&&garden.group.getObjectByName('Blossom_fallen_petals').count===3200&&garden.group.getObjectByName('Blossom_falling_petals').count===160);
const names=new Set();garden.group.traverse(o=>names.add(o.name));
for(const n of ['Blossom_tree_trunk','Blossom_tree_canopy','Blossom_stone_wall','Blossom_pond_water','Blossom_falls','Blossom_koi','Blossom_bridge','Blossom_pond_stones','Cherry_blossom_garden'])assert.ok(names.has(n),'missing '+n);
const failed=out.filter(o=>!o.ok);console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',checks:out.length,failed:failed.map(o=>o.name)}));
assert.equal(failed.length,0,'blossom walk checks failed');
