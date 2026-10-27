import * as T from 'three';
import layout from 'v2-layout';
export const wingName=s=>(s.side<0?'Port':'Starboard')+' '+(['Aster','Birch','Cedar','Dogwood','Elm'][[-104,-58,-12,34,80].indexOf(s.wing)]||'transit')+' wing';
export function v2Signs(parent){
 for(const s of [...layout.circulation.stairs,...layout.circulation.lifts]){const d=layout.decks[s.deck-1],p=s.polygon,x=p.reduce((v,p)=>v+p[0],0)/p.length,z=p.reduce((v,p)=>v+p[1],0)/p.length;
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#162d3b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f7d39c';ctx.font='bold 32px sans-serif';ctx.fillText('DECK '+s.deck+' · '+(s.kind==='lift'?'LIFT':'STAIRS'),20,52);ctx.font='23px sans-serif';ctx.fillText(s.wing===undefined?'Forward / aft transit':wingName(s)+' · decks 6–15',20,94);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const o=new T.Mesh(new T.PlaneGeometry(2.5,.625),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));o.name='V2_wayfinding';o.userData.label=s.wing===undefined?'Forward / aft transit':wingName(s)+' · decks 6–15';o.position.set(x,d.y+2.6,z+3.5);parent.add(o);
 }
}
