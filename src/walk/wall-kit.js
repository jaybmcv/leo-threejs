import * as T from 'three';

// Spacecraft lining for the corridors on foot (feedback-inbox #3): satin metal wall panels over a dark seam backing, a
// graphite kick strip, and at level 2 a handrail, a pair of pipes on brackets, vents, access hatches and equipment boxes
// with status lights. Level 1 (panels, seams, kick) is for homes; level 2 for service areas. Everything goes between the
// trim frames (trim.js) and only where there is wall, standing at most 15 cm proud, and is kept clear of the oak and
// graphite wayfinding stripes (circulation-finish.js) between 0.19 and 0.70 m.
const RIB=.32,PANEL=[.76,2.96],GAP=.024,KICK=.14,RAIL=.98,PIPES=[[2.86,.045,.1],[2.99,.03,.09]],BRACKET=2;
const standard=(name,color,metalness,roughness,extra={})=>new T.MeshStandardMaterial({name,color,metalness,roughness,...extra});
export const KIT_MATERIALS={
 panel:standard('Walk_kit_panel',0xf1f3f2,.55,.24),
 hatch:standard('Walk_kit_hatch',0xdfe4e3,.5,.28),
 seam:standard('Walk_kit_seam',0x6f7b80,.2,.7),
 dark:standard('Walk_kit_graphite',0x2f434d,.3,.55),
 pipe:standard('Walk_kit_pipe',0xc6cdcd,.6,.32),
 line:standard('Walk_kit_line',0x5f8796,.35,.45),
 status:standard('Walk_kit_status',0x3fd0a0,0,.4,{emissive:0x3fd0a0,emissiveIntensity:1.4}),
};

// The stretches of `runs` inside [a,b].
const within=(runs,a,b)=>runs.map(([p,q])=>[Math.max(p,a),Math.min(q,b)]).filter(([p,q])=>q-p>.1);

// Adds the kit for one corridor (as in trim.js: along `axis` from lo to hi, centred at `mid`, `width` wide, with the
// wall stretches of each side, frames from `start` every `spacing`) to `parts`, geometry lists keyed by material.
export function wallKit(parts,{axis,lo,hi,mid,width,sides,start,spacing},level){
 const add=(m,g)=>(parts[m]||(parts[m]=[])).push(g);
 // A box on side s's wall: centred at t along and y up, standing d proud of the wall (its centre), sized along, up, deep.
 const put=(m,s,t,y,d,along,up,deep)=>{const u=mid+s*(width/2-d);add(m,axis==='x'?new T.BoxGeometry(along,up,deep).translate(t,y,u):new T.BoxGeometry(deep,up,along).translate(u,y,t));};
 const rod=(m,s,a,b,y,r,d)=>{const g=new T.CylinderGeometry(r,r,b-a,8);const u=mid+s*(width/2-d),t=(a+b)/2;
  add(m,axis==='x'?g.rotateZ(Math.PI/2).translate(t,y,u):g.rotateX(Math.PI/2).translate(u,y,t));};
 // Bays between the frames.
 const marks=[lo];for(let t=start;t<hi-RIB;t+=spacing)if(t>lo+RIB)marks.push(t);marks.push(hi);
 for(const [s,runs] of sides){
  let bay=0;
  for(let i=0;i<marks.length-1;i++){
   const a=marks[i]+(i>0?RIB/2+.03:0),b=marks[i+1]-(i<marks.length-2?RIB/2+.03:0);
   for(const [p,q] of within(runs,a,b)){
    const len=q-p,mid_=(p+q)/2;if(len<.8)continue;
    put('seam',s,mid_,(PANEL[0]+PANEL[1])/2,.003,len,PANEL[1]-PANEL[0],.004);
    put('dark',s,mid_,KICK/2,.012,len,KICK,.02);
    const n=Math.max(1,Math.round(len/1.9)),w=len/n,rows=[[PANEL[0],1.86],[1.9,PANEL[1]]];
    for(let j=0;j<n;j++){
     const t=p+w*(j+.5);
     for(const [y0,y1] of rows)put('panel',s,t,(y0+y1)/2,.012,w-GAP,y1-y0-GAP,.02);
    }
    if(level<2)continue;
    // Handrail on stand-offs.
    rod('pipe',s,p+.06,q-.06,RAIL,.022,.075);
    for(let t=p+.3;t<q-.2;t+=1.6)put('pipe',s,t,RAIL,.04,.03,.03,.07);
    const pick=p+w*(n>1?1.5:.5);
    if(s<0){
     // An access hatch in every other bay, with its handle and a status light.
     if(bay%2===0&&w>.9){put('seam',s,pick,1.32,.025,.68,.94,.004);put('hatch',s,pick,1.32,.035,.62,.88,.02);put('dark',s,pick+.22,1.32,.055,.04,.26,.03);put('status',s,pick-.22,1.68,.05,.05,.05,.01);}
    }else{
     // A vent high up in every bay; an equipment box with a status light in every other.
     put('dark',s,pick,2.72,.025,.5,.22,.02);for(let k=-1;k<=1;k++)put('line',s,pick,2.72+k*.06,.035,.46,.022,.012);
     if(bay%2===1&&n>1){const t=p+w*.5;put('dark',s,t,1.42,.08,.48,.34,.14);put('line',s,t,1.42,.155,.4,.04,.01);put('status',s,t+.16,1.53,.155,.04,.04,.01);}
    }
    bay++;
   }
  }
  // Pipes on brackets along one wall only (a side corridor's aft wall, the spine's port wall), the whole of each stretch.
  if(level>=2&&s<0)for(const [p,q] of runs){
   if(q-p<1)continue;
   for(const [y,r,d] of PIPES)rod(r>.04?'pipe':'line',s,p+.05,q-.05,y,r,d);
   for(let t=p+.4;t<q-.3;t+=BRACKET)put('dark',s,t,2.92,.07,.05,.26,.1);
  }
 }
}
