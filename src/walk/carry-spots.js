// These are existing phase4-programme desks in their unchanged door frames.
export function carrySpots(layout){
 return [['d02-new-2','yarn',-5,4.5],['d16-new-1','ration',-5.3,null]].map(([room,item,x,z])=>{
  const r=layout.rooms.find(r=>r.id===room);if(!r)throw Error('Missing storage room '+room);
  const v=r.door.outward.map(n=>-n),u=[v[1],-v[0]],o=r.door.center;
  if(z===null)z=Math.min(11.8,Math.min(...r.polygon.map(p=>(p[0]-o[0])*v[0]+(p[1]-o[2])*v[1]).filter(d=>d>1))-2);
  const at=(dx,y,dz)=>[o[0]+u[0]*(x+dx)+v[0]*(z+dz),r.y+y,o[2]+u[1]*(x+dx)+v[1]*(z+dz)];
  const study=item==='ration',side=study?-1:1;
  return {id:room,room,name:r.name,deck:r.deck,item,polygon:r.polygon,desk:at(0,0,0),home:at(side*.72,study?.925:.955,-.13),approach:study?at(-1,0,-1.8):at(1.95,0,0),yaw:Math.atan2(-side*u[0],-side*u[1])*180/Math.PI,awayYaw:Math.atan2(side*u[0],side*u[1])*180/Math.PI};
 });
}
