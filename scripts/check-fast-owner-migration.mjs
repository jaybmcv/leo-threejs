import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {openSync,closeSync,readFileSync,unlinkSync} from 'node:fs';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {roomSignature} from './legacy-room-data-v2.mjs';
import {buildPhase4Fitout} from '../src/v2/phase4-fitout.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {communityDisplayParts} from '../src/v2/community-displays.js';
const reference='de275fcd04ffe2b7be004b1d6f4c4f7a5958709c';
const previous=file=>{const output='output/fast-deploy/.previous-source',fd=openSync(output,'w');let child;try{child=spawnSync('git',['show',reference+':'+file],{stdio:['ignore',fd,'inherit'],windowsHide:true});}finally{closeSync(fd);}assert.equal(child.status,0,'Could not read HEAD:'+file);const text=readFileSync(output,'utf8');unlinkSync(output);return text.replaceAll('\r\n','\n');};
const oldModel=previous('src/v2/model.js'),start=oldModel.indexOf(' for(const r of layout.rooms.filter(r=>!r.aggregate)){'),end=oldModel.indexOf(' const holeBounds=',start),block=oldModel.slice(start,end),body=block.slice(block.indexOf('\n')+1,block.lastIndexOf('\n }'));
const current=(await fs.readFile('src/v2/room-shell.js','utf8')).replaceAll('\r\n','\n');assert(current.includes('export function buildRoomShell(ship,r,structure){\n'+body+'\n}'),'Room shell refactor changed the old producer body');
const oldHull=previous('src/v2/hull-prototypes.js'),h0=oldHull.indexOf(' const facadeParents=',oldHull.indexOf('export function fitPrototypeStructure')),h1=oldHull.indexOf('for(const p of layout.hullPrototypes.prototypes){',h0),hbody=oldHull.slice(h0,h1).replaceAll('ship.inside.traverse','inside.traverse');
assert((await fs.readFile('src/v2/hull-prototypes.js','utf8')).replaceAll('\r\n','\n').includes(hbody+'return occupied;'),'Hull-cut refactor changed the old producer body');
const temporary='src/v2/.fast-owner-original.mjs';
try{
 await fs.writeFile(temporary,previous('src/v2/phase4-fitout.js'));
 const {buildPhase4Fitout:original}=await import('../'+temporary);
 const ids=[...new Set([...phase4Programme(layout).parts,...communityDisplayParts(layout)].map(p=>p.room)),'circulation-2'];
 const signature=builder=>{const ship={inside:new T.Group()},fit=builder(ship,layout,{rooms:ids}),group=new T.Group();for(const root of fit.roots)group.add(root);return roomSignature(group);};
 assert.equal(signature(original),signature(buildPhase4Fitout),'Shared mesh-kit extraction changed default geometry/materials/instances');
 await fs.writeFile('output/fast-deploy/owner-migration-proof.json',JSON.stringify({status:'PASS',reference,roomShellBody:'identical',hullCutBody:'identical',defaultPhase4Meshes:'identical geometry, materials, instance matrices and collision flags',note:'Metadata-only ownership fields do not change geometry. This is not a fresh whole-ship or browser comparison.'},null,2));
 console.log('PASS unchanged room-shell body, hull-cut body and all default fitout mesh output');
}finally{await fs.rm(temporary,{force:true});}
