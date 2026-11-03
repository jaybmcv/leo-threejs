import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Diagnostic only. Every edit is guarded and restored even if a child fails.
const files=['src/areas.js','src/v2/room-shell.js'],original=new Map(await Promise.all(files.map(async file=>[file,await fs.readFile(file,'utf8')]))),written=new Map();
const run=(tag,args=[])=>{const p=spawnSync(process.execPath,['scripts/check-fast-legacy-rooms.mjs','--tag='+tag,...args],{stdio:'inherit',windowsHide:true,env:{...process.env,LEO_LAYOUT:'2'}});assert.equal(p.status,0,'Room measurement failed: '+tag);};
const edit=async(file,source)=>{await fs.writeFile(file,source);written.set(file,source);};
const areaSource=(ids,width=1)=>original.get(files[0]).replace('return anchorArea(buildcreateShipArea(area),area.id);',`const part=buildcreateShipArea(area);
 if(${JSON.stringify(ids)}.includes(area.id)){
  const remove=[];part.root.traverse(o=>{if(o.name==='Tray_conveyor')remove.push(o);});for(const o of remove)o.removeFromParent();
  const mesh=new T.Mesh(new T.BoxGeometry(area.id==='d05-pharmacy-3'?${width}:1,1.1,1.2),new T.MeshStandardMaterial({color:0x718a94}));mesh.name='Round2_replacement_scanner';mesh.position.set(0,.55,3);part.root.add(mesh);
 }
 return anchorArea(part,area.id);`);
try{
 run('seed',['--seed']);
 await edit(files[0],areaSource(['d02-security-2']));run('round2-legacy-replacement');
 await edit(files[0],original.get(files[0]).replace('return anchorArea(buildcreateShipArea(area),area.id);',"const part=buildcreateShipArea(area);if(area.id==='d02-security-2')part.root.clear();return anchorArea(part,area.id);"));run('round2-legacy-deletion',['--deleted']);
 await edit(files[0],original.get(files[0]));
 const shell=original.get(files[1]),at=shell.indexOf('\n}',shell.indexOf('export function buildRoomShell'));
 await edit(files[1],shell.slice(0,at)+`\n if(r.id==='d04-thermal-3'){const wall=g.children.find(o=>o.isMesh&&/wall/i.test(o.name));if(!wall)throw Error('Missing test wall');wall.geometry=wall.geometry.clone();wall.geometry.translate(.2,0,0);}`+shell.slice(at));run('round2-legacy-wall',['--shell']);
 await edit(files[1],shell);
 for(let i=1;i<=3;i++){await edit(files[0],areaSource(['d02-security-2','d04-thermal-3','d05-pharmacy-3'].slice(0,i)));run('round2-day-'+i);}
 // Repeated real source edits: only the third room changes after edit three.
 // These measure the patch stage, not a full public deployment.
 for(let i=4;i<=20;i++){await edit(files[0],areaSource(['d02-security-2','d04-thermal-3','d05-pharmacy-3'],1+i/100));run('round2-day-'+i);}
}finally{
 for(const file of files){if(!written.has(file))continue;const current=await fs.readFile(file,'utf8');assert.equal(current,written.get(file),'Source changed concurrently; refusing to overwrite '+file);await fs.writeFile(file,original.get(file));}
}
