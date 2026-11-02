import*as T from'three';
import{cutOut}from'../cut-out.js';
import{box,polygonGeometry,mesh,floor,glass,metal}from'./geometry.js';
// Connections around the accepted tube position. Car, gates, stops and motion stay in main's producer.
export function clubhouseAccessBounds(lift){const p=new T.Vector3().setFromMatrixPosition(lift.group.matrixWorld);return{x0:p.x-3.97,x1:p.x-1.2,z0:p.z+1.8,z1:p.z+3.4,p};}
export function prepareClubhouseAccess(ship,lift){
 const{x0,x1,z0,z1,p}=clubhouseAccessBounds(lift),root=new T.Group();root.name='V2_clubhouse_landing_connections';root.userData.room='commons-1';ship.inside.add(root);
 const guard=(name,a,b,y)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);for(const [suffix,h,dy,mat]of[['glass',1.1,.55,glass],['rail',.045,1.1,metal]]){const o=box(root,name+'_'+suffix,[len+.025,h,.07],[(a[0]+b[0])/2,y+dy,(a[1]+b[1])/2],mat);o.rotation.y=yaw;}};
 for(const stop of lift.lift.stops){const y=stop.y;
  // Ground-floor approach passes inboard of the existing garden stair, through the clubhouse wall.
  if(stop.deck===17){const door=new T.Box3(new T.Vector3(p.x-1.9,y+.01,p.z+4.5),new T.Vector3(p.x-1.05,y+2.35,p.z+6.3));cutOut(ship.inside,door,o=>/wall|lining/i.test(o.name)&&!o.userData.noCollide);continue;}
  const opening=new T.Box3(new T.Vector3(x0-.03,y+.01,z0+.08),new T.Vector3(x1+.15,y+2.35,z1-.08));
  // Only room partitions/guards along the new route; never the pressure skin or the tube itself.
  cutOut(ship.inside,opening,o=>!/stair|tread/i.test(o.name)&&(!o.userData.batchedEnvelope||o.userData.role==='wall'));
  // Replace this exact floor patch rather than layering a second coplanar finish.
  const patch=new T.Box3(new T.Vector3(x0,y-.31,z0),new T.Vector3(x1,y+.012,z1));cutOut(ship.inside,patch,o=>/floor|gallery|landing|Deck_slab/i.test(o.name)&&!/stair|tread/i.test(o.name)&&!o.userData.noCollide);
  const o=mesh(root,'V2_clubhouse_connection_floor',polygonGeometry([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],[[[p.x-1.8,p.z-1.8],[p.x+1.8,p.z-1.8],[p.x+1.8,p.z+1.8],[p.x-1.8,p.z+1.8]]],y,.24),floor);o.userData={room:'commons-1',v2Deck:stop.deck,role:'floor'};
  guard('V2_clubhouse_connection_guard',[x0,z0],[x1,z0],y);guard('V2_clubhouse_connection_guard',[x0,z1],[x1,z1],y);
  if(stop.deck>17){const a=p.x-1.8,b=p.x+1.8,c=p.z-1.8,d=p.z+1.8;guard('V2_clubhouse_collar_guard',[a,c],[b,c],y);guard('V2_clubhouse_collar_guard',[a,c],[a,d],y);guard('V2_clubhouse_collar_guard',[b,c],[b,d],y);guard('V2_clubhouse_collar_guard',[p.x+1.2,d],[b,d],y);}
 }
 root.updateMatrixWorld(true);return root;
}
