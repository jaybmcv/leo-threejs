import {readPass,REMEMBER_S} from './pass.js';

// Connecting Discord on the walk page, through The Creamery (creamery.marscatsvoyage.com), which already holds each
// member's Discord account and verified wallets and hands Leo a signed, ten-minute pass (pass.js) saying who they are:
//   GET  <creamery>/api/leo/pass      with this browser's Creamery cookie: {pass} when signed in there, 401 when not
//   GET  <creamery>/leo/connect?return=<this page>   Discord sign-in at Creamery, then back here with #leo-pass=<pass>
//                                     (or #leo-pass-error=cancelled|failed); the query string, ?invite= with it, is kept
// The pass is only read here, for the name and its expiry; Leo live checks it. The last one is kept in this browser,
// so when Creamery no longer recognises the visitor (its own sign-in ran out) they are still remembered for 30 days
// after it (REMEMBER_S): Leo live takes it for their name, scores and hearts, but not for a giveaway claim.
export const CREAMERY=(()=>{
 // A local Creamery for development, from a page on localhost only.
 const asked=new URLSearchParams(location.search).get('creamery');
 if(asked&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(asked))return asked;
 return typeof __CREAMERY_URL__!=='undefined'?__CREAMERY_URL__:'https://creamery.marscatsvoyage.com';
})();
const KEPT='leo-pass';
const local={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch{}}};

// The invite code this page was opened with, if any: a tester's invite (feedback/feedback.js reads the same code, and
// takes it out of the address once the page is up; it is read here first).
export const invite=(()=>{const c=new URLSearchParams(location.search).get('invite');return c&&/^[A-Za-z0-9_-]{3,40}$/.test(c)?c:null;})();

// What came back from Creamery in the address, taken out of it at once (a pass is not something to bookmark or share).
function fromAddress(){
 const h=new URLSearchParams(location.hash.slice(1)),pass=h.get('leo-pass'),error=h.get('leo-pass-error');
 if(pass||error)history.replaceState(null,'',location.pathname+location.search);
 return {pass,error:error?(error==='cancelled'?'cancelled':'failed'):null};
}
const fresh=(pass,margin=60)=>{const c=readPass(pass);return c&&typeof c.exp==='number'&&c.exp-margin>Date.now()/1000?c:null;};
const remembered=pass=>{const c=readPass(pass);return c&&typeof c.exp==='number'&&c.exp+REMEMBER_S>Date.now()/1000?c:null;};
const nameOf=claims=>claims?.discord?.global_name||claims?.discord?.username||null;

// A pass Creamery gives without asking anything: the visitor is already signed in there.
async function silent(){
 try{
  // The login card waits on this: a Creamery that doesn't answer mustn't hold anyone up.
  const res=await fetch(CREAMERY+'/api/leo/pass',{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!res.ok)return null;const body=await res.json();return typeof body.pass==='string'?body.pass:null;
 }catch{return null;}
}

// {pass, claims, name, remembered, error} for this page as it opens: a pass just brought back, a fresh one kept from
// earlier, or one Creamery hands over silently; failing those, the one this browser kept while it is remembered
// (remembered:true); otherwise none (and why, if Discord sign-in was just cancelled or failed).
export async function identify(){
 const back=fromAddress(),kept=local.get(KEPT);
 let pass=back.pass&&fresh(back.pass)?back.pass:kept&&fresh(kept)?kept:null;
 if(!pass&&!back.error){const got=await silent();if(got&&fresh(got))pass=got;}
 const old=!pass&&kept&&remembered(kept)?kept:null;
 local.set(KEPT,pass||old);
 const claims=readPass(pass||old);
 return {pass:pass||old,claims,name:nameOf(claims),remembered:!!old,error:back.error};
}
// A fresh pass: the one we hold while it has a couple of minutes left (margin, in seconds), else a new one from
// Creamery, or null when Creamery gives none (the one we held stays kept).
export async function currentPass(margin=120){
 const kept=local.get(KEPT);if(kept&&fresh(kept,margin))return kept;
 const pass=await silent();if(!pass||!fresh(pass))return null;
 local.set(KEPT,pass);return pass;
}
// The pass to hand Leo live or send with a report: a fresh one, or else the one this browser kept while it is
// remembered (Leo live and the feedback capture service take it, marked lapsed), or null.
export async function bestPass(){
 const pass=await currentPass();if(pass)return pass;
 const kept=local.get(KEPT);return kept&&remembered(kept)?kept:null;
}
// Off to Creamery to connect Discord, and back to this very page (its ?invite= too).
export const connectUrl=()=>`${CREAMERY}/leo/connect?return=${encodeURIComponent(location.origin+location.pathname+location.search)}`;
export function connect(){location.assign(connectUrl());}
// "Not you?", or a pass Leo live refused: forget the pass in this browser (Creamery's own sign-in is Creamery's).
export function forget(){local.set(KEPT,null);}
