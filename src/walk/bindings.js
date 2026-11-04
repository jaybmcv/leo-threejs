// Only emotes and the existing live ping are remappable. Other walk keys keep their jobs.
export const DEFAULT_BINDINGS=Object.freeze({emotes:'KeyB',ping:'KeyP',...Object.fromEntries(Array.from({length:10},(_,i)=>['emote:'+i,'Digit'+(i+1)%10]))});
export const BINDINGS_KEY='leo-walk-bindings-v1';
const fixed={KeyW:'Walk',KeyA:'Walk',KeyS:'Walk',KeyD:'Walk',ArrowUp:'Walk',ArrowDown:'Walk',ArrowLeft:'Walk',ArrowRight:'Walk',Space:'Jump',ShiftLeft:'Run',ShiftRight:'Run',Enter:'Use',Escape:'Close panels',Tab:'Keyboard navigation',KeyC:'Crouch',KeyX:'Lie flat',KeyE:'Use',KeyV:'View',KeyF:'View',KeyM:'Go to',KeyN:'Ship map',KeyR:'Respawn',KeyL:'Ship log',KeyH:'Help',KeyT:'Chat',Mouse0:'Drag to look'};
export function bindingLabel(code){
 if(!code)return 'Unbound';
 return ({Mouse0:'Mouse left',Mouse1:'Mouse middle',Mouse2:'Mouse right',Mouse3:'Mouse back',Mouse4:'Mouse forward',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Minus:'-',Equal:'=',Backquote:'`'})[code]||code.replace(/^Key|^Digit/,'');
}
export function bindingProblem(code){
 if(code===null)return '';
 if(fixed[code])return bindingLabel(code)+' is used for '+fixed[code]+'.';
 // No modifier chords, function keys or browser/system keys are captured.
 return /^(Key[A-Z]|Digit[0-9]|Mouse[1-4]|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Minus|Equal|Backquote)$/.test(code)?'':'Choose a plain letter, number, punctuation key or mouse button. Browser shortcuts stay reserved.';
}
export function createWalkBindings(storage){
 let values={...DEFAULT_BINDINGS};const listeners=[];
 try{
  storage??=globalThis.localStorage;
  const saved=JSON.parse(storage?.getItem(BINDINGS_KEY)||'null');
  if(saved&&Object.keys(DEFAULT_BINDINGS).every(id=>Object.hasOwn(saved,id)&&!bindingProblem(saved[id]))){
   const used=Object.values(saved).filter(v=>v!==null);
   if(new Set(used).size===used.length)values=Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(id=>[id,saved[id]]));
  }
 }catch{}
 function save(){
  let saved=true;try{if(!storage)throw Error();storage.setItem(BINDINGS_KEY,JSON.stringify(values));}catch{saved=false;}
  for(const fn of listeners)fn();return {ok:true,saved};
 }
 return {
  get:id=>values[id],action:code=>Object.keys(values).find(id=>values[id]===code),
  set(id,code){
   if(!Object.hasOwn(values,id))return {ok:false,error:'Unknown action.'};
   const error=bindingProblem(code);if(error)return {ok:false,error};
   const conflict=code===null?null:Object.keys(values).find(other=>other!==id&&values[other]===code);
   if(conflict)return {ok:false,conflict,error:bindingLabel(code)+' is already assigned. Clear that action first.'};
   values[id]=code;return save();
  },
  reset(){values={...DEFAULT_BINDINGS};return save();},
  subscribe(fn){listeners.push(fn);return ()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};},
 };
}
export const walkBindings=createWalkBindings();
