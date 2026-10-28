import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {LOUNGE,loungeFacade} from '../lounge.js';

// The Observation Lounge's Mars-viewing compass on foot (from tester feedback): a flush inlay on the pale floor, on the
// centreline about 2 m back from the panoramic viewing rail, under the sightline to Mars. It is a thin drawn layer 8 mm
// over the floor: the floor, its height and its colliders are unchanged, and nothing stands in the way.
const RADIUS=.8,LIFT=.008,TEAL='#2fd6c5';
// The rail stands 4.8 m in from the window on the centreline (lounge.js); the inlay sits 2 m back from it.
const CENTRE=[loungeFacade(31,0,4.8)[0]-2,LOUNGE.floor+LIFT,0];

// The face, on a square texture that covers the disc: a dark desaturated teal ring with a narrow warm-brass rim, three
// fine orbits round a small muted copper Mars, a few pale stars and a soft teal glow just inside the rim.
const face=()=>canvasTexture(512,512,(g,w,h)=>{
 const c=w/2,R=w/2,rnd=seeded(151);
 g.clearRect(0,0,w,h);
 // The ring body, a little lighter at the centre where Mars sits.
 const body=g.createRadialGradient(c,c,0,c,c,.96*R);body.addColorStop(0,'rgba(34,86,92,.92)');body.addColorStop(1,'rgba(14,50,56,.94)');
 g.beginPath();g.arc(c,c,.96*R,0,Math.PI*2);g.fillStyle=body;g.fill();
 // The glow: a soft teal halo just inside the rim.
 g.save();g.shadowColor=TEAL;g.shadowBlur=20;g.strokeStyle='rgba(47,214,197,.5)';g.lineWidth=.04*R;
 g.beginPath();g.arc(c,c,.88*R,0,Math.PI*2);g.stroke();g.restore();
 // The narrow warm-brass rim.
 g.strokeStyle='#b8925a';g.lineWidth=.022*R;g.beginPath();g.arc(c,c,.945*R,0,Math.PI*2);g.stroke();
 // Four short brass ticks at the cardinal points, so it reads as a compass.
 g.strokeStyle='#c9a46c';g.lineWidth=.016*R;
 for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){g.beginPath();g.moveTo(c+Math.cos(a)*.8*R,c+Math.sin(a)*.8*R);g.lineTo(c+Math.cos(a)*.87*R,c+Math.sin(a)*.87*R);g.stroke();}
 // Three fine orbits, each a flattened ellipse turned a third of a turn from the last.
 g.strokeStyle='rgba(170,240,230,.55)';g.lineWidth=2.2;
 for(let k=0;k<3;k++){g.beginPath();g.ellipse(c,c,.6*R,.22*R,k*Math.PI/3,0,Math.PI*2);g.stroke();}
 // Tiny pale stars, kept off the Mars disk and the rim.
 g.fillStyle='rgba(230,250,246,.85)';
 for(let i=0;i<16;i++){const a=rnd()*Math.PI*2,r=(.24+rnd()*.6)*R;g.beginPath();g.arc(c+Math.cos(a)*r,c+Math.sin(a)*r,1.1+rnd()*1.2,0,Math.PI*2);g.fill();}
 // Mars: a small muted copper disk at the centre.
 const mars=g.createRadialGradient(c-.04*R,c-.04*R,0,c,c,.15*R);mars.addColorStop(0,'#b97558');mars.addColorStop(1,'#7d4431');
 g.beginPath();g.arc(c,c,.15*R,0,Math.PI*2);g.fillStyle=mars;g.fill();
});

export function createLoungeCompass(){
 if(typeof document==='undefined')return null;
 // Low roughness picks up the lounge's light a little, like polished inlay; the inlay is not lit from within.
 const material=new T.MeshStandardMaterial({name:'Observation_compass_inlay',map:face(),transparent:true,depthWrite:false,roughness:.35,metalness:.2,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const mesh=new T.Mesh(new T.CircleGeometry(RADIUS,96).rotateX(-Math.PI/2),material);mesh.name='Observation_compass_inlay';
 const group=new T.Group();group.name='Observation_compass';group.position.set(...CENTRE);group.add(mesh);anchorObject(group,'observation-lounge');
 return group;
}
