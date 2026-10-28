import {writeV2DeckCosts} from './v2-deck-costs.mjs';
import {indexedV2Export} from './v2-indexed-export.mjs';
import {shareExportGeometry} from './v2-export.mjs';
import fs from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import * as T from 'three';
import {preparedV2} from './v2-world.mjs';
import layout from 'v2-layout';
const out='output/leo-interior-v02';const {ship,prepared,plan,image}=await preparedV2({map:true});
for(const item of Object.values(prepared))if(item?.group&&!item.group.parent)ship.inside.add(item.group);
plan.bayAccesses=layout.bayAccesses;plan.windows=layout.windows;plan.shells=layout.rooms.filter(r=>!r.aggregate).map(r=>({id:r.id,deck:r.deck,polygon:r.polygon,door:r.door,fittingDoor:r.fittingDoor}));await fs.writeFile(out+'/walk-plan.json',JSON.stringify(plan));await fs.writeFile(out+'/walk-map.png',image);
const {createCanvas,ImageData}=await import('@napi-rs/canvas');globalThis.ImageData=ImageData;globalThis.HTMLCanvasElement=createCanvas(1,1).constructor;globalThis.document={createElement(){const c=createCanvas(1,1);c.toBlob=(cb,type='image/png')=>cb(new Blob([c.toBuffer(type)],{type}));return c;}};
const exporter=new GLTFExporter();
const structure=ship.inside.getObjectByName('V2_structure').children,rooms=new Map(layout.rooms.map(r=>[r.id,r])),serviceRoots=[...ship.serviceDecks.values()].flat().filter(r=>r.root.parent).map(r=>r.root);
const groups=[['leo-residential-decks',[...ship.decks.filter(d=>d.userData.residential),...structure.filter(o=>o.userData.v2Deck>=6&&o.userData.v2Deck<=15)]],['leo-garden-commons',[ship.shared,...structure.filter(o=>o.userData.envelopeKind==='garden'||rooms.get(o.userData.room)?.kind==='garden')]],['leo-service-areas',[...serviceRoots,...structure.filter(o=>rooms.has(o.userData.room)&&rooms.get(o.userData.room).kind!=='garden'||!o.userData.room&&o.userData.envelopeKind!=='garden'&&(o.userData.v2Deck<=5||o.userData.v2Deck>=16))]],['leo-aft-systems',[ship.ensureAft().root,...structure.filter(o=>o.name==='V2_fin_guard')]],['leo-transit',[ship.ensureTransit().root,...structure.filter(o=>/^(V2_tower|Stair_tread|V2_wing_stair)/.test(o.name))]],['leo-neighborhood',[ship.decks[14],...structure.filter(o=>o.userData.v2Deck===15)]],['leo-full-ship',[ship.root]]];
for(const [name,parts] of groups){const root=new T.Group();root.name=name+'_v2';root.userData={layoutVersion:2,component:name,shipCabins:layout.summary.cabins,shipBerths:layout.summary.berths,...(name==='leo-neighborhood'?{cabins:layout.summary.perDeck[14].cabins,berths:layout.summary.perDeck[14].berths}:name==='leo-residential-decks'||name==='leo-full-ship'?{cabins:layout.summary.cabins,berths:layout.summary.berths}:{})};for(const part of parts)root.add(part.clone(true));const sharing=shareExportGeometry(root);console.log(name,sharing);const bytes=await indexedV2Export(await exporter.parseAsync(root,{binary:true,onlyVisible:true}));await fs.writeFile(out+'/'+name+'.glb',Buffer.from(bytes));console.log(name,(bytes.byteLength/1048576).toFixed(2)+' MB');}
await fs.writeFile(out+'/assembly-manifest.json',JSON.stringify({layoutVersion:2,...layout.summary,scope:'All hull envelopes, shared exterior windows, furnished cabins and guarded circulation',hullEnvelopes:layout.hullPrototypes.prototypes.length},null,2));

await writeV2DeckCosts(ship,layout);
