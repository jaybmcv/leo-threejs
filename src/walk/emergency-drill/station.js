import overrides from '../../plan/room-fitout-overrides-v2.json' with {type:'json'};

// The interaction follows the same craft frame and button descriptor as the fitting.
export const DRILL_CRAFT='d4-escape-s-9';
export function drillStation(layout){
 const craft=layout.shuttles.find(s=>s.id===DRILL_CRAFT),button=overrides[DRILL_CRAFT].add.find(p=>p.part==='emergency_drill_button');
 if(!craft)throw Error('Missing Emergency Drill craft');
 const c=Math.cos(craft.yaw),s=Math.sin(craft.yaw),world=([u,y,v])=>[craft.x+c*u+s*v,craft.y+y,craft.z-s*u+c*v];
 return {craft:craft.id,point:world(button.at),approach:world([8.9,.126,.775]),yaw:craft.yaw+Math.PI/2,
  near(p){const dx=p.x-craft.x,dz=p.z-craft.z,u=c*dx-s*dz,v=s*dx+c*dz;
   return p.y-craft.y>-.1&&p.y-craft.y<1&&u<button.at[0]&&Math.hypot(u-button.at[0],v-button.at[2])<1.7?{kind:'emergency-drill',label:'Emergency Drill'}:null;},
 };
}
