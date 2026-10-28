import * as T from 'three';
import layout from 'v2-layout';
import {signPlace} from '../plan/signs-v2.js';
export const wingName=s=>(s.side<0?'Port':'Starboard')+' '+(['Aster','Birch','Cedar','Dogwood','Elm'][[-104,-58,-12,34,80].indexOf(s.wing)]||'transit')+' wing';
export function v2Signs(parent){
 for(const s of [...layout.circulation.stairs,...layout.circulation.lifts]){const place=signPlace(layout,s),label=s.wing===undefined?'Forward / aft transit':wingName(s)+' · decks 6–15';
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#162d3b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f7d39c';ctx.font='bold 32px sans-serif';ctx.fillText('DECK '+s.deck+' · '+(s.kind==='lift'?'LIFT':'STAIRS'),20,52);ctx.font='23px sans-serif';ctx.fillText(label,20,94);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const geometry=new T.PlaneGeometry(place.width,place.width/4);
  if(place.faces===1){const o=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));o.name='V2_wayfinding';o.userData.label=label;o.position.set(...place.at);parent.add(o);continue;}
  // Hung across a wing corridor: a face each way, since one double-sided plane reads mirrored from behind.
  const material=new T.MeshBasicMaterial({map:texture}),o=new T.Group();o.name='V2_wayfinding';o.userData.label=label;o.position.set(...place.at);o.rotation.y=place.yaw;
  for(const turn of [0,Math.PI]){const f=new T.Mesh(geometry,material);f.name='V2_wayfinding_face';f.rotation.y=turn;f.position.z=turn?-.01:.01;o.add(f);}
  parent.add(o);
 }
}
