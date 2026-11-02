import {LIFTS} from '../walk/lifts.js';
// Feature approaches use selected room frames and physical component reservations.
// Walk headings: zero faces +Z, pi/2 faces +X. Positions are feet in ship metres.
const point=(r,p)=>{const f=r.fittingFrame||r.frame,c=Math.cos(f.yaw||0),s=Math.sin(f.yaw||0);return[f.origin[0]+c*p[0]+s*p[2]*(f.mirror?-1:1),f.origin[1]+p[1],f.origin[2]-s*p[0]+c*p[2]*(f.mirror?-1:1)];};
export function featurePlaces(layout,{crownFloor=LIFTS.find(l=>l.id==='crown').stops.at(-1).y}={}){
 const out=[],room=id=>layout.rooms.find(r=>r.id===id);
 const add=(id,name,deck,at,yaw=0,owner,detail='')=>out.push({id,name,deck,section:'Highlights',detail:(deck?'Deck '+deck:'Fin & crown')+(detail?' · '+detail:''),at,yaw,room:owner,lv:2,resolved:true});
 const local=(id,name,owner,p,yaw=0,detail='')=>{const r=room(owner);add(id,name,r.deck,point(r,p),(r.fittingFrame?.yaw??r.frame.yaw??0)+(r.frame.mirror?Math.PI-yaw:yaw),owner,detail);};
 add('atrium-floor','Open atrium',6,[0,layout.decks[5].y,0],Math.PI/2,undefined,'Atrium floor');
 for(const d of layout.decks.filter(d=>d.number<20))add('lobby-'+d.number,'Forward lift lobby',d.number,[132,d.y,0],Math.PI/2,undefined,d.name);
 local('container-maze','Container Maze','d01-cargo-1',[-17,0,0],Math.PI/2);
 local('transporters','MCT transporters','d01-workshop-5',[-2.25,0,11.4],0);
 local('paw-pool','Paw Pool','d16-recreation-4',[0,0,5.5],Math.PI);
 local('pinball','Leo Pinball','d16-recreation-4',[23.7,0,0],Math.PI/2);
 local('paws-off','Paws Off treadmills','d16-gym-3',[-18,0,-8],Math.PI);
 local('theatre-concession','Theater concession stand','d16-theater-5',[-20,0,-.4],Math.PI);
 local('gaming-lounge','Gaming lounge','d16-training-aft',[-18,0,0],Math.PI/2);
 local('telescope','Alien Cat Invasion telescope','observation-lounge',[31.7,0,0],Math.PI/2,'Raised observation lounge via Deck 17 ramp');
 const garden=room('commons-1'),piece=name=>garden.components.pieces.find(p=>p.name===name),maze=piece('Haze Maze tower'),arcade=piece('arcade row with Paws Off treadmill'),dome=piece('geodesic hammock dome');
 add('hydro-nip','Hydro-Nip Lounge',17,[garden.door.center[0],garden.y,garden.door.center[2]-1.4],Math.PI,garden.id);
 add('haze-maze','Haze Maze entrance',17,[maze.center[0],garden.y,maze.center[2]+maze.size[2]/2+1.8],Math.PI,garden.id);
 add('arcade','Hydro-Nip arcade',17,[garden.x+22.44-1.55,garden.y,garden.z-3.85],Math.PI/2,garden.id,'Alien Cat Invasion · Paw Pool · Neon Arena Survival · Paws Off');
 add('arcade-pool','Paw Pool arcade cabinet',17,[garden.x+22.44-1.55,garden.y,garden.z-1.925],Math.PI/2,garden.id);
 add('neon-arena','Neon Arena Survival',17,[garden.x+22.44-1.55,garden.y,garden.z-.04],Math.PI/2,garden.id);
 add('arcade-treadmill','Paws Off arcade treadmill',17,[garden.x+22.44-3.85,garden.y,garden.z+11.43],Math.PI/2,garden.id);
 add('aquarium-treasure','Aquarium Treasure entrance',19,point(garden,[-1.2,8,-17.8]),0,garden.id,'Upper Hydro-Nip gallery');
 local('chinampa','Chinampa & Three Sisters','d03-farm-1',[15.5,0,-.85],Math.PI/2);
 add('lever-panel','Tank-bay lever panel',4,[-173.9,layout.decks[3].y,0],-Math.PI/2);
 add('hammock-dome','Hammock dome',17,[dome.center[0],garden.y,dome.center[2]+dome.size[2]/2+.8],Math.PI,garden.id);
 add('clubhouse-door','Clubhouse entrance',17,[arcade.center[0]-1.8,garden.y,-27.5],Math.PI/2,garden.id,'Vault door beside the arcade');
 for(const r of layout.rooms.filter(r=>r.kind==='garden'))for(const door of r.galleryDoors||[]){if(door.deck===17)continue;const n=door.outward;add(r.id+'-gallery-'+door.deck,r.name+' · gallery',door.deck,[door.center[0]-n[0]*1.2,door.center[1],door.center[2]-n[1]*1.2],Math.atan2(-n[0],-n[1]),r.id);}
 const blossom=room('commons-10').components.pieces.find(p=>p.name==='blossom garden assembly');add('blossom','Blossom garden',17,[blossom.center[0]-5.5,blossom.center[1],blossom.center[2]],Math.PI/2,'commons-10');
 local('hamster-ball','Hamster ball','commons-10',[5.4,0,-7.3],0);
 add('graffiti','Graffiti wall',19,[-129.5,layout.decks[18].y,0],-Math.PI/2);
 for(const [i,stop]of LIFTS.find(l=>l.id==='crown').stops.slice(0,-1).entries())add(i?'fin-platform-'+i:'fin-service-gallery',i?stop.label:'Fin lift service gallery',null,[-242.8,stop.y,0],-Math.PI/2,undefined,i?'Inspection platform':'Deck 17 · upper aft gallery');
 add('crown-lounge','Crown lounge',null,[-240,crownFloor,4],Math.PI/2);
 add('selfie-camera','Group photo camera',null,[-264.3,crownFloor,.8],-Math.PI/2);
 add('crown-tv','Crown TV',null,[-253,crownFloor,0],Math.PI/2);
 const sample=layout.cabins.find(c=>c.id==='N10-271'&&c.berths===2)||layout.cabins.find(c=>c.deck===15&&c.berths===2);add('sample-cabin','Your twin cabin',sample.deck,[sample.x,sample.y,sample.z],sample.yaw||0,sample.id,'Neighborhood '+sample.neighborhood);
 return out;
}
