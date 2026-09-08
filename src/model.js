import * as T from 'three';
import {createNoseCommons} from './nose-commons.js';
import {finishCabin} from './residential-finish.js';
import {polishInterior} from './interior-polish.js';
import {finishGarden} from './garden-finish.js';
import {aftOpenings} from './aft-layout.js';
import {createAft} from './aft.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createExterior } from './exterior.js';
import {createLounge,LOUNGE,loungeFacade} from './lounge.js';
import {SHIP_AREAS,createShipArea} from './areas.js';
import {createServiceCirculation} from './service-circulation.js';
import {createSpecialCirculation} from './special-circulation.js';
import {transitOpenings,createTransit} from './transit.js';
import {outlinedSlab,unionRectangles,slabGeometry} from './floor-geometry.js';
import {hullAt as logicalHullAt,halfWidth as logicalHalfWidth} from './hull-profile.js';
import {finishedRoofY} from './exterior-profile.js';
export const physicalX=x=>.94*x-18;
export const logicalX=x=>(x+18)/.94;
export const hullAt=x=>logicalHullAt(logicalX(x));
export const halfWidth=(x,y,allowance=0)=>logicalHalfWidth(logicalX(x),y,allowance);

// Metres, +X forward, +Y up, +Z starboard. Geometry and fit checks share this source.
export const SPEC = { length: 564, span: 300, hullHeight: 107.8, deckPitch: 4,
  decks: 20, neighborhoods: 10, cabinsPerNeighborhood: 500, berthsPerCabin: 2,
  cabinInternal: [4, 3.2, 6], cabinEnvelope: [4.4, 3.5, 6.4], shellAllowance: 2.5 };

export function insideHull(x,y,z,allowance=SPEC.shellAllowance){const h=hullAt(x);return !!h&&y>=h.bottom+allowance&&y<=h.top-allowance&&Math.abs(z)<=halfWidth(x,y,allowance);}
export const deckY = d => -40 + d * SPEC.deckPitch;
export const DECKS = Array.from({length:20}, (_,d)=>({ index:d, number:d+1, y:deckY(d),
  name: d<2?'Cargo & transfer':d<4?'Farms & life support':d===4?'Medical & shelter':d<15?`Neighborhood ${String(d-4).padStart(2,'0')}`:d===15?'Education & recreation':d<19?'Gardens & commons':'Command & operations',
  residential:d>=5&&d<=14, color:d<2?0xce9b56:d<4?0x72ab96:d===4?0x65b5cc:d<15?0xb8a2cb:d<19?0x82b18f:0x849eba
}));
export const CABINS = [];
for(let n=0;n<10;n++) for(let lane=0;lane<5;lane++) for(let side of [-1,1]) for(let col=0;col<50;col++) {
  CABINS.push({ id:`N${String(n+1).padStart(2,'0')}-${String(lane*100+(side===1?50:0)+col+1).padStart(3,'0')}`,
    neighborhood:n+1, deck:n+6, x:-120.7+col*4.6+Math.floor(col/10)*4, y:deckY(n+5)+.3, z:(lane-2)*26+side*5.2,
    width:4.4, depth:6.4, height:3.5, berths:2 });
}
export const COMMONS = Array.from({length:10},(_,i)=>({neighborhood:i+1,x:-92+Math.floor(i/2)*56,z:(i%2===0?-1:1)*(i===2||i===3?24.5:27),width:45,depth:38,y:24.3,height:11.2}));
export const SAMPLE = CABINS.find(c=>c.neighborhood===10&&c.x>120&&c.z===5.2);
export const ROUTE = [
  {name:'Twin cabin', detail:'24 m² clear floor · two berths · 1.7 m eye level', position:[SAMPLE.x,18,2.6], target:[SAMPLE.x,17.5,6.4]},
  {name:'Residential corridor',detail:'4 m clear corridor · Neighborhood 10 · Deck 15',position:[124.5,18,0],target:[132,18,0]},
  {name:'Lift to the commons',detail:'Deck 15 → Deck 17 · 8 m vertical connection',position:[132,26,0],target:[132,26,10]},
  {name:'Neighborhood garden',detail:'One of ten commons · three deck height',position:[145,26,12],target:[132,28,28]},
  {name:'Forward promenade',detail:'A gentle 1:12 ramp rises toward the panoramic lounge',position:[149,26.25,0],target:[172,28,0]},
  {name:'Observation lounge',detail:'A place to settle in · curved windows, reading corners and a view of Mars',position:[180,28,31],target:[210,29,11]}
];

