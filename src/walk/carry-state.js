import {carryItem} from './carry-items.js';
export const CARRY_KEY='leo-carry-v1',BACKPACK_SLOTS=12,STORE_SLOTS=10;
// An absent item is at home. Fixed arrays keep holes and enforce capacity.
export function createCarryState(deskIds,{storage}={}){
 try{storage??=globalThis.localStorage;}catch{}
 let state,available=!!storage;const listeners=[];
 const fresh=()=>({backpack:Array(BACKPACK_SLOTS).fill(null),stores:Object.fromEntries(deskIds.map(id=>[id,Array(STORE_SLOTS).fill(null)]))});
 function reload(){
  state=fresh();let saved;try{saved=JSON.parse(storage?.getItem(CARRY_KEY)||'null');}catch{available=false;}
  const used=[],copy=(target,source)=>target.forEach((_,i)=>{const id=source?.[i];if(typeof id==='string'&&carryItem(id)&&!used.includes(id)){target[i]=id;used.push(id);}});
  copy(state.backpack,saved?.backpack);for(const id of deskIds)copy(state.stores[id],saved?.stores?.[id]);
 }
 function save(){try{if(!storage)throw Error();storage.setItem(CARRY_KEY,JSON.stringify(state));available=true;}catch{available=false;}for(const fn of listeners)fn();return {ok:true,saved:available};}
 const slots=id=>id==='backpack'?state.backpack:state.stores[id];
 const location=id=>state.backpack.includes(id)?'backpack':deskIds.find(d=>state.stores[d].includes(id))||'home';
 reload();
 return {
  snapshot:()=>structuredClone(state),location,get saved(){return available;},
  pickup(id){if(!carryItem(id)||location(id)!=='home')return {ok:false,message:'That item has already been picked up.'};const i=state.backpack.indexOf(null);if(i<0)return {ok:false,message:'Backpack full.'};state.backpack[i]=id;return save();},
  move(from,index,to){const a=slots(from),b=slots(to);if(!a||!b||a===b||!a[index])return {ok:false,message:'Choose an item.'};const i=b.indexOf(null);if(i<0)return {ok:false,message:to==='backpack'?'Backpack full.':'Desk storage full.'};b[i]=a[index];a[index]=null;return save();},
  home(index){if(!state.backpack[index])return {ok:false,message:'Choose an item.'};state.backpack[index]=null;return save();},
  reload(){reload();for(const fn of listeners)fn();},subscribe(fn){listeners.push(fn);},
 };
}
