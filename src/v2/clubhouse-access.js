import*as T from'three';
import{cutOut}from'../cut-out.js';
import{box,polygonGeometry,mesh,glass,lining,removeGeometryCaps}from'./geometry.js';
import{CLUBHOUSE_SHAFT}from'./vault-lift-fit.js';

const OLD_Z=-51.2;
const upright=o=>/wall|lining|partition/i.test(o.name)&&!/hull|pressure|outer_room/i.test(o.name)&&!o.userData.noCollide;
const sillMetal=new T.MeshStandardMaterial({name:'Clubhouse_lift_sill',color:0x111b29,metalness:.75,roughness:.32});
function closeOldGroundLiftWalls(ship,root,y){
 ship.inside.updateMatrixWorld(true);
 for(const x of [-88,-86]){
  const patch=new T.Box3(new T.Vector3(x-.061,y,OLD_Z-1.8),new T.Vector3(x+.061,y+3.72,OLD_Z+1.8)),at=new T.Vector3(x,y+1.5,OLD_Z);let finish=lining,near=Infinity;
  ship.inside.traverse(o=>{if(!o.isMesh||!/wall|lining|partition/i.test(o.name)||o.userData.noCollide)return;
   const material=[].concat(o.material).find(m=>m&&!m.transparent&&m.opacity===1);if(!material)return;
   if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const bounds=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld),distance=bounds.distanceToPoint(at);
   if(distance<near){near=distance;finish=material;}
  });
  cutOut(ship.inside,patch,upright);
  // Bury the foot 5 cm into the slab to avoid a coplanar face at floor level.
  const wall=box(root,'V2_retired_clubhouse_lift_wall',[.12,3.77,3.6],[x,y+1.835,OLD_Z],finish);wall.userData={room:'commons-1',v2Deck:17,role:'wall'};
 }
}
export function prepareClubhouseAccess(ship,spec){
 const root=new T.Group();root.name='V2_clubhouse_landing_connections';root.userData.room='commons-1';ship.inside.add(root);
 const ground=spec.stops[0].y;
 // The old upper cutouts came from the lift. The source walls and slabs already close those levels.
 closeOldGroundLiftWalls(ship,root,ground);
 // Keep the existing entrance to the separate vault clubhouse beside the arcade.
 const door=new T.Box3(new T.Vector3(-88.43,ground+.01,-46.7),new T.Vector3(-87.58,ground+2.35,-44.9));
 cutOut(ship.inside,door,o=>/wall|lining/i.test(o.name)&&!o.userData.noCollide);
 const {edge,x,z,carRadius,doorWidth,front}=CLUBHOUSE_SHAFT,half=doorWidth/2,r=carRadius+.008;
 // Follow the car's curved floor lip and meet the untouched gallery edge at its finished height.
 const sill=[[edge,z-half],[edge,z+half]];
 for(let i=0;i<=32;i++){const d=half-i*doorWidth/32;sill.push([x-Math.sqrt(r*r-d*d),z+d]);}
 for(const {deck,y} of spec.stops.slice(1)){
  const o=mesh(root,'V2_clubhouse_connection_floor',removeGeometryCaps(polygonGeometry(sill,[],y,.12),0),sillMetal);
  o.userData={room:'commons-1',v2Deck:deck,role:'floor'};
  const end=x-front+.04,length=end-edge;
  for(const side of [-1,1]){
   const at=[(edge+end)/2,y+.55,z+side*half];
   box(root,'V2_clubhouse_connection_guard',[length,1.1,.07],at,glass);
   box(root,'V2_clubhouse_connection_rail',[length,.045,.07],[at[0],y+1.1,at[2]],sillMetal);
  }
 }
 root.updateMatrixWorld(true);return root;
}
