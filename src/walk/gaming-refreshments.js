import * as T from 'three';
import {walkCanvas} from './canvas.js';

// Local dressing of the gaming room's aft bar. The solid joinery is in room-fitout-overrides-v2.json.
// In this frame x runs along the counter and +z faces its visitors; the shelf is behind the server.
export function createGamingRefreshments(edge){
 const group=new T.Group();group.name='Gaming_refreshments';group.position.set(-23.84,0,0);group.rotation.y=Math.PI/2;
 const dark=new T.MeshStandardMaterial({name:'Gaming_bar_gloss',color:0x10121c,metalness:.45,roughness:.2});
 const metal=new T.MeshStandardMaterial({name:'Gaming_server_joints',color:0x485264,metalness:.75,roughness:.32});
 const glow=new T.MeshBasicMaterial({name:'Gaming_server_glow',color:0x62e7ff,toneMapped:false});
 const boxGeometry=new T.BoxGeometry(1,1,1),jointGeometry=new T.SphereGeometry(.055,10,6);
 const put=(name,geometry,material,p,parent=group)=>{const o=new T.Mesh(geometry,material);o.name=name;o.position.set(...p);parent.add(o);return o;};
 const box=(name,size,p,material=dark,parent=group)=>{const o=put(name,boxGeometry,material,p,parent);o.scale.set(...size);return o;};
 // Thin glossy skins and RGB edges sit just outside the solid cabinet and countertop.
 box('Gaming_bar_front',[4.36,.88,.016],[0,.52,2.159]);
 box('Gaming_bar_top',[4.4,.012,.7],[0,1.087,1.8]);
 box('Gaming_shelf_back_finish',[4.24,1.7,.012],[0,.88,.167]);
 for(const y of [.13,.92])box('Gaming_bar_edge',[4.32,.025,.018],[0,y,2.171],edge);
 for(const y of [.43,.96,1.48,1.78]){box('Gaming_shelf_finish',[4.24,.01,.55],[0,y+.036,.32]);box('Gaming_shelf_edge',[4.24,.018,.018],[0,y,.611],edge);}
 for(const x of [-2.17,2.17])box('Gaming_bar_end_edge',[.018,.88,.018],[x,.52,2.171],edge);
 const texture=(w,h,paint)=>{const c=walkCanvas();c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;};
 const label=texture(512,128,(g,w,h)=>{g.fillStyle='#101324';g.fillRect(0,0,w,h);g.textAlign='center';g.fillStyle='#bffaff';g.font='bold 38px sans-serif';g.fillText('VOYAGE // RECHARGE',w/2,52);g.fillStyle='#e8d4ff';g.font='23px sans-serif';g.fillText('MARS CATS VOYAGE',w/2,94);});
 put('Gaming_bar_label',new T.PlaneGeometry(2.5,.625),new T.MeshBasicMaterial({map:label,toneMapped:false}),[0,.53,2.18]);
 const flavours=[['ION PURR','#42d9f4'],['ORBIT ZIP','#bd75ff'],['NOVA CRUNCH','#ff8267']];
 const canGeometry=new T.CylinderGeometry(.055,.055,.2,12),snackGeometry=new T.BoxGeometry(.15,.24,.07);
 const lidGeometry=new T.CylinderGeometry(.052,.052,.006,12);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1);
 const stock=(name,geometry,material,points)=>{const o=new T.InstancedMesh(geometry,material,points.length);o.name=name;points.forEach((p,i)=>o.setMatrixAt(i,matrix.compose(new T.Vector3(...p),rotation,scale)));o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();group.add(o);return o;};
 const labelGeometry=new T.PlaneGeometry(.14,.16),canLabelGeometry=new T.PlaneGeometry(.083,.13);
 let servingMaterial;
 flavours.forEach(([name,color],i)=>{
  const print=kind=>texture(128,256,(g,w,h)=>{g.fillStyle=color;g.fillRect(0,0,w,h);g.fillStyle='#101324';g.textAlign='center';g.font='bold 25px sans-serif';g.fillText('MCV',w/2,49);g.font='bold 17px sans-serif';const words=name.split(' ');g.fillText(words[0],w/2,125);g.fillText(words[1],w/2,151);g.font='15px sans-serif';g.fillText(kind,w/2,215);});
  const material=new T.MeshStandardMaterial({name:'Gaming_stock_'+i,color,metalness:.25,roughness:.35});
  const ink=new T.MeshBasicMaterial({name:'Gaming_stock_label_'+i,map:print('ENERGY'),toneMapped:false});
  const snackInk=new T.MeshBasicMaterial({name:'Gaming_snack_label_'+i,map:print('SNACK'),toneMapped:false});
  if(i===0)servingMaterial=[material,ink];
  const cans=[],packs=[];
  for(const y of [.46,.99,1.51]){
   for(let n=0;n<5;n++){
    const x=-1.73+n*.5+i*.13;
    // This one slot is the can the server takes. It is restored when the served can clears.
    if(!(i===0&&y===1.51&&n===4))cans.push([x,y+.1,.43]);
   }
   for(let n=0;n<2;n++)packs.push([1.05+n*.56+i*.17,y+.12,.43]);
  }
  for(let n=0;n<3;n++)cans.push([-1.9+n*.4+i*.12,1.193,1.8]);
  for(let n=0;n<4;n++)packs.push([1.12+n*.22,1.213,1.6+i*.12]);
  stock('Gaming_energy_cans_'+i,canGeometry,material,cans);
  stock('Gaming_can_lids_'+i,lidGeometry,metal,cans.map(([x,y,z])=>[x,y+.101,z]));
  stock('Gaming_can_labels_'+i,canLabelGeometry,ink,cans.map(([x,y,z])=>[x,y,z+.056]));
  stock('Gaming_snack_packs_'+i,snackGeometry,material,packs);
  stock('Gaming_snack_labels_'+i,labelGeometry,snackInk,packs.map(([x,y,z])=>[x,y,z+.036]));
 });
 const can=()=>{const g=new T.Group();put('Gaming_serving_can_body',canGeometry,servingMaterial[0],[0,0,0],g);put('Gaming_serving_can_lid',lidGeometry,metal,[0,.101,0],g);put('Gaming_serving_can_label',canLabelGeometry,servingMaterial[1],[0,0,.056],g);return g;};
 const shelfCan=can(),heldCan=can(),servedCan=can();shelfCan.name='Gaming_shelf_can';heldCan.name='Gaming_held_can';servedCan.name='Gaming_served_can';
 shelfCan.position.set(.27,1.61,.43);servedCan.position.set(.42,1.193,1.82);group.add(shelfCan,heldCan,servedCan);
 // A narrow humanoid with split feet, an angular chest, and a single diagonal face slit.
 const robot=new T.Group();robot.name='Gaming_robot_server';group.add(robot);
 for(const s of [-1,1]){
  box('Gaming_robot_foot',[.17,.09,.29],[s*.14,.045,1.07],dark,robot);
  box('Gaming_robot_shin',[.105,.34,.11],[s*.14,.27,1],dark,robot);
  put('Gaming_robot_knee',jointGeometry,metal,[s*.14,.47,1],robot);
  box('Gaming_robot_thigh',[.13,.33,.13],[s*.14,.65,1],dark,robot);
  box('Gaming_robot_leg_accent',[.025,.24,.012],[s*.14,.27,1.061],glow,robot);
 }
 box('Gaming_robot_pelvis',[.36,.16,.22],[0,.87,1],dark,robot);
 const torso=new T.Group();torso.name='Gaming_robot_torso';torso.position.set(0,.9,1);robot.add(torso);
 const chest=put('Gaming_robot_chest',new T.CylinderGeometry(.23,.15,.49,6),dark,[0,.29,0],torso);chest.scale.z=.65;
 box('Gaming_robot_chest_accent',[.15,.025,.014],[0,.37,.153],glow,torso);
 put('Gaming_robot_neck',new T.CylinderGeometry(.045,.045,.12,10),metal,[0,.6,0],torso);
 const head=new T.Group();head.name='Gaming_robot_head';head.position.set(0,.77,0);torso.add(head);
 const shell=put('Gaming_robot_head_shell',new T.IcosahedronGeometry(.22,0),dark,[0,0,0],head);shell.scale.set(1,.85,.7);
 const face=box('Gaming_robot_face_slit',[.22,.025,.025],[0,0,.145],glow,head);face.rotation.z=.18;
 const arm=(s)=>{const upper=box('Gaming_robot_upper_arm',[.105,1,.105],[0,0,0],dark,robot),lower=box('Gaming_robot_forearm',[.085,1,.085],[0,0,0],metal,robot);
  const shoulder=put('Gaming_robot_shoulder',jointGeometry,glow,[0,0,0],robot),elbow=put('Gaming_robot_elbow',jointGeometry,metal,[0,0,0],robot),hand=new T.Group();hand.name='Gaming_robot_gripper';robot.add(hand);
  box('Gaming_robot_palm',[.1,.05,.03],[0,0,-.07],dark,hand);
  for(const side of [-1,1])box('Gaming_robot_finger',[.018,.055,.09],[side*.064,0,-.015],metal,hand);
  return {s,upper,lower,shoulder,elbow,hand};};
 const arms=[arm(-1),arm(1)],up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),dir=new T.Vector3(),pole=new T.Vector3(),target=new T.Vector3();
 const segment=(o,a,b)=>{dir.subVectors(b,a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=dir.length();o.quaternion.setFromUnitVectors(up,dir.normalize());};
 const reach=(arm,hand)=>{
  a.set(arm.s*.28,.46,0).applyAxisAngle(up,torso.rotation.y).add(torso.position);c.copy(hand);
  dir.subVectors(c,a);const d=dir.length();dir.normalize();
  // Equal 0.43 m links bend toward the room's ceiling, away from the chest.
  pole.copy(up).addScaledVector(dir,-up.dot(dir)).normalize();b.copy(a).add(c).multiplyScalar(.5).addScaledVector(pole,Math.sqrt(Math.max(0,.43*.43-d*d/4)));
  arm.shoulder.position.copy(a);arm.elbow.position.copy(b);arm.hand.position.copy(c);segment(arm.upper,a,b);segment(arm.lower,b,c);
 };
 // Time, torso yaw, gripper x/y/z, head yaw. The can changes owner at the two contact poses.
 const poses=[[0,0,.35,1.05,1.2,0],[1.2,Math.PI,.27,1.32,.8,.12],[2.4,Math.PI,.27,1.61,.43,0],
  [3.1,Math.PI,.27,1.61,.43,0],[4.1,Math.PI,.3,1.45,.82,-.12],[5.5,0,.35,1.4,1.35,0],
  [6.8,0,.42,1.35,1.75,-.12],[7.7,0,.42,1.193,1.82,-.18],[8.4,0,.42,1.193,1.82,-.18],
  [9.5,0,.35,1.05,1.2,0],[12,0,.35,1.05,1.2,0]];
 let clock=0;
 const pose=()=>{
  const t=clock%12;let i=0;while(i<poses.length-2&&t>=poses[i+1][0])i++;
  const p=poses[i],q=poses[i+1],k=T.MathUtils.smoothstep(t,p[0],q[0]),mix=n=>T.MathUtils.lerp(p[n],q[n],k);
  torso.rotation.y=mix(1);torso.rotation.z=.025*Math.sin(t*Math.PI/6);head.rotation.y=mix(5);head.rotation.x=-.08*Math.sin(t*Math.PI/6);
  target.set(mix(2),mix(3),mix(4));reach(arms[1],target);heldCan.position.copy(target);
  // The resting hand rotates about the same waist as the upper body.
  target.set(-.32,.14,.15).applyAxisAngle(up,torso.rotation.y).add(torso.position);reach(arms[0],target);
  shelfCan.visible=t<3.1||t>=10.6;heldCan.visible=t>=3.1&&t<7.7;servedCan.visible=t>=7.7&&t<10.6;
  group.userData.servingStage=t<1.2?'turn':t<3.1?'reach':t<5.5?'carry':t<7.7?'set':t<10.6?'served':'rest';
  group.userData.servingTime=t;
 };
 pose();
 return {group,update(dt){clock+=dt;pose();}};
}
