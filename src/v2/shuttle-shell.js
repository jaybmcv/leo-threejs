import {wallJoints,mitreWallGeometry} from './wall-joints.js';
import {entrySegments} from './room-entries.js';
import {wall,removePanelEndCaps,glass} from './geometry.js';
import {HALF,CASING} from '../walk/shuttle-doors.js';

// Deck 2 glass meets on the same bisectors as the room shells. The existing
// full casing owns the doorway ends; the pressure facade owns the fourth side.
export function buildShuttleWalls(g,s){
 for(let i=1;i<4;i++){
  const a=s.polygon[i],b=s.polygon[(i+1)%4],door=[(a[0]+b[0])/2,s.y,(a[1]+b[1])/2];
  if(i===3&&s.hullEnvelope)g.userData.bayEntry={center:door,width:HALF*2,height:3.2};
  const pieces=i===3&&s.hullEnvelope?entrySegments(a,b,door,2*(HALF+CASING)):[[a,b]];
  for(const [aa,bb]of pieces){const o=wall(g,aa,bb,s.y,3.2,glass),joints=wallJoints(s.polygon,i,aa,bb);if(i===1)joints[0]=null;if(i===3)joints[1]=null;
   removePanelEndCaps(o);mitreWallGeometry(o.geometry,joints);o.updateMatrix();o.geometry.applyMatrix4(o.matrix);o.position.set(0,0,0);o.rotation.set(0,0,0);
   const p=o.geometry.attributes.position,base=Math.fround(s.y);for(let k=0;k<p.count;k++)if(Math.abs(p.getY(k)-base)<.0001)p.setY(k,base);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();o.updateMatrix();
  }
 }
}
