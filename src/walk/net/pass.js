// Leo passes: who a visitor is, said by The Creamery (creamery.marscatsvoyage.com), which already knows each member's
// Discord account and verified wallets. A pass is a compact JWS (EdDSA / Ed25519) that lives ten minutes:
//   header  {alg:"EdDSA", kid, typ:"JWT"}
//   claims  {iss, aud:"leo.marscatsvoyage.com", sub:"discord:<id>", discord:{id, username, global_name, avatar},
//            wallets:[0x...], iat, exp, jti}
// The page gets one from Creamery (net/connect.js) and hands it to Leo live in its hello; the server checks it here
// against Creamery's published public keys. The page itself only reads it, it never trusts it.
const decoder=new TextDecoder();
const b64=s=>{const t=s.replace(/-/g,'+').replace(/_/g,'/');const bin=atob(t+'='.repeat((4-t.length%4)%4));return Uint8Array.from(bin,c=>c.charCodeAt(0));};
const json=s=>JSON.parse(decoder.decode(b64(s)));

// The claims, unchecked: for the page to show a name and know when the pass runs out. Null if it does not parse.
export function readPass(token){
 try{const [h,p,s]=String(token).split('.');if(!h||!p||!s)return null;const claims=json(p);return claims&&typeof claims==='object'?claims:null;}catch{return null;}
}

// Creamery's public keys, fetched and kept for an hour; fetched again early when a pass names a key not seen yet
// (at most once a minute, so a stream of made-up key ids costs nothing).
export function keySet(url,{ttl=3600e3,retry=60e3,fetcher=globalThis.fetch}={}){
 let keys=new Map(),at=0,tried=0,loading=null;
 async function load(){
  const res=await fetcher(url,{headers:{accept:'application/json'}});if(!res.ok)throw new Error(`keys ${res.status}`);
  const body=await res.json(),next=new Map();
  for(const k of body.keys||[])if(k&&k.kty==='OKP'&&k.crv==='Ed25519'&&typeof k.x==='string'&&k.kid&&(!k.alg||k.alg==='EdDSA')&&!k.d){
   try{next.set(k.kid,await crypto.subtle.importKey('jwk',{kty:'OKP',crv:'Ed25519',x:k.x},'Ed25519',false,['verify']));}catch{}
  }
  keys=next;at=Date.now();
 }
 return async kid=>{
  const now=Date.now();
  if(!at||now-at>ttl||(!keys.has(kid)&&now-tried>retry)){tried=now;loading??=load().finally(()=>{loading=null;});try{await loading;}catch{}}
  return keys.get(kid)||null;
 };
}

// The visitor a pass vouches for, or null: signature by one of Creamery's keys, EdDSA only, the right issuer and
// audience, not expired (a minute's grace for clocks), not issued in the future, and a Discord id that matches sub.
export async function verifyPass(token,{key,iss,aud,now=Date.now()/1000,leeway=60}){
 if(typeof token!=='string'||token.length>4096)return null;
 const parts=token.split('.');if(parts.length!==3)return null;
 let header,claims;try{header=json(parts[0]);claims=json(parts[1]);}catch{return null;}
 if(!header||header.alg!=='EdDSA'||typeof header.kid!=='string'||header.crit)return null;
 const k=await key(header.kid);if(!k)return null;
 let ok=false;try{ok=await crypto.subtle.verify('Ed25519',k,b64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));}catch{return null;}
 if(!ok||!claims||claims.iss!==iss||(Array.isArray(claims.aud)?!claims.aud.includes(aud):claims.aud!==aud))return null;
 if(typeof claims.exp!=='number'||claims.exp+leeway<now||typeof claims.iat!=='number'||claims.iat-leeway>now)return null;
 const d=claims.discord;
 if(!d||typeof d.id!=='string'||!/^\d{5,25}$/.test(d.id)||claims.sub!=='discord:'+d.id)return null;
 const wallets=Array.isArray(claims.wallets)?claims.wallets.filter(w=>typeof w==='string'&&/^0x[0-9a-f]{40}$/.test(w)).slice(0,32):[];
 const name=[d.global_name,d.username].find(n=>typeof n==='string'&&n.trim())||null;
 return {discordId:d.id,username:typeof d.username==='string'?d.username:null,name,avatar:typeof d.avatar==='string'?d.avatar:null,wallets,exp:claims.exp,jti:claims.jti??null};
}
