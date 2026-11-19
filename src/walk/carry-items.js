// Features can register another item with one registerCarryItem call.
const items=new Map();
export function registerCarryItem({id,name,icon}){
 if(!id||!name||!icon||items.has(id))throw Error('Invalid carry item '+id);
 const item=Object.freeze({id,name,icon});items.set(id,item);return item;
}
export const carryItem=id=>items.get(id);
export const carryItems=()=>[...items.values()];
const svg=body=>`<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4">${body}</svg>`;
registerCarryItem({id:'yarn',name:'Ball of yarn',icon:svg('<circle cx="23" cy="22" r="16"/><path d="M10 13c20 0 22 15 22 22M8 22c12-9 21-9 27-8M12 32c3-13 10-20 16-25M19 37c-2-9 0-18 4-29M36 31c8 0 8 11 2 11h-6"/>')});
registerCarryItem({id:'ration',name:'Ration tin',icon:svg('<ellipse cx="24" cy="12" rx="15" ry="6"/><path d="M9 12v23c0 8 30 8 30 0V12M9 32c0 8 30 8 30 0M19 11h10M24 19v8M20 23h8"/>')});
