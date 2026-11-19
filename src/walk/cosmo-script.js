// Cosmo's own script (the cat figure, its emotes and the kit the walk's crew are dressed from), loaded once for the
// walk and for the arrival hall walked before it (src/v2/arrival-preview.js), whichever asks first.
let loading=null;
export function loadCosmoScript(T){
 return loading??=new Promise((resolve,reject)=>{globalThis.LEO_THREE=T;globalThis.LEO_COSMO_EMOTES=__EMOTES_URL__;
  const s=Object.assign(document.createElement('script'),{src:__COSMO_SCRIPT__,async:true});s.onload=resolve;s.onerror=()=>{loading=null;reject(new Error('Cosmo could not load'));};document.head.appendChild(s);});
}
