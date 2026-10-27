import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {validateBytes} from 'gltf-validator';
import {preparedV2} from './v2-world.mjs';
import {shareExportGeometry} from './v2-export.mjs';
import {cabinKey,template,cabinRestSpots} from '../src/v2/cabins.js';
import {meshTriangles,solid,BODY} from '../src/walk/collision.js';
import {worldPoint,patchDepth,chartPoint} from '../src/plan/hull-skin-v2.js';
import layout from 'v2-layout';
const baseline=process.argv.includes('--baseline')||process.argv.includes('--review-baseline'),out='output/phase3b',tag=process.argv.includes('--review-baseline')?'review-179d813':baseline?'baseline-2b1ff60':'prototype';
const {ship,prepared}=await preparedV2();const {createCanvas,ImageData}=await import('@napi-rs/canvas');globalThis.ImageData=ImageData;globalThis.HTMLCanvasElement=createCanvas(1,1).constructor;globalThis.document={createElement(){const c=createCanvas(1,1);c.toBlob=(cb,type='image/png')=>cb(new Blob([c.toBuffer(type)],{type}));return c;}};
const exp=new GLTFExporter(),metrics=[];ship.root.updateMatrixWorld(true);const visible=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
for(const deck of [10,17,18,19]){const d=layout.decks[deck-1],root=new T.Group();root.name='Phase3b_'+tag+'_deck_'+deck;root.userData={layoutVersion:2,source:process.argv.includes('--review-baseline')?'179d813':baseline?'2b1ff60':'179d813 + prototype',deck,cabins:layout.cabins.filter(c=>c.deck===deck).length};let meshes=0,triangles=0;ship.root.traverse(o=>{if(!o.isMesh||!visible(o))return;const b=new T.Box3().setFromObject(o,true);if(b.max.y<d.y-.2||b.min.y>d.y+3.55)return;const cl=o.clone();cl.matrixAutoUpdate=false;cl.matrix.copy(o.matrixWorld);cl.matrixWorld.copy(o.matrixWorld);root.add(cl);meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
const sharing=shareExportGeometry(root),bytes=await exp.parseAsync(root,{binary:true,onlyVisible:true}),validation=await validateBytes(new Uint8Array(bytes),{maxIssues:50});await fs.writeFile(out+'/'+tag+'-deck-'+deck+'.glb',Buffer.from(bytes));metrics.push({deck,meshes,triangles,bytes:bytes.byteLength,validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,messages:validation.issues.messages.filter(m=>m.severity<2).slice(0,20)},sharing});console.log(tag+' deck '+deck+' '+bytes.byteLength+' bytes');}
const tests=[];if(!baseline){const col=prepared.colliders,ray=new T.Ray(),seg=new T.Line3(),probe=(p,dir,far=10)=>{ray.origin.fromArray(p);ray.direction.fromArray(dir);return col.raycast(ray,far);};
for(const p of layout.hullPrototypes.prototypes){const points=[],floor=[],glass=[],wall=[],sight=[],stands=[],rest=[];let open=0;
 for(let u=p.rect[0]+.5;u<p.rect[1]-.4;u+=p.kind==='garden'?1:.4){const end=patchDepth(p.inner,u,1.7)-.5;for(let v=Math.max(p.fixedV+.7,p.kind==='garden'?end-3:p.fixedV+.7);v<end;v+=.35){const at=worldPoint(p.chart,[u,0,v]);const hit=probe([at[0],at[1]+.03,at[2]],[0,-1,0],.25);if(!hit||Math.abs(hit.point.y-at[1])>.03){floor.push(at);continue;}const a=worldPoint(p.chart,[u,BODY.step+BODY.radius,v]),b=worldPoint(p.chart,[u,BODY.height-BODY.radius,v]);seg.start.fromArray(a);seg.end.fromArray(b);if(!col.overlaps(seg,BODY.radius)){stands.push(at);if(!probe([at[0],at[1]+1,at[2]],[0,1,0],200))open++;}}}
 const window=p.window.rect;for(let u=window[0]+.08;u<=window[1]-.05;u+=Math.max(.2,(window[1]-window[0])/8))for(let y=window[2]+.08;y<window[3]-.05;y+=Math.max(.2,(window[3]-window[2])/5)){const v=patchDepth(p.inner,u,y)-.35,at=worldPoint(p.chart,[u,y,v]),h=probe(at,p.chart.v,2);if(!h)glass.push([u,y]);}
 for(const u of [p.rect[0]+.04,p.rect[1]-.04]){const y=p.kind==='garden'?.06:.4,at=worldPoint(p.chart,[u,y,patchDepth(p.inner,u,y)-.5]);if(!probe(at,p.chart.v,2))wall.push(at);}
 for(const s of prepared.restSpots.filter(s=>s.room===p.id)){const at=s.point.toArray(),h=probe([at[0],at[1]+.25,at[2]],[0,-1,0],.45);rest.push({kind:s.kind,point:at,support:!!h&&Math.abs(h.point.y-at[1])<.12});}
 tests.push({id:p.id,standableSamples:stands.length,floorMisses:floor,glassMisses:glass,wallMisses:wall,openToSpace:open,rest,exampleStanding:stands.at(-1)});
}
}
await fs.writeFile(out+'/'+tag+'-metrics.json',JSON.stringify({tag,metrics,tests,colliderTriangles:prepared.colliders.triangles,exterior:ship.exterior.userData.hullPrototypeStats},null,2));console.log(JSON.stringify({tag,metrics,tests}));
