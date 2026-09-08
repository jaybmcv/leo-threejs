import * as T from 'three';
import {finishForwardLounge} from './observation-finish.js';
import {tintWindow} from './glazing-finish.js';
import {frontPoint} from './hull-profile.js';
import {bowHeight} from './diagonal-profile.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};
const signFont=new FontLoader().parse(fontData);

export const LOUNGE={floor:26.3,rear:170,arc:.81,windowBottom:31,windowTop:36,rampStart:146,rampEnd:170};
// Sample the very same facade as the fixed exterior. Inset the inner lining;
// the room does not introduce a second, differently shaped bow.
export function loungeFacade(y,a,inset=.7){
  const p=frontPoint(y,Math.abs(a),a<0?-1:1);
  return [.94*p[0]-18-inset*Math.cos(a),bowHeight(p[0],p[1]),p[2]-inset*Math.sin(a)];
}
export function createLounge({root,walls,fittings,box,mesh,group,material,chair,catFigure,rail,tube}){
  const lounge=group('Observation_lounge',fittings),shell=group('Observation_inner_lining',walls);
  const floor=material('Lounge_floor',0xc8bda7),white=material('Lounge_lining',0xe4e0d5,{side:T.DoubleSide}),wood=material('Timber',0x9b7957),navy=material('Seat_navy',0x354a59),metal=material('Rail',0x536b78);
  const glass=material('Lounge_glazing',0x92c2ce,{transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide,roughness:.18});
  const light=material('Lounge_cove_light',0xffe6b4,{emissive:0xffd799,emissiveIntensity:1.1});
  const fabric=material('Lounge_upholstery',0x456873,{roughness:.95,metalness:0}),cushion=material('Lounge_cushion',0xb4baaa,{roughness:1,metalness:0});
  const softSeat=new RoundedBoxGeometry(.88,.22,.85,2,.09),softBack=new RoundedBoxGeometry(.94,.8,.2,2,.08),softArm=new RoundedBoxGeometry(.16,.36,.82,2,.06);
  function armchair(x,y,z,rotation){
    const g=group('Upholstered_lounge_chair',lounge);g.position.set(x,y,z);g.rotation.y=rotation;
    box('Chair_plinth',[.65,.28,.62],[0,.14,0],wood,g);
    mesh('Soft_seat',softSeat,fabric,g,[0,.44,0]);mesh('Soft_back',softBack,fabric,g,[0,.72,-.39]);
    for(const side of [-1,1])mesh('Padded_arm',softArm,fabric,g,[side*.48,.57,0]);
    mesh('Loose_cushion',new RoundedBoxGeometry(.5,.38,.14,2,.055),cushion,g,[0,.71,-.24]);
  }
  function sign(text,x,y,z,rotation){
    const g=group('Wayfinding_'+text.replaceAll(' ','_'),lounge);g.position.set(x,y,z);g.rotation.y=rotation;
    box('Sign_back',[4.4,.72,.06],[0,.2,0],navy,g);
    const geo=new TextGeometry(text,{font:signFont,size:.27,depth:.005,curveSegments:2});geo.computeBoundingBox();geo.translate(-(geo.boundingBox.max.x-geo.boundingBox.min.x)/2,0,.04);
    mesh('Sign_lettering',geo,light,g);
  }
  const cy=LOUNGE.floor,steps=72,angles=Array.from({length:steps+1},(_,i)=>-.81+1.62*i/steps);
  const edge=angles.map(a=>loungeFacade(31,a,1.4));
  const outline=[[170,edge[0][2]],...edge.map(p=>[p[0],p[2]]),[170,edge.at(-1)[2]]];
  const shape=new T.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const slab=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});slab.rotateX(-Math.PI/2);slab.translate(0,cy-.3,0);mesh('Curved_lounge_floor',slab,floor,lounge);
  function strip(name,lower,upper,mat,parent=shell){
    const p=[],ix=[];angles.forEach(a=>p.push(...lower(a),...upper(a)));
    for(let i=0;i<steps;i++){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();return mesh(name,geo,mat,parent);
  }
  strip('Curved_window_sill',a=>{const p=loungeFacade(31,a,1.4);return [p[0],cy,p[2]];},a=>loungeFacade(31,a),white);
  tintWindow(strip('Glazing_matching_middle_exterior_row',a=>loungeFacade(31,a,.25),a=>loungeFacade(36,a,.25),glass),p=>new T.Vector3(Math.max(1,p.x-160),.5,p.z));
  strip('Curved_lounge_ceiling',a=>loungeFacade(36,a,.7),a=>[170,33.8,loungeFacade(31,a,1.4)[2]],white);
  for(const a of [-.81,.81]){
    const lo=loungeFacade(31,a,1.4),hi=loungeFacade(36,a,.7);
    const p=[170,cy,lo[2],...lo,...hi,170,33.8,lo[2]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();mesh('Lounge_side_return',g,white,shell);
  }
  const half=Math.abs(edge[0][2]);
  for(const s of [-1,1])box('Lounge_rear_wall',[.2,7.5,half-3.2],[170,cy+3.75,s*(half+3.2)/2],white,shell);
  box('Entry_lintel',[.22,3.5,6.4],[170,cy+5.75,0],white,shell);
  sign('OBSERVATION',169.82,29.2,0,-Math.PI/2);
  sign('GARDEN / N10',170.18,30.6,0,Math.PI/2);
  for(const t of [.25,.55,.82]){
    const points=angles.map(a=>{const p=loungeFacade(36,a,.7),z=loungeFacade(31,a,1.4)[2];return [p[0]*(1-t)+170*t,p[1]*(1-t)+33.8*t-.22,p[2]*(1-t)+z*t];});
    tube('Timber_ceiling_rib',points,.12,wood,shell);
    tube('Warm_ceiling_ribbon',points.map(p=>[p[0]-.15,p[1]-.06,p[2]]),.045,light,shell);
  }
  for(let k=-3;k<=3;k++){
    const a=k*.27,lo=loungeFacade(31,a,.6),hi=loungeFacade(36,a,.6);
    tube('Viewport_structural_mullion',[lo,hi],.13,white,lounge);
  }
  tube('Continuous_window_ledge',angles.map(a=>{const p=loungeFacade(31,a,1.1);return [p[0],p[1]+.08,p[2]];}),.15,wood,lounge);
  tube('Window_cove_light',angles.map(a=>{const p=loungeFacade(36,a,1);return [p[0],p[1]-.12,p[2]];}),.08,light,shell);
  const railPoints=angles.map(a=>{const p=loungeFacade(31,a,4.8);return [p[0],cy+1.1,p[2]];});
  tube('Panoramic_viewing_rail',railPoints,.05,metal,lounge);
  for(let i=0;i<railPoints.length;i+=6){const p=railPoints[i];box('Viewing_rail_post',[.07,1.1,.07],[p[0],cy+.55,p[2]],metal,lounge);}
  // Two seating islands leave the central promenade and window-side aisle clear.
  for(const s of [-1,1]){
    box('Lounge_rug',[16,.025,16],[188,cy+.02,s*22],material('Lounge_rug',0x698783),lounge);
    for(const x of [183,188,193])for(const z of [s*17,s*22,s*27]){
      mesh('Round_lounge_table',new T.CylinderGeometry(.75,.75,.1,24),wood,lounge,[x,cy+.7,z]);box('Table_base',[.22,.65,.22],[x,cy+.325,z],metal,lounge);
      armchair(x-1.45,cy,z,Math.PI/2);armchair(x+1.45,cy,z,-Math.PI/2);armchair(x,cy,z-1.45,0);armchair(x,cy,z+1.45,Math.PI);
      mesh('Table_lamp_stem',new T.CylinderGeometry(.035,.06,.28,10),metal,lounge,[x,cy+.89,z]);
      mesh('Amber_table_lamp',new T.SphereGeometry(.17,12,8),light,lounge,[x,cy+1.08,z]);
    }
    box('Reading_bench',[1.1,.48,8],[175,cy+.24,s*25],navy,lounge);
    box('Reading_bench_back',[.18,.75,8],[174.5,cy+.7,s*25],fabric,lounge);
    for(let k=0;k<4;k++)mesh('Bench_cushion',new RoundedBoxGeometry(.98,.15,1.8,2,.06),cushion,lounge,[175,cy+.54,s*25-3+k*2]);
    box('Bookcase',[.55,2.1,7],[171,cy+1.05,s*25],wood,lounge);
    for(let k=0;k<16;k++)box('Library_book',[.25,.4,.22],[171.3,cy+.55+(k%3)*.55,s*25-3+Math.floor(k/3)*.9],material('Book_spines',0x688997),lounge);
    for(const z of [s*12,s*33]){
      box('Lounge_planter',[2.4,.65,2.4],[176,cy+.325,z],white,lounge);
      for(let k=0;k<5;k++)mesh('Lounge_plant',new T.IcosahedronGeometry(.65,1),material('Leaves',0x6d967b),lounge,[176+Math.cos(k*2)*.55,cy+1,z+Math.sin(k*2)*.55]);
    }
  }
  box('Shared_telescope_base',[1.1,.65,1.1],[203,cy+.325,0],navy,lounge);
  const telescope=mesh('Viewing_scope',new T.CylinderGeometry(.17,.23,1.2,16),white,lounge,[203,cy+1.25,0]);telescope.rotation.z=-Math.PI/2.8;
  catFigure(lounge,201,cy,7,Math.PI/2);catFigure(lounge,189,cy,-10,1.8);catFigure(lounge,181,cy,29,Math.PI/2);
  // 2 m rise over 24 m joins the commons deck to the actual middle windows.
  box('Promenade_level_floor',[14,.3,5.4],[139,24.15,0],floor,fittings);
  const ramp=box('Lounge_access_ramp',[Math.hypot(24,2),.3,6],[158,25.15,0],floor,fittings);ramp.rotation.z=Math.atan2(2,24);
  sign('LOUNGE  /  24 M',145.4,26.35,-2.3,-Math.PI/2);
  box('Promenade_sign_post',[.1,2.3,.1],[145.4,25.45,-2.3],metal,fittings);
  for(const s of [-1,1]){
    for(const [a,b] of [[[132,24.34,s*2.5],[146,24.34,s*2.5]],[[146,24.34,s*2.5],[170,26.34,s*2.5]],[[170,26.34,s*2.5],[198,26.34,s*2.5]]])tube('Promenade_floor_light',[a,b],.022,light,fittings);
    tube('Ramp_handrail',[[146,25.4,s*2.85],[170,27.4,s*2.85]],.045,metal,fittings);
    for(let i=0;i<=8;i++)box('Ramp_rail_post',[.06,1.1,.06],[146+3*i,24.85+i*.25,s*2.85],metal,fittings);
  }
  box('Commons_to_promenade',[2.4,.3,6],[135.3,24.15,7],floor,fittings);
  // Enclose the approach inside the ship; keep openings to the lift and garden.
  const passage=group('Promenade_inner_lining',walls),passageFloor=x=>24.3+Math.max(0,x-146)/12;
  function passageWall(a,b,z,lower=0,upper=3.95){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([a,passageFloor(a)+lower,z,b,passageFloor(b)+lower,z,b,passageFloor(b)+upper,z,a,passageFloor(a)+upper,z],3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();mesh('Promenade_wall',geo,white,passage);
  }
  for(const s of [-1,1]){passageWall(133.9,134.1,s*2.7);passageWall(136.5,136.8,s*2.7);passageWall(138.8,146,s*2.7);passageWall(134.1,136.5,s*2.7,3.2);passageWall(136.8,138.8,s*2.7,3.2);}
  passageWall(146,170,-4);passageWall(146,170,4);
  for(const side of [-1,1]){
    const edge=box('Ramp_floor_edge',[Math.hypot(24,2),.3,1],[158,25.15,side*3.5],floor,fittings);edge.rotation.z=Math.atan2(2,24);
  }
  box('Level_promenade_ceiling',[14,.15,5.4],[139,28.225,0],white,passage);
  const slopedCeiling=box('Ramped_promenade_ceiling',[Math.hypot(24,2),.15,8],[158,29.225,0],white,passage);slopedCeiling.rotation.z=Math.atan2(2,24);
  for(const side of [-1,1])for(const [a,b] of [[132,146],[146,170]]){const z=side*(a===132?2.5:3.8);tube('Passage_cove_light',[[a,passageFloor(a)+3.65,z],[b,passageFloor(b)+3.65,z]],.04,light,passage);}
  for(const [x,z] of [[177,-22],[177,22],[193,0]]){const l=new T.PointLight(0xffe7bd,28,32,2);l.position.set(x,30,z);root.add(l);}
  finishForwardLounge(lounge,shell,cy);
  return {lounge,shell,outline,glazingSamples:angles.flatMap(a=>[31,36].map(y=>loungeFacade(y,a,.25)))};
}