const MAT = {};
const material = (name,color,extra={}) => MAT[name] ||= new T.MeshStandardMaterial({name,color,roughness:.72,metalness:.12,...extra});
export function group(name,parent) { const g=new T.Group();g.name=name;if(parent)parent.add(g);return g; }
export function mesh(name,geo,mat,parent,pos=[0,0,0]) { const m=new T.Mesh(geo,mat); m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;if(parent)parent.add(m);return m; }
export function box(name,size,pos,mat,parent) {return mesh(name,new T.BoxGeometry(...size),mat,parent,pos);}
function tube(name,points,r,mat,parent){return mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*4),r,6,false),mat,parent);}
function mergedBoxes(name,items,mat,parent) {
  const gs=items.map(({s,p})=>new T.BoxGeometry(...s).translate(...p));
  if(!gs.length)return null;
  const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());return mesh(name,g,mat,parent);
}
export function createShip({deferExterior=false}={}) {
  const root=group('LEO_564m_Exterior_v31');root.userData={...SPEC,units:'metres',axis:'X forward; Y up; Z starboard',stage:'Exterior refinement over a spatial blockout'};
  const {exterior,fixed,port,starboard}=deferExterior
    ? {exterior:group('Deferred_exterior',root),fixed:group('Deferred_fixed'),port:group('Deferred_port'),starboard:group('Deferred_starboard')}
    : createExterior(root,{hullAt:logicalHullAt,halfWidth:logicalHalfWidth});
  exterior.scale.x=.94;exterior.position.x=-18;
  const trim=material('Structure',0x627581);
  const inside=group('02_INTERIOR_LAYOUT',root),decks=[],cabinGroups=[];
  for(const d of DECKS) {
    const dg=group(`Deck_${String(d.number).padStart(2,'0')}_${d.name.replaceAll(' ','_')}`,inside);dg.userData={...d};
    const points=[];for(let x=-280;x<=286;x+=4){
      let w=halfWidth(x,d.y+.3,3);
      // The bow is vertically compressed in the accepted exterior. Clip the
      // structural floor perimeter to that finished surface as well as the loft.
      if(w>10&&d.y>=4){
        if(finishedRoofY(logicalX(x),0)<d.y+.8)continue;
        if(finishedRoofY(logicalX(x),w)<d.y+.8){let lo=0,hi=w;for(let i=0;i<20;i++){const z=(lo+hi)/2;if(finishedRoofY(logicalX(x),z)>=d.y+.8)lo=z;else hi=z;}w=lo;}
      }
      if(w>10)points.push([x,w]);
    }
    if(points.length){
      const outline=[...points,...points.slice().reverse().map(([x,z])=>[x,-z])],holes=[...transitOpenings(d.number),...aftOpenings(d.number)];
      if(d.index===17||d.index===18){
        for(const c of COMMONS)holes.push({x0:c.x-22.5,x1:c.x+22.5,z0:c.z-19,z1:c.z+19});
        const edge=Array.from({length:73},(_,i)=>loungeFacade(31,-.81+1.62*i/72,1.4));
        holes.push([[170,edge[0][2]],...edge.map(p=>[p[0],p[2]]),[170,edge.at(-1)[2]]]);
      }
      if(d.number===18)holes.push({x0:146,x1:170,z0:-4.3,z1:4.3});
      if(d.number===3)holes.push({x0:148,x1:220,z0:-54,z1:54});
      const g=outlinedSlab(outline,holes,d.y+.28,.28);dg.userData.openings=holes;
      mesh('Deck_slab',g,material('Deck_slab',0x737f88),dg);
    }
    if(d.residential) {
      const list=CABINS.filter(c=>c.deck===d.number);
      const cg=group(`N${d.number-5}_500_twin_cabin_envelopes`,dg);cg.userData={cabins:500,berths:1000,clearFloorArea:12000,envelopeFloorArea:14080};
      mergedBoxes('500_cabin_modules',list.map(c=>({s:[4.4,3.5,6.4],p:[c.x,c.y+1.75,c.z]})),material(`Habitat_${d.number}`,d.color),cg);
      const aisles=[];for(let lane=0;lane<5;lane++)aisles.push({s:[247,.04,4],p:[0,d.y+.32,(lane-2)*26]});
      for(let j=0;j<4;j++)aisles.push({s:[4,.04,120.8],p:[-75+j*50,d.y+.34,0]});
      mergedBoxes('Primary_corridors',aisles,material('Circulation',0xe8c592),dg);cabinGroups.push(cg);
    } else if(d.index<5) {
      const blocks=[];for(let x of [-115,-45,25,95])for(let z of [-38,38])blocks.push({s:[52,2.8,34],p:[x,d.y+1.7,z]});
      const reserve=mergedBoxes(`${d.name}_space_reservations`,blocks,material(`Zone_${d.index}`,d.color),dg);reserve.userData={status:'Unfitted volume reservation, systems not sized'};
    }
    decks.push(dg);
  }
  const vertical=group('Lift_and_transit_reservations',inside);
  for(let x of [-132,132])for(let z of [-70,0,70]) {
    if(z!==0)continue;
    box('Lift_core',[7,68,7],[x,-6,0],material('Lift_core',0x728f9e),vertical);
  }
  const shared=group('Ten_commons_reservations',inside);
  for(const c of COMMONS) {
    box(`N${c.neighborhood}_commons_floor`,[45,.12,38],[c.x,24.4,c.z],material('Commons_floor',0x8baf98),shared);
    for(let sx of [-1,1])box('Gallery_edge',[45,.2,3],[c.x,28.4,c.z+sx*17.5],trim,shared);
  }
  const detail=createNeighborhood();root.add(detail.root);
  inside.visible=false;detail.root.visible=false;
  const serviceDecks=new Map(),residentialDecks=new Map();let gardensLoaded=false,transit=null,observationArea=null,aftSystems=null;
  const ship={root,exterior,port,starboard,fixed,inside,decks,cabinGroups,vertical,shared,detail,serviceDecks,residentialDecks,
    ensureAft(){if(!aftSystems){aftSystems=createAft();inside.add(aftSystems.root);}return aftSystems;},
    ensureTransit(){if(!transit){transit=createTransit();inside.add(transit.root);vertical.visible=false;}return transit;},
    ensureObservation(){if(!observationArea){observationArea=createObservationArea(detail);observationArea.walls.visible=false;inside.add(observationArea.root);}return observationArea;},
    ensureGardens(){
      if(gardensLoaded)return;for(const child of shared.children)child.visible=false;
      for(let number=1;number<=10;number++){const garden=createGardenCommons(number,detail);garden.walls.visible=false;shared.add(garden.root);}
      gardensLoaded=true;
    },
    ensureResidentialDeck(number){
      if(residentialDecks.has(number))return residentialDecks.get(number);
      if(number<6||number>15)return null;
      const deck=decks[number-1],residence=createResidentialDeck(number-5,detail);
      for(const o of deck.children)if(o.name.includes('twin_cabin_envelopes')||o.name==='Primary_corridors')o.visible=false;
        residence.walls.visible=false;residence.districtWalls.visible=false;deck.add(residence.root);
        const nose=createNoseCommons(number-5);nose.shell.visible=false;deck.add(nose.root);residence.nose=nose;
      residentialDecks.set(number,residence);return residence;
    },
    ensureServiceDeck(number){
      if(serviceDecks.has(number))return serviceDecks.get(number);
      const areas=SHIP_AREAS.filter(a=>a.deck===number);if(!areas.length)return [];
      const deck=decks[number-1];
      for(const o of deck.children)if(o.name.endsWith('_space_reservations'))o.visible=false;
      const rooms=areas.map(a=>{const room=createShipArea(a);room.shell.visible=false;deck.add(room.root);return room;});
      for(const corridors of [createServiceCirculation(number),createSpecialCirculation(number)])if(corridors){corridors.shell.visible=false;deck.add(corridors.root);}
      serviceDecks.set(number,rooms);return rooms;
    },
    ensureExterior(){
      if(!deferExterior)return false;
      root.remove(ship.exterior);
      Object.assign(ship,createExterior(root,{hullAt:logicalHullAt,halfWidth:logicalHalfWidth}));
      ship.exterior.scale.x=.94;ship.exterior.position.x=-18;
      deferExterior=false;return true;
    }};
  return ship;
}

