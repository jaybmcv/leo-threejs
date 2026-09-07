import envelope from './assets/aft-envelope.json' with {type:'json'};
import * as T from 'three';
import {cutWindowApertures,addGlazing} from './window-geometry.js';
import {CENTRAL_ENGINE_WINDOWS,POD_ENGINE_WINDOWS} from './engine-window-plan.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import logo from './mcv-logo-contours.json' with {type:'json'};

export function addPassengerWindows(exterior,hull,side,surfaceFactory){
 const owner=exterior.getObjectByName('01_EXTERIOR_REFINED_V31')||exterior,root=new T.Group();root.name='V33_passenger_windows_and_identity';root.matrixAutoUpdate=false;root.matrix.copy(owner.matrixWorld).invert();owner.add(root);
 const obsolete=[];exterior.traverse(o=>{if(o.name==='Individual_deck_windows'||o.name==='Feline_mission_crest')obsolete.push(o);});obsolete.forEach(o=>o.removeFromParent());
 const rects=[];
 for(let deck=6;deck<=20;deck++){
  const floor=-40+(deck-1)*4,y0=floor+1.25,y1=y0+(deck===20?1.3:.95);
  for(let col=0;col<52;col++){
   const x0=-125+col*5.1,x1=x0+3.1;
   // Clear identity fields, existing access hatches and the upper side glazing.
   if(y1>2&&y0<23&&x1>-49&&x0<18)continue;
   if(y1>1&&y0<18&&x1>52&&x0<94)continue;
   if(y1>21&&y0<30&&[-107.3,-65.9,-24.6,16.8].some(x=>x1>x-1&&x0<x+13.5))continue;
   if(y1>29&&x1>37&&x0<88)continue;
   if(x0>111&&y0>19)continue;
   if([side(x0,y0),side(x1,y0),side(x0,y1),side(x1,y1)].some(z=>!Number.isFinite(z)||z<32))continue;
   rects.push({x0,x1,y0,y1,deck,floor,zone:deck===20?'command':'residential-and-commons'});
  }
 }
 // Extend the occupied aft landings and the long upper service gallery.
 for(const deck of [8,9,10,11,12,13,14,15,16,17])for(let x0=-169;x0<-128;x0+=6.2){
  const floor=-39.7+(deck-1)*4,y0=floor+1.25,y1=y0+1.05,x1=x0+3.1;
  if([side(x0-.15,y0-.15),side(x1+.15,y1+.15)].every(z=>Number.isFinite(z)&&z>8))rects.push({x0,x1,y0,y1,deck,floor,zone:'aft-access'});
 }
 for(let x0=-235;x0<-175;x0+=6){const floor=24.3,y0=floor+1.25,y1=y0+1.3,x1=x0+3.5;rects.push({x0,x1,y0,y1,deck:17,floor,zone:'aft-upper-gallery'});}
 rects.push(...CENTRAL_ENGINE_WINDOWS);
 let cutTriangles=0;for(const h of hull)cutTriangles+=cutWindowApertures(h,rects);
 const thermalPanels=[];exterior.traverse(o=>{if(o.isMesh&&o.name==='Lower_thermal_panel_fields')thermalPanels.push(o);});for(const panel of thermalPanels)cutTriangles+=cutWindowApertures(panel,rects);
 const steel=new T.MeshStandardMaterial({name:'V33_window_frames',color:0x697f8b,metalness:.62,roughness:.3,side:T.DoubleSide});
 const glass=new T.MeshPhysicalMaterial({name:'V33_passenger_glass',color:0x4b859b,metalness:.08,roughness:.16,transparent:true,opacity:.42,side:T.DoubleSide,depthWrite:false});
 const lining=new T.MeshStandardMaterial({name:'V33_window_reveals',color:0x233c4a,roughness:.65,side:T.DoubleSide});
 addGlazing(root,rects,side,steel,glass,lining);
 // Contours extracted from the supplied transparent PNG, including its holes.
 // Preserve the helmet, antenna, whiskers, star and face instead of redrawing.
 const path=new T.ShapePath(),[l,t,r,b]=logo.bounds,scale=14/(b-t);
 for(const ring of logo.rings){ring.forEach(([x,y],i)=>{const u=(x-(l+r)/2)*scale,v=((t+b)/2-y)*scale;if(i===0)path.moveTo(u,v);else path.lineTo(u,v);});path.currentPath.closePath();}
 const shapes=path.toShapes(false),ink=new T.MeshStandardMaterial({name:'V33_authentic_MCV_ink',color:0x18334b,roughness:.7,metalness:.05,side:T.DoubleSide});
 for(const s of [-1,1]){const g=new TessellateModifier(.45,7).modify(new T.ShapeGeometry(shapes)),p=g.attributes.position,cx=s===1?-33.04:-2.96;
  for(let i=0;i<p.count;i++){const x=cx+s*p.getX(i),y=14+p.getY(i);p.setXYZ(i,x,y,s*(side(x,y)+.28));}g.computeVertexNormals();const m=new T.Mesh(g,ink);m.name='V33_authentic_Mars_Cats_Voyage_logo';m.userData={source:'assets/mars-cats-voyage-original.png',contourCount:logo.rings.length,side:s};m.castShadow=false;root.add(m);
 }
 const fin=[];exterior.traverse(o=>{if(o.isMesh&&o.name==='Swept_cat_tail')fin.push(o);});
 const finSurface=surfaceFactory(fin,'z'),finRects=[],finKeepouts=[];
 exterior.traverse(o=>{if(!o.isMesh||!['Tail_registry','Tail_access_hatch','Tail_hatch_latch'].includes(o.name))return;
  if(o.name==='Tail_registry'){const bb=new T.Box3().setFromObject(o);finKeepouts.push({x0:bb.min.x-.5,x1:bb.max.x+.5,y0:bb.min.y-.5,y1:bb.max.y+.5});return;}
  const bins=new Map(),p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const key=Math.floor(v.y/8);if(!bins.has(key))bins.set(key,new T.Box3());bins.get(key).expandByPoint(v);}for(const bb of bins.values())finKeepouts.push({x0:bb.min.x-.4,x1:bb.max.x+.4,y0:bb.min.y-.4,y1:bb.max.y+.4});
 });
 for(const q of envelope.fin.filter(q=>q.y>=32&&q.y<=128&&(q.y-32)%16===0)){
  for(let x0=-243;x0<q.b-11;x0+=6){const x1=x0+2.8,y0=q.y+1.25,y1=y0+1.2;
   if(finKeepouts.some(r=>x1>r.x0&&x0<r.x1&&y1>r.y0&&y0<r.y1))continue;
   if(side((x0+x1)/2,(y0+y1)/2)>finSurface((x0+x1)/2,(y0+y1)/2))continue;
   if([finSurface(x0-.15,y0-.15),finSurface(x1+.15,y1+.15),finSurface(x0-.15,y1+.15),finSurface(x1+.15,y0-.15)].every(z=>Number.isFinite(z)&&z>1))finRects.push({x0,x1,y0,y1,floor:q.y,zone:'fin-inspection-platform'});
  }
 }
 for(const m of fin)cutTriangles+=cutWindowApertures(m,finRects);
 addGlazing(root,finRects,finSurface,steel,glass,lining,'V34_fin');
 const pods=[];exterior.traverse(o=>{if(o.isMesh&&o.name==='Sculpted_nacelle_shell')pods.push(o);});
 const podOuter=surfaceFactory(pods,'z'),podInner=surfaceFactory(pods,'z','min');
 for(const r of POD_ENGINE_WINDOWS)for(const [x,y]of [[r.x0-.15,r.y0-.15],[r.x1+.15,r.y1+.15]])if(!Number.isFinite(podOuter(x,y))||!Number.isFinite(podInner(x,y)))throw new Error('Pod window falls outside skin');
 for(const m of pods)cutTriangles+=cutWindowApertures(m,POD_ENGINE_WINDOWS);
 addGlazing(root,POD_ENGINE_WINDOWS,podOuter,steel,glass,lining,'V35_pod_outer');
 addGlazing(root,POD_ENGINE_WINDOWS,podInner,steel,glass,lining,'V35_pod_inner',-1);
 const stats={windowsPerSide:rects.length,totalWindows:(rects.length+finRects.length)*2+POD_ENGINE_WINDOWS.length*4,centralEngineWindows:CENTRAL_ENGINE_WINDOWS.length*2,podWindows:POD_ENGINE_WINDOWS.length*4,finWindows:finRects.length*2,addedWindows:(rects.length+finRects.length)*2+POD_ENGINE_WINDOWS.length*4-1330,zones:Object.fromEntries([...new Set(rects.map(r=>r.zone))].map(zone=>[zone,rects.filter(r=>r.zone===zone).length*2])),deckRange:[6,20],apertureMetres:[3.1,.95],cutTriangleOperations:cutTriangles,logos:2,logoContours:logo.rings.length};root.userData=stats;return {...stats,openings:rects,finOpenings:finRects,podOpenings:POD_ENGINE_WINDOWS};
}
