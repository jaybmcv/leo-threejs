import * as T from 'three';
import {finishCirculation} from './circulation-finish.js';
import {COMMONS} from './model.js';
import {unionRectangles,slabGeometry} from './floor-geometry.js';

export const TRANSIT_CORES=[
  {id:'forward',x:132,lastDeck:20,stairX:141.3,stairZ:5.3},
  {id:'aft',x:-132,lastDeck:19,stairX:-133,stairZ:13.5},
];
export const floorY=deck=>-39.7+(deck-1)*4;
export function transitOpenings(deck){
  const holes=[];
  for(const c of TRANSIT_CORES)if(deck<=c.lastDeck){
    for(const s of [-1,1]){
      holes.push({id:`${c.id}_lift_${s}`,x0:c.x-1.8,x1:c.x+1.8,z0:s*6-1.8,z1:s*6+1.8});
      if(deck>1)holes.push({id:`${c.id}_stairs_${s}`,x0:c.stairX-2.5,x1:c.stairX+4.5,z0:s*c.stairZ-2.5,z1:s*c.stairZ+2.5});
    }
  }
  return holes;
}

export function createTransit({minimumDeck=1,maximumDeck=20,coreIds=['forward','aft']}={}){
  const cores=TRANSIT_CORES.filter(c=>coreIds.includes(c.id)).map(c=>({...c,lastDeck:Math.min(c.lastDeck,maximumDeck)}));
  const root=new T.Group();root.name='LEO_connected_transit';root.userData={units:'metres',liftShafts:4,stairTowers:4,decks:20,stage:'Fitted circulation concept'};
  const shell=new T.Group();shell.name='Transit_enclosure';root.add(shell);
  const structure=new T.Group();structure.name='Transit_structure';root.add(structure);
  const decks=new Map();for(let d=minimumDeck;d<=maximumDeck;d++){const g=new T.Group();g.name=`Transit_deck_${d}`;g.userData.deck=d;root.add(g);decks.set(d,g);}
  const materials={floor:new T.MeshStandardMaterial({color:0xc4b89e,roughness:.85}),wall:new T.MeshStandardMaterial({color:0xdadfd8,roughness:.82}),navy:new T.MeshStandardMaterial({color:0x294858,roughness:.7}),metal:new T.MeshStandardMaterial({color:0x778d96,metalness:.5,roughness:.55}),glass:new T.MeshStandardMaterial({color:0x83b7c4,transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide}),light:new T.MeshStandardMaterial({color:0xffe5af,emissive:0xffdf9f,emissiveIntensity:.7})};
  const floors=[];
  function box(name,size,p,m='wall',parent=structure){const o=new T.Mesh(new T.BoxGeometry(...size),materials[m]);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function rail(a,b,parent){const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=new T.Mesh(new T.CylinderGeometry(.035,.035,va.distanceTo(vb),8),materials.metal);o.name='Transit_handrail';o.position.copy(va.clone().add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());parent.add(o);}
  function floor(deck,x0,x1,z0,z1,name){
    const rect={deck,x0,x1,z0,z1,name};floors.push(rect);
    const o=box(name,[x1-x0,.24,z1-z0],[(x0+x1)/2,floorY(deck)-.12,(z0+z1)/2],'floor',decks.get(deck));o.userData={transitFloor:true,...rect};return o;
  }
  const graph={nodes:[],edges:[]};
  const node=(id,deck,x,z)=>{graph.nodes.push({id,deck,position:[x,floorY(deck),z]});return id;};
  const edge=(a,b,type)=>graph.edges.push({a,b,type});
  for(const c of cores){
    const base=floorY(minimumDeck)-.24,top=floorY(c.lastDeck)+3.4;
    for(const s of [-1,1]){
      const z=s*6;
      for(const sx of [-1,1])for(const sz of [-1,1])box('Lift_guide_column',[.16,top-base,.16],[c.x+sx*1.8,(base+top)/2,z+sz*1.8],'navy',structure);
      box('Lift_back_enclosure',[3.6,top-base,.12],[c.x,(base+top)/2,z+s*1.8],'glass',shell);
      for(const sx of [-1,1])box('Lift_side_enclosure',[.12,top-base,3.6],[c.x+sx*1.8,(base+top)/2,z],'glass',shell);
      // One parked car per shaft; doors and landing sills repeat at every served deck.
      const parked=Math.max(minimumDeck,Math.min(c.lastDeck,c.id==='forward'?15:1)),cy=floorY(parked);
      floor(parked,c.x-1.65,c.x+1.65,z-1.65,z+1.65,'Lift_car_floor');
      box('Lift_car_roof',[3.3,.13,3.3],[c.x,cy+2.9,z],'navy',structure);
      for(const sx of [-1,1])box('Lift_car_side',[.09,2.8,3.3],[c.x+sx*1.61,cy+1.4,z],'glass',shell);
      for(let d=minimumDeck;d<=c.lastDeck;d++){
        const y=floorY(d),g=decks.get(d);
        for(const sx of [-1,1])box('Lift_landing_jamb',[.65,2.8,.18],[c.x+sx*1.475,y+1.4,z-s*1.8],'navy',g);
        box('Lift_landing_header',[3.6,.45,.18],[c.x,y+3.025,z-s*1.8],'navy',g);
        box('Lift_call_panel',[.18,.35,.08],[c.x+1.35,y+1.3,z-s*1.94],'light',g);
        floor(d,c.x-1.15,c.x+1.15,Math.min(s*4,s*4.3),Math.max(s*4,s*4.3),'Lift_landing_threshold');
        // Closed landing doors protect the shaft where the parked car is absent.
        if(d!==parked)for(const sx of [-1,1])box('Closed_lift_landing_door',[1.1,2.75,.08],[c.x+sx*.56,y+1.375,z-s*1.8],'metal',g);
        const lift=node(`${c.id}_lift_${s}_d${d}`,d,c.x,z),lobby=node(`${c.id}_lobby_${s}_d${d}`,d,c.x,s*3);
        edge(lift,lobby,'lift landing');if(d>1)edge(lift,`${c.id}_lift_${s}_d${d-1}`,'lift travel');
      }
      // Switchback stair: 12 risers per flight, two 2 m rises per deck.
      const x=c.stairX,zz=s*c.stairZ;
      if(c.id==='forward'){
        for(let d=minimumDeck;d<=c.lastDeck;d++){
          const y=floorY(d),h=d===c.lastDeck?3.4:4;
          if(d>=17&&d<=19){
            box('Stair_gallery_wall',[7,h,.14],[x+1,y+h/2,zz+s*2.57],'wall',shell);
            box('Stair_gallery_door_header',[2,h-2.6,.14],[x-3.5,y+2.6+(h-2.6)/2,zz+s*2.57],'wall',shell);
          }else box('Stair_outer_wall',[9,h,.14],[x,y+h/2,zz+s*2.57],'wall',shell);
        }
      }else box('Stair_outer_wall',[9,top-base,.14],[x,(base+top)/2,zz+s*2.57],'wall',shell);
      box('Stair_top_ceiling',[9,.14,5],[x,top-.1,zz],'wall',shell);
      for(const end of [-1,1])box('Stair_end_wall',[.14,top-base,5.14],[x+end*4.57,(base+top)/2,zz],'wall',shell);
      for(let d=minimumDeck;d<=c.lastDeck;d++){
        const y=floorY(d),g=decks.get(d);
        floor(d,x-4.5,x-2.5,zz-2.5,zz+2.5,'Stair_main_landing');
        if(d<c.lastDeck){
          box('Stair_half_landing',[2,.18,5],[x+3.5,y+1.91,zz],'floor',g);
          for(let i=0;i<12;i++){
            const run=5/12,step=(i+1)/6;
            box('Stair_tread_up',[run,.14,2.2],[x-2.5+(i+.5)*run,y+step-.07,zz-1.4],'floor',g);
            box('Stair_riser_up',[.05,1/6,2.2],[x-2.5+i*run,y+step-1/12,zz-1.4],'wall',g);
            box('Stair_tread_return',[run,.14,2.2],[x+2.5-(i+.5)*run,y+2+step-.07,zz+1.4],'floor',g);
            box('Stair_riser_return',[.05,1/6,2.2],[x+2.5-i*run,y+2+step-1/12,zz+1.4],'wall',g);
          }
          for(const dz of [-2.45,-.35])rail([x-2.5,y+1.1,zz+dz],[x+2.5,y+3.1,zz+dz],g);
          for(const dz of [.35,2.45])rail([x+2.5,y+3.1,zz+dz],[x-2.5,y+5.1,zz+dz],g);
          for(const dz of [-2.45,2.45])rail([x+2.5,y+3.1,zz+dz],[x+4.5,y+3.1,zz+dz],g);
          for(const dz of [-2.2,-.6]){const beam=box('Stair_support_stringer',[Math.hypot(5,2),.16,.12],[x,y+.87,zz+dz],'metal',g);beam.rotation.z=Math.atan2(2,5);}
          for(const dz of [.6,2.2]){const beam=box('Stair_support_stringer',[Math.hypot(5,2),.16,.12],[x,y+2.87,zz+dz],'metal',g);beam.rotation.z=-Math.atan2(2,5);}
        }
        const st=node(`${c.id}_stairs_${s}_d${d}`,d,x-3.5,zz);
        if(d>1)edge(st,`${c.id}_stairs_${s}_d${d-1}`,'stairs');
        edge(st,`${c.id}_lobby_${s}_d${d}`,'deck passage');
      }
    }
    for(let d=minimumDeck;d<=c.lastDeck;d++){
      const y=floorY(d),g=decks.get(d);
      floor(d,c.x-6,c.x+8,-4,4,'Transit_lobby_floor');
      for(const s of [-1,1]){
        if(c.id==='forward'){
          floor(d,136.8,138.8,Math.min(s*2.5,s*3),Math.max(s*2.5,s*3),'Forward_stair_threshold');
        }else floor(d,-137.5,-135.5,Math.min(s*3,s*13.5),Math.max(s*3,s*13.5),'Aft_stair_approach');
        box('Lobby_ceiling_light',[7,.04,.3],[c.x,y+3.2,s*2],'light',g);
      }
    }
  }
  // Connect both lift lobbies to every neighborhood's transverse corridor.
  for(let d=Math.max(6,minimumDeck);d<=Math.min(15,maximumDeck);d++){
    if(coreIds.includes('aft'))floor(d,-138,-124,-54,54,'Aft_residential_crosshall');
    if(coreIds.includes('forward'))floor(d,134,140,-4,4,'Forward_residential_link');
  }
  // Upper promenades have branches to the garden ground floor and existing end galleries.
  for(const d of [17,18,19].filter(d=>decks.has(d))){
    if(coreIds.includes('aft'))floor(d,-138,coreIds.includes('forward')?132:-69,-4,4,'Garden_central_promenade');
    for(const c of COMMONS.filter(c=>coreIds.length===2||(coreIds.includes('aft')?c.neighborhood<=2:c.neighborhood>=9))){
      const x=d===17?(c.neighborhood>=9?135.3:c.x+5.3):c.x-20.5,z=c.z-Math.sign(c.z)*19,half=d===17&&c.neighborhood>=9?1.2:2;
      floor(d,x-half,x+half,Math.min(Math.sign(z)*4,z),Math.max(Math.sign(z)*4,z),'Garden_entry_bridge');
      const id=node(`garden_${c.neighborhood}_d${d}`,d,x,z);edge(id,`forward_lobby_${Math.sign(z)}_d${d}`,'upper promenade');
    }
    if(coreIds.includes('forward'))for(const s of [-1,1])floor(d,136.8,138.8,Math.min(s*7.8,s*8),Math.max(s*7.8,s*8),'Stair_to_garden_bridge');
  }
  for(let d=1;d<=19;d++)edge(`aft_lobby_1_d${d}`,`forward_lobby_1_d${d}`,'central corridor');
  for(const c of TRANSIT_CORES)for(let d=1;d<=c.lastDeck;d++)edge(`${c.id}_lobby_-1_d${d}`,`${c.id}_lobby_1_d${d}`,'lobby');
  const ids=new Set(graph.nodes.map(n=>n.id));graph.edges=graph.edges.filter(e=>ids.has(e.a)&&ids.has(e.b));
  root.userData.graph=graph;
  for(const [d,g]of decks){
    const rects=floors.filter(r=>r.deck===d&&r.name!=='Lift_car_floor');
    for(const o of [...g.children])if(o.userData.transitFloor&&o.name!=='Lift_car_floor'){g.remove(o);o.geometry.dispose();}
    if(rects.length){const mesh=new T.Mesh(slabGeometry(unionRectangles(rects,transitOpenings(d)),floorY(d)),materials.floor);mesh.name='Connected_transit_floor';mesh.userData={transitUnion:true,deck:d};mesh.receiveShadow=true;g.add(mesh);}
  }
  finishCirculation(root,shell,'Main lifts and stairs');
  return {root,shell,structure,decks,floors,graph,materials};
}
