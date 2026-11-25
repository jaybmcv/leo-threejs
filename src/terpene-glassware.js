import * as T from 'three';

// Decoration in the lounge's inherited fitting frame. No lights, collision or prompts.
export function createTerpeneGlassware(){
 const group=new T.Group();group.name='Terpene_glassware';group.userData.keepLive=true;
 const floor=24.3,cx=122,bz=36.1,top=floor+1.08;
 const glass=new T.MeshStandardMaterial({name:'Terpene_clear_glass',color:0xd4f4ee,transparent:true,opacity:.23,roughness:.075,metalness:.18,envMapIntensity:3,depthWrite:false,side:T.FrontSide});
 const liquid=new T.MeshBasicMaterial({name:'Terpene_blends',color:0xffffff,toneMapped:false});
 const cork=new T.MeshStandardMaterial({name:'Terpene_cork',color:0xa57948,roughness:.85});
 const wood=new T.MeshStandardMaterial({name:'Terpene_tasting_wood',color:0x553322,roughness:.65,emissive:0x25140c,emissiveIntensity:.12});
 const metal=new T.MeshStandardMaterial({name:'Terpene_brushed_metal',color:0x89979c,roughness:.4,metalness:.8});
 const green=new T.MeshBasicMaterial({name:'Terpene_green_glow',color:0x65eb7e,toneMapped:false});
 const warm=new T.MeshBasicMaterial({name:'Terpene_shelf_glow',color:0xdcb577,toneMapped:false});
 const add=(geometry,material,name,at=[0,0,0])=>{const o=new T.Mesh(geometry,material);o.name=name;o.position.set(...at);o.userData.noCollide=true;o.renderOrder=material.transparent?4:0;group.add(o);return o;};
 const lathe=points=>new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),12);
 // Four closed silhouettes, each with a neck and a raised glass lip.
 const profiles=[
  [[0,0],[.13,0],[.14,.025],[.055,.23],[.035,.25],[.035,.34],[.045,.345],[.045,.36],[0,.36]],
  [[0,0],[.075,0],[.12,.045],[.145,.12],[.13,.2],[.065,.26],[.035,.28],[.035,.37],[.044,.38],[0,.38]],
  [[0,0],[.085,0],[.09,.025],[.09,.29],[.04,.325],[.03,.34],[.03,.43],[.04,.435],[0,.435]],
  [[0,0],[.12,0],[.14,.03],[.14,.16],[.11,.21],[.04,.235],[.035,.29],[.045,.30],[0,.30]]
 ];
 const fillProfiles=[
  [[0,.012],[.12,.012],[.123,.026],[.083,.14],[0,.14]],
  [[0,.014],[.07,.014],[.109,.05],[.132,.12],[.122,.175],[0,.175]],
  [[0,.012],[.078,.012],[.078,.19],[0,.19]],
  [[0,.012],[.11,.012],[.128,.035],[.128,.135],[0,.135]]
 ];
 const bodies=profiles.map(lathe),fills=fillProfiles.map(lathe),caps=[],vessels=profiles.map(()=>[]),boards=[],strips=[];
 const palette=[0x45e3ff,0x6dff7a,0xf1dc65,0xa77bff,0xff4fd8,0x6dff7a,0x45e3ff,0xa77bff,0xff4fd8,0xf1dc65,0x6dff7a,0x45e3ff,0xa77bff,0xffbb65];
 const vessel=(shape,x,y,z,scale,color,kind)=>{vessels[shape].push({at:[x,y,z],scale,color,kind});const h=profiles[shape].at(-1)[1];caps.push({at:[x,y+h*scale[1]+.012*scale[1],z],scale:[scale[0],scale[1],scale[2]]});};
 let n=0;
 for(const y of [floor+1.17,floor+1.77,floor+2.37]){
  strips.push({at:[cx,y-.032,37.392],scale:[8.94,.018,.018]});
  for(let i=0;i<14;i++){const shape=(i+n)%4,s=.94+((i*7+n)%5)*.035,h=.68+((i*3+n)%5)*.015,k=(i+n)%14;
   vessel(shape,117.85+i*.62,y,37.52,[s,h,s],palette[k===13&&n===6?1:k],'shelf');}
  n+=3;
 }
 // Keep the five flight centres. Their boards rest exactly on the stone slab.
 for(let k=0;k<5;k++){const x=118.5+k*1.8;
  boards.push({at:[x,top+.025,bz-.15],scale:[.74,.05,.32]});
  for(const side of [-1,1])boards.push({at:[x,top+.065,bz-.15+side*.14],scale:[.74,.03,.035]});
  for(let i=0;i<5;i++)vessel(2,x-.28+i*.14,top+.05,bz-.15,[.43,.52,.43],palette[(i+k*2)%14],'vial');
 }
 const matrix=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 const batch=(geo,mat,name,items,colored=false)=>{const mesh=new T.InstancedMesh(geo,mat,items.length);mesh.name=name;mesh.userData.noCollide=true;mesh.renderOrder=mat.transparent?4:0;
  items.forEach((item,i)=>{matrix.compose(new T.Vector3(...item.at),q,new T.Vector3(...item.scale));mesh.setMatrixAt(i,matrix);if(colored)mesh.setColorAt(i,color.setHex(item.color));});
  mesh.instanceMatrix.needsUpdate=true;if(colored)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;};
 for(let s=0;s<4;s++){
  const items=vessels[s];batch(bodies[s],glass,'Terpene_bottle_glass_'+s,items);batch(fills[s],liquid,'Terpene_bottle_liquid_'+s,items,true);
 }
 batch(new T.CylinderGeometry(.037,.032,.035,8),cork,'Terpene_stoppers',caps);
 const block=new T.BoxGeometry(1,1,1);batch(block,wood,'Terpene_tasting_racks',boards);batch(block,warm,'Terpene_shelf_strips',strips);
 // The apparatus stays below the sign and inside a 1.5 m width behind the counter face.
 const globeAt=[cx-.23,top+.61,bz+.17],radius=.4;
 add(new T.CylinderGeometry(.26,.35,.22,24),metal,'Terpene_still_base',[globeAt[0],top+.11,globeAt[2]]);
 add(new T.TorusGeometry(.25,.018,6,24).rotateX(Math.PI/2),green,'Terpene_still_dial',[globeAt[0],top+.226,globeAt[2]]);
 add(new T.SphereGeometry(radius,24,16),glass,'Terpene_still_globe',globeAt);
 const brewMat=new T.MeshStandardMaterial({name:'Terpene_still_brew',color:0x48cb68,emissive:0x38dc63,emissiveIntensity:.65,roughness:.18,transparent:true,opacity:.64,depthWrite:false,side:T.FrontSide});
 const brewPoints=[[0,-.37]];
 for(let i=1;i<=10;i++){const y=-.37+i*.041;brewPoints.push([Math.sqrt(.37*.37-y*y),y]);}brewPoints.push([0,.04]);
 const brew=add(lathe(brewPoints),brewMat,'Terpene_still_liquid',globeAt);brew.renderOrder=3;
 const tube=(points,r,material,name,segments=40)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,r,6,false),material,name);
 const coilX=cx+.48,coilZ=globeAt[2];
 tube([[globeAt[0],top+.95,coilZ],[globeAt[0],top+1.28,coilZ],[cx-.12,top+1.43,coilZ],[cx+.18,top+1.43,coilZ],[coilX+.17,top+1.27,coilZ]],.045,glass,'Terpene_still_neck');
 const coil=[];for(let i=0;i<=84;i++){const a=i/84*Math.PI*6;coil.push([coilX+.17*Math.cos(a),top+1.27-i/84*.66,coilZ+.17*Math.sin(a)]);}
 coil.push([coilX+.12,top+.54,coilZ],[coilX,top+.5,coilZ]);
 tube(coil,.029,glass,'Terpene_still_coil',92);tube(coil,.009,green,'Terpene_still_coil_liquid',92);
 add(bodies[1],glass,'Terpene_collecting_flask',[coilX,top+.025,coilZ]).scale.set(1.25,1.25,1.25);
 const collected=add(fills[1],green.clone(),'Terpene_collected_liquid',[coilX,top+.025,coilZ]);collected.scale.set(1.25,1.25,1.25);
 add(new T.CylinderGeometry(.21,.23,.025,16),metal,'Terpene_collector_foot',[coilX,top+.0125,coilZ]);
 const bubbles=batch(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({name:'Terpene_bubbles',color:0xc1ffc8,toneMapped:false,transparent:true,opacity:.8,depthWrite:false}),'Terpene_still_bubbles',Array.from({length:8},()=>({at:globeAt,scale:[.014,.014,.014]})));bubbles.renderOrder=3.5;bubbles.instanceMatrix.setUsage(T.DynamicDrawUsage);bubbles.frustumCulled=false;
 const drop=add(new T.SphereGeometry(.022,8,6),green,'Terpene_still_drop',[coilX,top+.49,coilZ]);
 let time=0;
 function update(dt){
  time+=dt;brew.scale.y=1+Math.sin(time*1.3)*.016;brew.rotation.z=Math.sin(time*.85)*.012;brew.rotation.x=Math.cos(time*.9)*.01;
  collected.material.color.setHex(0x65eb7e).multiplyScalar(.82+.18*Math.sin(time*1.6));
  drop.position.y=top+.48-(time*.09% .1);drop.scale.setScalar(.7+.3*Math.sin(time*2)**2);
  for(let i=0;i<8;i++){const phase=(time*.16+i/8)%1,y=-.30+phase*.32,a=i*2.4+time*.2,r=.09+(i%3)*.045,s=.012+(i%3)*.003;
   matrix.makeScale(s,s,s);matrix.setPosition(globeAt[0]+Math.cos(a)*r,globeAt[1]+y,globeAt[2]+Math.sin(a)*r);bubbles.setMatrixAt(i,matrix);}
  bubbles.instanceMatrix.needsUpdate=true;
 }
 update(0);
 return {group,brew,bubbles,collected,drop,vessels,get time(){return time;},update};
}