function catFigure(parent,x,y,z,rotation=0) {
  const g=group('Mars_cat_1.75m',parent);g.position.set(x,y,z);g.rotation.y=rotation;g.scale.setScalar(.95);
  const suit=material('Crew_suit',0x334e60),fur=material('Cat_fur',0xcfaa7d),black=material('Eyes',0x192933);
  const torso=mesh('Torso',new T.CapsuleGeometry(.21,.43,3,8),suit,g,[0,1.01,0]);
  mesh('Head',new T.SphereGeometry(.19,10,8),fur,g,[0,1.57,0]);
  for(const s of [-1,1]){
    mesh('Ear',new T.ConeGeometry(.09,.18,3),fur,g,[s*.12,1.75,0]);
    box('Leg',[.14,.68,.17],[s*.12,.35,0],suit,g);
    box('Paw',[.17,.12,.28],[s*.12,.06,.06],fur,g);
    const arm=box('Arm',[.12,.55,.13],[s*.29,1.05,0],suit,g);arm.rotation.z=s*.12;
    mesh('Eye',new T.SphereGeometry(.022,6,4),black,g,[s*.074,1.61,.174]);
  }
  tube('Tail',[[0,.68,-.12],[.2,.6,-.5],[.36,.92,-.65],[.3,1.2,-.64]],.055,fur,g);return g;
}
function rail(parent,a,b,y) {
  const metal=material('Rail',0x536b78);tube('Handrail',[[a[0],y+1.1,a[1]],[b[0],y+1.1,b[1]]],.045,metal,parent);
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=0;i<=Math.ceil(length/2);i++){const t=i/Math.ceil(length/2);box('Baluster',[.06,1.1,.06],[T.MathUtils.lerp(a[0],b[0],t),y+.55,T.MathUtils.lerp(a[1],b[1],t)],metal,parent);}
}
function tree(parent,x,y,z,s=1) {
  const bark=material('Timber',0x9b7957),leaf=material('Leaves',0x6d967b);
  mesh('Tree_trunk',new T.CylinderGeometry(.12*s,.24*s,3.1*s,7),bark,parent,[x,y+1.55*s,z]);
  for(let [dx,dy,dz,r] of [[0,3.8,0,1.5],[-1,3.2,.4,1.15],[1,3.3,-.3,1.2]])mesh('Tree_canopy',new T.IcosahedronGeometry(r*s,1),leaf,parent,[x+dx*s,y+dy*s,z+dz*s]);
}
function chair(parent,x,y,z,rotation=0) {
  const g=group('Tail_clearance_chair',parent);g.position.set(x,y,z);g.rotation.y=rotation;
  const navy=material('Seat_navy',0x354a59),metal=material('Rail',0x536b78);
  box('Seat',[.62,.13,.64],[0,.47,0],navy,g);box('Back',[.62,.55,.1],[0,.86,-.29],navy,g);
  for(let x of [-.23,.23])for(let z of [-.23,.23])box('Leg',[.04,.45,.04],[x,.23,z],metal,g);
}
export function createNeighborhood() {
  const root=group('03_NEIGHBORHOOD_10');root.userData={units:'metres',worldCoordinates:true,capacity:'500 furnished twin cabins, 1,000 berths, garden commons and shared observation lounge'};
  const walls=group('Walls_and_roof_toggle',root),fittings=group('Fittings_and_structure',root);
  const white=material('Interior_white',0xe0e0d8),floor=material('Warm_floor',0xc6c3b3),navy=material('Seat_navy',0x354a59),wood=material('Timber',0x9b7957),glass=material('Interior_glass',0x79a6b2,{transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}),light=material('Ceiling_light',0xf6eed9,{emissive:0xf6eed9,emissiveIntensity:.45}),green=material('Leaves',0x6d967b);
  const {x,y,z}=SAMPLE;
  const cabinWalls=group('Sample_cabin_walls',walls),cabinFittings=group('Sample_cabin_fittings',fittings);
  {const walls=cabinWalls,fittings=cabinFittings;
  // Clear internal room bounds: x +/-2, z +/-3. Shell 0.2 m.
  box('Cabin_24m2_floor',[4.4,.3,6.4],[x,16.15,z],floor,fittings);
  for(let s of [-1,1])box('Cabin_side_wall',[.2,3.2,6.4],[x+s*2.1,y+1.6,z],white,walls);
  box('Cabin_back_wall',[4.4,3.2,.2],[x,y+1.6,z+3.1],white,walls);
  for(let s of [-1,1])box('Door_jamb',[1.5,3.2,.2],[x+s*1.45,y+1.6,z-3.1],white,walls);
  box('Door_lintel',[1.4,.8,.2],[x,y+2.8,z-3.1],white,walls);
  box('Cabin_roof',[4.4,.25,6.4],[x,y+3.35,z],white,walls);
  for(let s of [-1,1]){
    box('Single_bed_base',[1,.42,2.1],[x+s*1.38,y+.21,z+.7],navy,fittings);
    box('Single_mattress',[.96,.18,2.03],[x+s*1.38,y+.51,z+.7],white,fittings);
    box('Bed_cover',[.97,.04,1.35],[x+s*1.38,y+.62,z+.35],material('Linen',0x829aab),fittings);
    box('Pillow',[.7,.14,.4],[x+s*1.38,y+.7,z+1.43],white,fittings);
    box('Personal_shelf',[.85,.08,.26],[x+s*1.38,y+1.55,z+1.82],wood,fittings);
  }
  box('Shared_desk',[1.8,.08,.55],[x,y+.78,z+2.7],wood,fittings);chair(fittings,x,y,z+1.95,Math.PI);
  box('Storage',[.65,2.2,.7],[x-1.55,y+1.1,z-2.35],navy,fittings);
  const ensuite=group('Compact_ensuite',fittings);
  box('Ensuite_partition',[.08,2.45,1.55],[x+.48,y+1.225,z-2.12],white,ensuite);
  box('Ensuite_screen',[1.45,2.45,.07],[x+1.25,y+1.225,z-1.32],glass,ensuite);
  box('Shower_tray',[.78,.08,.78],[x+1.4,y+.04,z-2.42],white,ensuite);
  box('Wetroom_fixture',[.36,.65,.44],[x+.78,y+.325,z-2.48],white,ensuite);
  box('Cabin_ceiling_light',[2.8,.04,.4],[x,y+3.17,z],light,walls);
  finishCabin({walls,fittings,x,y,z,box,material});
  }
  catFigure(fittings,x-1.25,y,z-1.65,1.1);
  const district=group('Remaining_499_furnished_cabins',root),districtWalls=group('Repeated_cabin_walls',district);
  const others=CABINS.filter(c=>c.neighborhood===10&&c.id!==SAMPLE.id);
  root.updateMatrixWorld(true);
  for(const source of [cabinWalls,cabinFittings])source.traverse(o=>{
    if(!o.isMesh)return;
    const repeated=new T.InstancedMesh(o.geometry,o.material,others.length);repeated.name='Repeated_'+o.name;
    repeated.castShadow=true;repeated.receiveShadow=true;
    others.forEach((c,i)=>{
      const side=c.z-Math.round(c.z/26)*26;
      const m=new T.Matrix4().makeTranslation(c.x,c.y,c.z).multiply(new T.Matrix4().makeRotationY(side<0?Math.PI:0)).multiply(new T.Matrix4().makeTranslation(-x,-y,-z)).multiply(o.matrixWorld);
      repeated.setMatrixAt(i,m);
    });
    (source===cabinWalls?districtWalls:district).add(repeated);
  });
  const circulation=[...[-52,-26,0,26,52].map(z=>({s:[258,.3,4],p:[5,16.15,z]})),{s:[10,.3,108],p:[129,16.15,0]}];
  for(const xx of [-75,-25,25,75])circulation.push({s:[4,.3,108],p:[xx,16.15,0]});
  const corridorRects=circulation.map(({s,p})=>({x0:p[0]-s[0]/2,x1:p[0]+s[0]/2,z0:p[2]-s[2]/2,z1:p[2]+s[2]/2}));
  const corridorPolys=unionRectangles(corridorRects,transitOpenings(15));
  mesh('Neighborhood_circulation',slabGeometry(corridorPolys,16.3,.3),floor,district);
  mesh('Corridor_ceilings',slabGeometry(corridorPolys,19.795,.15),white,districtWalls);
  // Recessed light rhythm and a continuous floor-edge route through each lane.
  const laneLights=[],laneTrim=[];
  for(const zz of [-52,-26,0,26,52]){
    for(let xx=-117;xx<=125;xx+=9.2)laneLights.push({s:[2.7,.05,.24],p:[xx,19.64,zz]});
    for(const s of [-1,1])laneTrim.push({s:[258,.012,.035],p:[5,16.307,zz+s*1.75]});
  }
  mergedBoxes('Residential_corridor_diffusers',laneLights,light,districtWalls);
  mergedBoxes('Residential_corridor_wayfinding_inlay',laneTrim,wood,district);
  polishInterior(district,'Residential corridors');
  // Local corridor; the paired lifts use the same source as the whole-ship network.
  box('Residential_corridor_floor',[21,.3,4],[124,16.16,0],floor,fittings);

  for(let xx of [116,122,128])box('Corridor_light',[3,.08,.35],[xx,19.45,0],light,walls);
  const gardenFittingStart=fittings.children.length,gardenWallStart=walls.children.length;
  const c=COMMONS[9],cy=24.3;
  box('Commons_floor',[45,.3,38],[c.x,24.15,c.z],floor,fittings);
  box('Commons_ceiling',[45,.3,38],[c.x,35.65,c.z],white,walls);
  box('Commons_rear_wall',[45,11.2,.2],[c.x,29.9,46],white,walls);
  box('Commons_end_wall',[.2,11.2,38],[109.5,29.9,27],white,walls);
  for(let xx of [110,121,132,143,154]){
    for(let zz of [8,46])box('Commons_column',[.45,11.2,.55],[xx,29.9,zz],white,fittings);
    box('Roof_rib',[.4,.55,38],[xx,35.2,27],white,walls);
    box('Circadian_light',[1.8,.1,25],[Math.min(xx+3,152),35.37,27],light,walls);
  }
  for(let yy of [28.3,32.3]) {
    box('Rear_gallery',[45,.28,4],[132,yy-.14,44],floor,fittings);
    box('End_gallery',[4,.28,34],[111.5,yy-.14,25],floor,fittings);
    box('Front_gallery',[41,.28,4],[134,yy-.14,10],floor,fittings);
    const opening=yy===28.3?[147,153.3]:[145.5,147];
    rail(fittings,[113.5,42],[opening[0],42],yy);rail(fittings,[opening[1],42],[154.5,42],yy);rail(fittings,[113.5,12],[113.5,42],yy);
    rail(fittings,[113.5,12],[154.5,12],yy);rail(fittings,[113.5,8],[136.8,8],yy);rail(fittings,[138.8,8],[154.5,8],yy);
    for(let xx of [117,126,135,144,151])box('Gallery_door',[2.1,2.4,.15],[xx,yy+1.2,45.82],navy,walls);
  }
  for(let [xx,zz] of [[125,24],[141,32]]) {
    box('Garden_planter',[9,.65,9],[xx,cy+.325,zz],white,fittings);
    box('Planting_bed',[8.5,.06,8.5],[xx,cy+.68,zz],material('Soil',0x695e4c),fittings);
    tree(fittings,xx,cy+.7,zz,1.2);
    for(let j=0;j<7;j++)mesh('Low_plant',new T.IcosahedronGeometry(.6,0),green,fittings,[xx+Math.sin(j*2)*3.2,cy+1,zz+Math.cos(j*2)*3.2]);
    box('Garden_bench',[8,.18,.7],[xx,cy+.6,zz-5.1],wood,fittings);
  }
  box('Community_cafe_counter',[10,1.05,1.2],[132,cy+.525,42],wood,fittings);
  for(let [xx,zz] of [[142,14],[121,36],[148,23]]) {
    mesh('Cafe_table',new T.CylinderGeometry(.85,.85,.09,16),wood,fittings,[xx,cy+.75,zz]);
    box('Table_pedestal',[.16,.7,.16],[xx,cy+.35,zz],navy,fittings);
    chair(fittings,xx-1.25,cy,zz,Math.PI/2);chair(fittings,xx+1.25,cy,zz,-Math.PI/2);
  }
  // Broad straight stair along one edge, each flight 24 risers x 1/6 m.
  for(let level=0;level<2;level++)for(let i=0;i<24;i++)box('Gallery_stair',[3,(i+1)/6,.3],[151.8-level*3.3,cy+level*4+(i+1)/12,level===0?35+i*.3:41.9-i*.3],white,fittings);
  box('Upper_stair_landing',[6.3,.28,1.8],[150.15,32.16,33.95],floor,fittings);
  box('Upper_gallery_connection',[1.5,.28,10],[146.25,32.16,38],floor,fittings);
  for(let [xx,zz,r] of [[134,18,1],[144,36,2],[122,32,.8],[148,14,0]])catFigure(fittings,xx,cy,zz,r);
  catFigure(fittings,126,28.3,44,Math.PI);catFigure(fittings,143,32.3,44,2);
  // Everyday shared spaces beside the garden, away from the central routes.
  const services=group('Neighborhood_shared_services',fittings);
  box('Laundry_counter',[7,1,.8],[114,24.8,15],wood,services);
  for(let i=0;i<5;i++){
    box('Laundry_machine',[1.05,1.5,.85],[111+i*1.25,25.05,16],white,services);
    const drum=mesh('Laundry_drum',new T.CylinderGeometry(.32,.32,.06,20),navy,services,[111+i*1.25,25.1,15.55]);drum.rotation.x=Math.PI/2;
  }
  for(let i=0;i<6;i++)box('Parcel_locker',[.75,2,.5],[111+i*.85,25.3,10],navy,services);
  box('Shared_kitchen_island',[8,1.05,2],[131,24.825,39],wood,services);
  for(let xx of [128,131,134])box('Induction_hob',[.8,.04,.6],[xx,25.37,39],navy,services);
  box('Kitchen_sink',[1.1,.1,.7],[133.5,25.4,39],white,services);
  for(let i=0;i<4;i++)chair(services,128+i*2,24.3,37,Math.PI);
  for(let xx of [117,120,123]){box('Reading_shelf',[.3,2.3,2],[xx,25.45,44.5],wood,services);chair(services,xx+1,24.3,40,Math.PI/2);}
  // Continuous handrails support both stair flights and gallery landings.
  for(let level=0;level<2;level++)for(const xx of [150.3-level*3.3,153.3-level*3.3])tube('Stair_handrail',[[xx,25.4+4*level,level===0?34.85:42.2],[xx,29.4+4*level,level===0?42.2:34.85]],.05,wood,fittings);
  for(const xx of [119,140]){const l=new T.PointLight(0xffe6c2,45,38,2);l.position.set(xx,32,27);root.add(l);}
  finishGarden({fittings,walls,parts:fittings.children.slice(gardenFittingStart),wallParts:walls.children.slice(gardenWallStart),material});
  const gardenParts={fittings:fittings.children.slice(gardenFittingStart),walls:walls.children.slice(gardenWallStart)};
  const loungeStart={fittings:fittings.children.length,walls:walls.children.length,root:root.children.length};
  const observation=createLounge({root,walls,fittings,box,mesh,group,material,chair,catFigure,rail,tube});
  const loungeParts={fittings:fittings.children.slice(loungeStart.fittings),walls:walls.children.slice(loungeStart.walls),root:root.children.slice(loungeStart.root)};
  return {root,walls,fittings,district,districtWalls,observation,gardenParts,loungeParts};

}

