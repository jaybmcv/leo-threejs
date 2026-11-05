import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';

// Run the real deployment dry-run entry serially; never publish or launch a
// browser. Source edits are temporary and concurrent edits are not overwritten.
const cases=(process.argv.find(a=>a.startsWith('--cases='))?.slice(8)||'walk,one,two,three,twenty,kit,legacy,wall,selfie,paintings,restored').split(',');
const prefix=process.argv.find(a=>a.startsWith('--prefix='))?.slice(9)||'round2';assert(/^[a-z0-9-]+$/.test(prefix));
const kitColour=process.argv.find(a=>a.startsWith('--kit-color='))?.slice(12)||'b99670';assert(/^[a-f0-9]{6}$/i.test(kitColour));
const files=['src/plan/room-fitout-overrides-v2.json','src/v2/phase4-mesh-kit.js','src/areas.js','src/v2/room-shell.js'],selfie=['','.authoring','.prepared','.public'].map(s=>'src/walk/selfie'+s+'.js'),paintings=['','.authoring','.prepared','.public'].map(s=>'src/walk/paintings'+s+'.js');files.push(...selfie,...paintings);
const originals=new Map(await Promise.all(files.map(async file=>[file,await fs.readFile(file,'utf8')]))),written=new Map(),results=[];
const write=async(file,text)=>{await fs.writeFile(file,text);written.set(file,text);};
const restore=async()=>{for(const [file,last]of written){assert.equal(await fs.readFile(file,'utf8'),last,'Concurrent source edit: '+file);await fs.writeFile(file,originals.get(file));}written.clear();};
const panel=width=>({add:[{part:'interior_wall',size:[width,2.2,.12],at:[0,1.1,4],mat:'cream'}]});
await fs.mkdir('output/fast-deploy',{recursive:true});
const health=JSON.parse(await fs.readFile('src/plan/live-protocol-baseline-v2.json'));await fs.writeFile('output/fast-deploy/round2-health-fixture.json',JSON.stringify({layoutIdentity:health.layoutIdentity}));
try{
 for(const name of cases){
  await restore();
  if(['one','two','three','twenty'].includes(name)){
   const data=JSON.parse(originals.get(files[0]));data['d01-new-2']=panel(1.5);if(name!=='one')data['d05-new-4']=panel(1.4);if(['three','twenty'].includes(name))data['d03-new-3']=panel(name==='twenty'?1.8:1.6);await write(files[0],JSON.stringify(data,null,2)+'\n');
  }
  if(name==='delete'){const data=JSON.parse(originals.get(files[0]));data['d01-new-2']={remove:[{part:'seat_cushion'}],rests:[]};await write(files[0],JSON.stringify(data,null,2)+'\n');}
  if(name==='kit')await write(files[1],originals.get(files[1]).replace('oak:0xb9966f','oak:0x'+kitColour));
  if(name==='legacy')await write(files[2],originals.get(files[2]).replace('return anchorArea(buildcreateShipArea(area),area.id);',`const part=buildcreateShipArea(area);if(area.id==='d02-security-2'){const old=[];part.root.traverse(o=>{if(o.name==='Tray_conveyor')old.push(o);});for(const o of old)o.removeFromParent();const mesh=new T.Mesh(new T.BoxGeometry(1,1.1,1.2),new T.MeshStandardMaterial({color:0x718a94}));mesh.name='Round2_replacement_scanner';mesh.position.set(0,.55,3);part.root.add(mesh);}return anchorArea(part,area.id);`));
  if(name==='wall'){const text=originals.get(files[3]),at=text.indexOf('\n}',text.indexOf('export function buildRoomShell'));assert(at>0);await write(files[3],text.slice(0,at)+`\n if(r.id==='d04-thermal-3'){const wall=g.children.find(o=>o.isMesh&&/wall/i.test(o.name));wall.geometry=wall.geometry.clone();wall.geometry.translate(.2,0,0);}`+text.slice(at));}
  // The dressing lane: a bigger camera body on the selfie booth, in all four variants as an author would write it.
  if(name==='selfie')for(const file of selfie){const text=originals.get(file);assert.equal(text.split("box('Selfie_camera',[.22,").length,2);await write(file,text.replace("box('Selfie_camera',[.22,","box('Selfie_camera',[.26,"));}
  // A template-only dressing: deeper painting frames.
  if(name==='paintings')for(const file of paintings){const text=originals.get(file);assert.equal(text.split('FRAME={width:.14,depth:.08}').length,2);await write(file,text.replace('FRAME={width:.14,depth:.08}','FRAME={width:.14,depth:.1}'));}
  const tag=prefix+'-'+name,log='output/fast-deploy/'+tag+'.log',fd=openSync(log,'w'),start=performance.now();let child;
  try{child=spawnSync(process.execPath,[path.resolve('../feedback-inbox-fastdeploy/automation/deploy-leo.mjs'),'work','--dry-run',...(!process.argv.includes('--with-browser')?['--skip-browser']:[]),'--dir='+process.cwd(),'--tag='+tag,'--health-file='+path.resolve('output/fast-deploy/round2-health-fixture.json')],{stdio:['ignore',fd,fd],windowsHide:true,env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_NO_AUTHORING:'1'}});}finally{closeSync(fd);}
  const result={name,exitCode:child.status,seconds:(performance.now()-start)/1000,log};results.push(result);console.log(JSON.stringify(result));
  await fs.writeFile('output/fast-deploy/'+prefix+'-local-measurements.json',JSON.stringify(results,null,2));
  if(child.status!==0&&!['legacy','wall'].includes(name))throw Error('Dry run failed: '+name+'; see '+log);
  if(process.argv.includes('--verify')&&name==='three')for(const script of ['scripts/check-fast-patch-preservation.mjs','scripts/check-fast-fitout-equivalence.mjs']){const result=spawnSync(process.execPath,[script],{stdio:'inherit',windowsHide:true,env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_TAG:tag}});assert.equal(result.status,0,'Targeted comparison failed: '+script);}
  if(process.argv.includes('--verify')&&['selfie','paintings'].includes(name)){const result=spawnSync(process.execPath,['scripts/check-fast-dressing-v2.mjs','--patch'],{stdio:'inherit',windowsHide:true,env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_TAG:tag}});assert.equal(result.status,0,'Targeted comparison failed: check-fast-dressing-v2.mjs --patch');}
 }
}finally{await restore();}
