import {readPass} from './pass.js';

// Connecting Discord on the walk page, through The Creamery (creamery.marscatsvoyage.com), which already holds each
// member's Discord account and verified wallets and hands Leo a signed, ten-minute pass (pass.js) saying who they are:
//   GET  <creamery>/api/leo/pass      with this browser's Creamery cookie: {pass} when signed in there, 401 when not
//   GET  <creamery>/leo/connect?return=<this page>   Discord sign-in at Creamery, then back here with #leo-pass=<pass>
//                                     (or #leo-pass-error=cancelled|failed); the query string, ?invite= with it, is kept
// The pass is only read here, for the name and its expiry; Leo live checks it. It is kept for this tab only.
export const CREAMERY=(()=>{
 // A local Creamery for development, from a page on localhost only.
 const asked=new URLSearchParams(location.search).get('creamery');
 if(asked&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(asked))return asked;
 return typeof __CREAMERY_URL__!=='undefined'?__CREAMERY_URL__:'https://creamery.marscatsvoyage.com';
})();
const KEPT='leo-pass',SKIPPED='leo-connect-skipped',SKIP_DAYS=7;
const session={get(k){try{return sessionStorage.getItem(k);}catch{return null;}},set(k,v){try{v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v);}catch{}}};
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

// A pass Creamery gives without asking anything: the visitor is already signed in there.
async function silent(){
 try{
  const res=await fetch(CREAMERY+'/api/leo/pass',{credentials:'include',cache:'no-store'});
  if(!res.ok)return null;const body=await res.json();return typeof body.pass==='string'?body.pass:null;
 }catch{return null;}
}

// {pass, claims, name, error} for this page as it opens: a pass just brought back, one kept from earlier in this tab,
// or one Creamery hands over silently; otherwise none (and why, if Discord sign-in was just cancelled or failed).
export async function identify(){
 const back=fromAddress();
 let pass=back.pass&&fresh(back.pass)?back.pass:null;
 if(!pass){const kept=session.get(KEPT);if(kept&&fresh(kept))pass=kept;}
 if(!pass&&!back.error)pass=await silent();
 const claims=pass?fresh(pass):null;
 session.set(KEPT,claims?pass:null);
 return {pass:claims?pass:null,claims,name:claims?(claims.discord?.global_name||claims.discord?.username||null):null,error:back.error};
}
// A pass for a (re)connection: the one we hold while it has a couple of minutes left, else a new one from Creamery.
export async function currentPass(){
 const kept=session.get(KEPT);if(kept&&fresh(kept,120))return kept;
 const pass=await silent();session.set(KEPT,pass&&fresh(pass)?pass:null);return pass&&fresh(pass)?pass:null;
}
// Off to Creamery to connect Discord, and back to this very page (its ?invite= too).
export const connectUrl=()=>`${CREAMERY}/leo/connect?return=${encodeURIComponent(location.origin+location.pathname+location.search)}`;
export function connect(){location.assign(connectUrl());}
// "Skip for now": not asked again in this browser for a week.
export const skippedRecently=()=>{const t=Number(local.get(SKIPPED));return t&&Date.now()-t<SKIP_DAYS*864e5;};
export function skip(){local.set(SKIPPED,String(Date.now()));}
// Leave: forget the pass in this tab (Creamery's own sign-in is Creamery's).
export function forget(){session.set(KEPT,null);}
