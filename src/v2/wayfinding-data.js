import {contains} from '../plan/geometry-v2.js';
export const sideName=z=>z<0?'Port':'Starboard';
const wingXs=[-104,-58,-12,34,80],wingNames=['Aster','Birch','Cedar','Dogwood','Elm'];
export const wingName=x=>wingNames[wingXs.indexOf(x)]||'Transit';
export const deckTitle=(layout,n)=>layout.decks.find(d=>d.number===n)?.name||'Fin & crown';
export const isCrewGallery=p=>p.deck===20&&(/crew.*gallery|skywalk/i.test(p.name||'')||p.access==='crew');
const roomSpot=r=>{
 if(r.door){const n=r.door.outward,inset=r.id==='d03-kitchen-5'?-1.4:1.4;return {at:[r.door.center[0]-n[0]*inset,r.door.center[1],r.door.center[2]-n[1]*inset],yaw:Math.atan2(-n[0],-n[1])};}
 // Fixed aft rooms have their retained fitting frame and an entry beside the spine.
 const [x,y,z]=r.frame.origin;return {at:[x,y,z-Math.sign(z||1)*(r.depth/2-1.4)],yaw:z<0?Math.PI:0};
};
export function roomPlaces(layout){return [...layout.rooms,...(layout.fixedRooms||[])].filter(r=>!r.aggregate&&!isCrewGallery(r)).map(r=>{
 const house=r.id.includes('-housekeeping-'),tag=house?sideName(r.z)+' '+wingName(Number(r.id.match(/housekeeping-(-?\d+)-/)[1]))+' wing':r.id.startsWith('neighborhood-')?'Neighborhood '+r.id.split('-')[1]:r.kind==='garden'?'Decks 17–19':'';
 return {id:r.id,room:r.id,name:r.name,deck:r.deck,section:house?'Services':'Rooms',detail:'Deck '+r.deck+(tag?' · '+tag:''),...roomSpot(r),lv:2,resolved:true};
});}
export function shuttlePlaces(layout){return layout.shuttles.map(s=>{const c=Math.cos(s.yaw),n=Math.sin(s.yaw),u=-9.5,v=.775;return {id:s.id,room:s.roomId,component:s.id,name:'Escape shuttle '+s.id.split('-').slice(-2).join('').toUpperCase(),deck:s.deck,section:'Escape shuttles',detail:'Deck '+s.deck+' · '+sideName(s.z)+' · 100 seats',at:[s.x+c*u+n*v,s.y+.126,s.z-n*u+c*v],yaw:s.yaw+Math.PI/2,lv:2,resolved:true};});}
export function buildGotoPlaces(layout,features=[]){
 const places=[...roomPlaces(layout),...shuttlePlaces(layout),...features].filter(p=>!isCrewGallery(p));
 const seen=new Set();for(const p of places){if(!p.id||seen.has(p.id))throw Error('Duplicate Go-to id');seen.add(p.id);if(!p.at?.every(Number.isFinite)||!Number.isFinite(p.yaw))throw Error('Invalid Go-to pose '+p.id);}
 return places.sort((a,b)=>(a.deck??21)-(b.deck??21)||a.section.localeCompare(b.section)||a.name.localeCompare(b.name,undefined,{numeric:true})||a.id.localeCompare(b.id));
}
export function groupPlaces(layout,places){return [...layout.decks.map(d=>({id:String(d.number),title:'Deck '+d.number+' · '+d.name,deck:d.number})),{id:'fin',title:'Fin & crown',deck:null}].map(g=>({...g,places:places.filter(p=>(p.deck??null)===g.deck)}));}
export function describeV2(layout,point,{crownFloor=120.3}={}){
 const [x,y,z]=Array.isArray(point)?point:[point.x,point.y,point.z];
 if(y>layout.decks.at(-1).y+3.5)return y>=crownFloor-.3?'Crown lounge':'Fin inspection platforms';
 if(x<-230&&Math.abs(z)<4&&Math.abs(y-layout.decks[16].y)<.3)return 'Deck 17 · Fin lift service gallery';
 const deck=layout.decks.reduce((a,b)=>Math.abs(b.y-y)<Math.abs(a.y-y)?b:a);
 if(deck.number===20&&x>127&&x<138&&Math.abs(z)<18)return 'Deck 20 · Crew service gallery · Crew only';
 const room=[...layout.rooms,...(layout.fixedRooms||[])].find(r=>!r.aggregate&&y>=r.y-.2&&y<r.y+r.height-.2&&contains(r.polygon,[x,z]));
 const shuttle=layout.shuttles.find(s=>Math.abs(s.y-y)<.3&&contains(s.polygon,[x,z]));
 const name=shuttle?'Escape shuttle':room?.name||(deck.number===6&&Math.abs(z)<20&&x>-120&&x<120?'Open atrium':deck.name);
 // The observation floor is raised 2 m above its Deck 17 approach.
 return 'Deck '+(room?.id==='observation-lounge'?room.deck:deck.number)+' · '+name;
}
export function deckDirectory(layout){return layout.decks.map(d=>({deck:d.number,title:'Deck '+d.number+' · '+d.name,highlights:[...new Set(layout.rooms.filter(r=>r.deck===d.number&&!r.aggregate&&!r.id.includes('-housekeeping-')).map(r=>r.name))],crew:d.number===20?'Crew service gallery · Crew only':''}));}
