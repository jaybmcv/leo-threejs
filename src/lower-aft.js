import * as T from 'three';
import {serviceKit,SERVICE_M as M} from './neighborhood-services.js';
import {finishShipArea,detailKit,FINISH_M as F} from './area-finish.js';
export const LOWER_AFT_AREAS=[
 {deck:1,kind:'stores',id:'d01-spares-aft',name:'Aft spares & bulk stores',start:-198,depth:30,description:'Secured replacement parts, reusable supply cases and an inventory packing station, set forward of the rising tail floor.'},
 {deck:2,kind:'workshop',id:'d02-maintenance-aft',name:'Aft maintenance workshop',start:-214,depth:36,description:'Repair benches, tool boards, equipment cradles and a clear handling aisle for servicing removable ship equipment.'},
 {deck:3,kind:'control',id:'d03-inspection-aft',name:'Engineering support & inspection',start:-225,depth:38,description:'Diagnostic stations, inspection benches and equipment cabinets supporting the aft engineering spaces above.'},
].map(a=>({...a,lowerAft:true,special:true,category:'Lower aft services',center:[(a.start-154)/2,-39.7+(a.deck-1)*4,0],width:-154-a.start,height:3.5,entryX:-154}));
export function createLowerAftArea(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area,units:'metres',stage:'Fitted lower aft concept'};
 const {fit,shell,box,text}=serviceKit(root,area.center),w=area.width,d=area.depth;
 box('Finished_floor',[w,.02,d],[0,-.01,0],M.floor);
 box('Ceiling',[w,.1,d],[0,3.4,0],M.wall,shell);
 box('Aft_bulkhead',[.16,3.4,d],[-w/2+.08,1.7,0],M.wall,shell);
 for(const s of [-1,1]){
  box('Side_wall',[w,3.4,.16],[0,1.7,s*(d/2-.08)],M.wall,shell);
  box('Entry_wall',[.16,3.4,d/2-3],[w/2-.08,1.7,s*(d/4+1.5)],M.wall,shell);
  box('Aisle_inlay',[w-2,.012,.055],[0,.008,s*2.7],M.amber);
 }
 box('Entry_header',[.16,.7,6],[w/2-.08,3.05,0],M.blue,shell);
 text(area.name.toUpperCase(),[-w/2+.2,2.5,0],Math.PI/2,.28);
 for(let x=-w/2+5;x<w/2;x+=8)for(const z of [-d/2+4,0,d/2-4])box('Ceiling_light',[4,.04,.2],[x,3.27,z],M.light,shell);
 for(let x=-w/2+6;x<w/2-5;x+=10)for(const s of [-1,1]){
  const z=s*(d/2-5);
  if(area.deck===1){
   for(const dx of [-2.6,2.6])for(const dz of [-.8,.8])box('Rack_post',[.1,2.7,.1],[x+dx,1.35,z+dz],M.metal);
   [.2,1.05,1.9].forEach((y,j)=>{box('Shelf',[5.4,.1,1.8],[x,y,z],M.metal);for(let i=0;i<5;i++){const h=[.6,.48,.55,.6,.5][(i+j*2+x)&3],part=(i+j+x)%7===0;box('Supply_crate',[.85,h,part?1.1:1.4],[x-2.1+i*1.05,y+.05+h/2,z],part?M.blue:M.amber);}});
  }else{
   box('Worktop',[6,.12,1.6],[x,.86,z],M.metal);
   for(const dx of [-2.4,2.4])box('Bench_support',[.15,.8,1.4],[x+dx,.4,z],M.dark);
   if(area.deck===2){box('Tool_board',[5,1,.12],[x,1.65,z+s*.7],M.metal);for(const dx of [-1.5,0,1.5])box('Tool',[.5,.18,.3],[x+dx,1.02,z],M.blue);}
   else{box('Display',[1.4,.65,.08],[x,1.3,z],M.dark);box('Test_equipment',[1,.4,.6],[x+2,1.12,z],M.blue);}
  }
 }
 if(area.deck===1){
  // Palletised floor stacks sit in the gaps between racks, clear of the
  // central and cross aisles. One loose pair waits by the packing station.
  [-11,-1,9].forEach((x,i)=>{for(const s of [-1,1]){
   const z=s*10,top=(i+(s>0))%2;for(const dx of [-1.1,0,1.1])box('Pallet_runner',[.12,.1,1.5],[x+dx,.05,z],M.wood);box('Pallet_deck',[2.4,.04,1.6],[x,.12,z],M.wood);
   for(const dx of [-.6,.6])box('Supply_crate',[1.1,.7,1.4],[x+dx,.49,z],M.amber);
   box('Supply_crate',[1,.5,1.2],[x+(top?.6:-.6),1.09,z],top?M.blue:M.amber);
  }});
  box('Supply_crate',[.9,.6,.9],[15.2,.3,5.4],M.amber);box('Supply_crate',[.7,.45,.7],[15.2,.825,5.4],M.blue);
  // Lid seams, tie-down straps and hand slots, batched into a few meshes.
  const k=detailKit(fit,area.name+' crates'),crates=[];fit.traverse(o=>{if(o.name==='Supply_crate')crates.push(o);});
  for(const o of crates){
   const {b,c,s}=k.bounds(o);k.box(o,[s.x+.012,.025,s.z+.012],[c.x,b.max.y-.07,c.z],F.dark,'crate_detail');
   for(const v of [-.3,.3])k.box(o,[.045,s.y+.01,s.z+.016],[c.x+v*s.x,c.y,c.z],F.steel,'crate_detail');
   for(const e of [-1,1])k.box(o,[s.x*.28,.05,.008],[c.x,c.y+s.y*.18,c.z+e*(s.z/2+.006)],F.dark,'crate_detail');
  }
  k.finish();
  box('Worktop',[5,.12,1.6],[w/2-10,.86,5],M.wood);for(const dx of [-2,2])box('Bench_support',[.15,.8,1.3],[w/2-10+dx,.4,5],M.metal);}
 if(area.deck===2)for(const s of [-1,1]){box('Equipment_cradle',[5,.3,2],[0,.15,s*6],M.dark);box('Removable_equipment',[3,.9,1.5],[0,.75,s*6],M.blue);}
 if(area.deck===3)for(const s of [-1,1]){box('Equipment_cabinet',[2,2.5,1.2],[-w/2+5,1.25,s*7],M.metal);box('Status_display',[.8,.4,.04],[-w/2+5,1.8,s*7+.63],M.dark);}
 finishShipArea(area,{root,fit,shell});
 // A short enclosed approach joins the existing spine at x=-148. It is
 // owned by this room so no second circulation group overlaps the spine.
 box('Aft_link_floor',[6,.02,6],[w/2+3,-.01,0],M.floor);
 box('Aft_link_ceiling',[6,.1,6],[w/2+3,3.4,0],M.wall,shell);
 for(const s of [-1,1])box('Aft_link_wall',[6,3.4,.16],[w/2+3,1.7,s*3.08],M.wall,shell);
 const [x,y]=area.center;
 return {root,fit,shell,overview:{position:[x+55,y+62,65],target:[x,y,0]},inside:{position:[-153,y+1.7,0],target:[x-12,y+1.4,0]}};
}