export function createObservationArea(template=createNeighborhood()){
  const root=group('Shared_observation_lounge_and_approach'),walls=group('Observation_walls_and_ceiling',root);
  for(const o of template.loungeParts.fittings)root.add(o.clone(true));
  for(const o of template.loungeParts.walls)walls.add(o.clone(true));
  for(const o of template.loungeParts.root)root.add(o.clone(true));
  return {root,walls};
}

// Reuse the accepted furnished cabin module at every residential deck elevation.
// Instancing remains intact: each deck has one sample and 499 detailed copies.
export function createResidentialDeck(number,template=createNeighborhood()){
  if(!Number.isInteger(number)||number<1||number>10)throw new Error('Neighborhood must be 1–10');
  const root=group(`Furnished_neighborhood_${String(number).padStart(2,'0')}`),walls=group('Residential_sample_walls',root);
  const dy=(number-10)*4;root.position.y=dy;
  root.userData={neighborhood:number,deck:number+5,cabins:500,berths:1000,clearCabinArea:24,units:'metres'};
  walls.add(template.walls.getObjectByName('Sample_cabin_walls').clone(true));
  root.add(template.fittings.getObjectByName('Sample_cabin_fittings').clone(true));
  const district=template.district.clone(true);district.visible=true;root.add(district);
  const districtWalls=district.getObjectByName('Repeated_cabin_walls');
  // The isolated deck uses the corridor template with its ceilings independently toggleable.
  return {root,walls,district,districtWalls,number,
    overview:{position:[70,150+dy,190],target:[0,17+dy,0]},
    inside:{position:[SAMPLE.x,18+dy,2.6],target:[SAMPLE.x,17.5+dy,6.4]}};
}

export function createGardenCommons(number,template=createNeighborhood()){
  const c=COMMONS[number-1];if(!c)throw new Error('Commons must be 1–10');
  const root=group(`Fitted_garden_commons_${String(number).padStart(2,'0')}`),walls=group('Garden_walls_and_ceiling',root),fittings=group('Garden_furnishings',root);
  root.position.x=c.x-132;root.scale.z=c.z<0?-1:1;root.position.z=c.z-27*root.scale.z;
  root.userData={neighborhood:number,decks:[17,18,19],floor:24.3,units:'metres',stage:'Refined garden commons: layered planting, cushioned seating, oak cafe and warm gallery lighting'};
  for(const part of template.gardenParts.fittings)fittings.add(part.clone(true));
  for(const part of template.gardenParts.walls)walls.add(part.clone(true));
  if(number<9)for(const yy of [28.3,32.3])rail(fittings,[136.8,8],[138.8,8],yy);
  const pose=([x,y,z])=>[x+c.x-132,y,z*root.scale.z+root.position.z];
  return {root,walls,fittings,number,overview:{position:pose([174,58,77]),target:pose([132,28,28])},inside:{position:pose([145,26,12]),target:pose([132,28,28])}};
}
