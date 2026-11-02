import * as T from 'three';
import assert from 'node:assert/strict';
import {auditSkinClearance,isFinishedSkin} from '../src/plan/skin-clearance-v2.js';
// The phone viewer uses its own finished pressure surface. This is not a
// fitting exemption: every hatch vertex/face still passes the same 5 cm test,
// plus the ordinary protected-window tests. Hatches cannot define the oracle.
export function auditWithPhoneHatches(root,webAuthority,layout,options){
 assert(options.skinAuthority,'Actual finished phone authority is required');
 root.updateMatrixWorld(true,true);
 const state=[];root.traverse(o=>{if(o.isMesh&&o.name==='V2_shuttle_hatch_seams'&&o.userData.shuttleHatches&&o.userData.phoneSurface&&!o.userData.interior)state.push({o,parent:o.parent,index:o.parent.children.indexOf(o)});});
 assert.equal(state.length,1,'One actual phone hatch batch is required');
 assert.equal(new Set(state[0].o.userData.hatchIds).size,100,'All 100 phone doors required');
 assert(!isFinishedSkin(state[0].o),'Door hardware must not define its own skin authority');
 const marks=new T.Group();for(const {o}of state)marks.attach(o);
 try{
  const report=auditSkinClearance(root,webAuthority,layout,options);
  const doors=auditSkinClearance(marks,options.skinAuthority,layout,{...options,tag:options.tag+' hatch hardware on finished phone surface',skinAuthority:null});
  report.phoneHatches={status:doors.status,meshes:doors.meshes,vertices:doors.vertices,faceSamples:doors.faceSamples,tolerance:doors.tolerance,policy:'Phone-only closed hatch fittings tested against actual finished phone skin; web and all other mesh rules unchanged; no window-volume exemption.'};
  report.meshes+=doors.meshes;report.vertices+=doors.vertices;report.faceSamples+=doors.faceSamples;report.windowFaces+=doors.windowFaces;
  report.outside.push(...doors.outside);report.blocked.push(...doors.blocked);
  report.status=report.status==='PASS'&&doors.status==='PASS'?'PASS':'FAIL';return report;
 }finally{for(const {o,parent,index}of state){parent.attach(o);parent.children.splice(parent.children.indexOf(o),1);parent.children.splice(index,0,o);}}
}
