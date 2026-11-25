import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture} from '../polish-kit.js';
import {fitLoungeEntrance} from './community-routes.js';

// Deck 19 only. Local +z points out into the plaza; the existing doorway stays at x/z zero.
export const VIP_RUNNER={width:2.2,start:.08,length:6.6,postX:1.28,posts:[.28,1.88,3.48,5.08,6.68],surface:.044};
const outline=()=>{
 const s=new T.Shape();s.moveTo(0,.44);
 s.bezierCurveTo(.35,.44,.28,.31,.65,.34);s.bezierCurveTo(1.2,.43,1.5,.34,1.72,.31);
 s.quadraticCurveTo(1.72,.13,2.1,.12);s.quadraticCurveTo(1.94,0,2.1,-.12);
 s.quadraticCurveTo(1.72,-.13,1.72,-.31);s.bezierCurveTo(1.2,-.34,.7,-.29,.45,-.35);
 s.quadraticCurveTo(0,-.49,-.45,-.35);s.bezierCurveTo(-.7,-.29,-1.2,-.34,-1.72,-.31);
 s.quadraticCurveTo(-1.72,-.13,-2.1,-.12);s.quadraticCurveTo(-1.94,0,-2.1,.12);
 s.quadraticCurveTo(-1.72,.13,-1.72,.31);s.bezierCurveTo(-1.5,.34,-1.2,.43,-.65,.34);
 s.bezierCurveTo(-.28,.31,-.35,.44,0,.44);s.closePath();return s;
};
const neon=(name,color)=>new T.MeshBasicMaterial({name,color,toneMapped:false});
export function createLoungeVipEntrance(sprig){
 const group=new T.Group();group.name='Lounge_entrance_sign_19';
 const solid=new T.Group();solid.name='Lounge_VIP_posts_solid';
 const body=new T.MeshStandardMaterial({name:'Lounge_VIP_marquee_body',color:0x160a24,roughness:.6,metalness:.25});
 const gold=new T.MeshStandardMaterial({name:'Lounge_VIP_gold',color:0xe4b653,metalness:.72,roughness:.27});
 const pink=neon('Lounge_VIP_pink_neon',0xff60ca),purple=neon('Lounge_VIP_purple_neon',0xa452ff);
 const add=(name,geometry,material)=>{const o=new T.Mesh(geometry,material);o.name=name;o.userData.noCollide=true;group.add(o);return o;};
 const instances=(name,geometry,material,positions)=>{const o=new T.InstancedMesh(geometry,material,positions.length);o.name=name;o.userData.noCollide=true;
  positions.forEach((p,i)=>o.setMatrixAt(i,new T.Matrix4().makeTranslation(...p)));group.add(o);return o;};

 // Fit the real 0.7 m wall header and leave the neighbouring painting's frame clear.
 const shape=outline(),cy=2.85,rise=.68,span=.8,front=.245;
 add('Lounge_VIP_marquee_panel',new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:12}).scale(span,rise,1).translate(0,cy,.12),body);
 const edge=shape.getSpacedPoints(110).map(p=>new T.Vector3(p.x*span,p.y*rise+cy,front));
 add('Lounge_VIP_marquee_rim',new T.TubeGeometry(new T.CatmullRomCurve3(edge.slice(0,-1),true),180,.014,5,true),purple);
 instances('Lounge_VIP_warm_bulbs',new T.SphereGeometry(.026,8,5),neon('Lounge_VIP_bulb',0xffd78c),shape.getSpacedPoints(64).slice(0,-1).map(p=>[p.x*.94*span,cy+p.y*.82*rise,front+.012]));

 // Transparent artwork leaves the scalloped panel and its real bulb border visible.
 const paint=(g,w,h)=>{g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='alphabetic';g.lineJoin='round';
  g.shadowColor='#ee65ff';g.shadowBlur=19;g.strokeStyle='#ff70e4';g.fillStyle='#fff0ff';
  g.font='600 84px "Archivo", "Sora", sans-serif';g.lineWidth=4;g.strokeText('HYDRO-NIP',w/2,148);g.fillText('HYDRO-NIP',w/2,148);
  g.font='800 174px "Archivo", "Sora", sans-serif';g.strokeText('LOUNGE',w/2,338);g.fillText('LOUNGE',w/2,338);
  for(const sx of [-1,1])sprig(g,w/2+sx*690,300,154);};
 const map=canvasTexture(2048,480,paint);
 globalThis.document?.fonts?.ready.then(()=>{paint(map.image.getContext('2d'),2048,480);map.needsUpdate=true;});
 add('Lounge_VIP_neon_lettering',new T.PlaneGeometry(3.6*span,.78*rise).translate(0,cy,front+.008),new T.MeshBasicMaterial({name:'Lounge_VIP_lettering',map,transparent:true,toneMapped:false,depthWrite:false}));
 // Paired curls sit outside the bulb ring, tight against the wall above the opening.
 for(const side of [-1,1])for(const top of [-1,1]){
  const pts=[[1.58,.26],[1.86,.43],[2.18,.38],[2.24,.2],[2.1,.18],[2.08,.29]].map(([x,y])=>new T.Vector3(side*x*span,cy+top*y*rise,front+.012));
  add('Lounge_VIP_neon_scroll',new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.018,6,false),top>0?pink:purple);
 }

 const r=VIP_RUNNER,rugMap=canvasTexture(512,1536,(g,w,h)=>{
  const pile=g.createLinearGradient(0,0,w,0);pile.addColorStop(0,'#451058');pile.addColorStop(.45,'#76278b');pile.addColorStop(1,'#511365');g.fillStyle=pile;g.fillRect(0,0,w,h);
  for(let i=0;i<18000;i++){const x=(i*137)%w,y=(i*73+Math.floor(i/w)*31)%h;g.fillStyle=i%2?'#ffffff09':'#13002212';g.fillRect(x,y,1,3);}
  g.strokeStyle='#e4bc68';g.lineWidth=4;for(const pad of [17,29])g.strokeRect(pad,pad,w-2*pad,h-2*pad);
 });
 const velvet=new T.MeshStandardMaterial({name:'Lounge_VIP_velvet',map:rugMap,roughness:1});
 add('Lounge_VIP_runner',new T.PlaneGeometry(r.width,r.length).rotateX(-Math.PI/2).translate(0,r.surface,r.start+r.length/2),velvet);
 const positions=r.posts.flatMap(z=>[-r.postX,r.postX].map(x=>[x,0,z]));
 instances('Lounge_VIP_post_bases',new T.CylinderGeometry(.15,.19,.06,16).translate(0,.045,0),gold,positions);
 instances('Lounge_VIP_post_shafts',new T.CylinderGeometry(.033,.045,.82,10).translate(0,.48,0),gold,positions);
 instances('Lounge_VIP_post_balls',new T.SphereGeometry(.075,10,7).translate(0,.95,0),gold,positions);
 const ropes=[];for(const x of [-r.postX,r.postX])for(let i=1;i<r.posts.length;i++){
  const a=r.posts[i-1],b=r.posts[i];ropes.push(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(x,.88,a),new T.Vector3(x,.66,(a+b)/2),new T.Vector3(x,.88,b)]),16,.037,6,false));
 }
 add('Lounge_VIP_velvet_ropes',mergeGeometries(ropes),new T.MeshStandardMaterial({name:'Lounge_VIP_rope_velvet',color:0x78228c,roughness:1}));
 // Only the posts are solid. Small proxies leave both ends and the entire doorway clear.
 for(const [x,,z] of positions){const o=new T.Mesh(new T.BoxGeometry(.16,1.02,.16));o.name='Lounge_VIP_post_collider';o.position.set(x,.51,z);o.userData.collisionOnly=true;solid.add(o);}
 fitLoungeEntrance(group,19);fitLoungeEntrance(solid,19);return {group,solid};
}
