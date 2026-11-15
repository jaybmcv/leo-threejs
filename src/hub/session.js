// The Builder's Hub's own sign-in (feedback-inbox hub/src/session.js). A Leo pass lasts ten minutes, and a new one only
// comes quietly while The Creamery still recognises this browser, so on its own the Hub asked testers to connect Discord
// again whenever Creamery's sign-in had ended. Once a fresh pass has shown the Hub service who they are, it hands back
// this token, and takes it instead of a pass for 30 days after their last visit (90 at most after Discord vouched).
// It is kept in this browser for this site only, as the pass is (walk/net/connect.js). This page only keeps and sends it,
// and reads when it ends so it doesn't send one that has; the service checks it.
const KEPT='leo-hub-session';
const SHAPE=/^hub1\.([A-Za-z0-9_-]{10,600})\.[A-Za-z0-9_-]{43}$/;

// {sub, name, since, exp} from a token of the right shape that hasn't ended by now (seconds), else null. Read, not trusted.
export function sessionClaims(token,now=Date.now()/1000){
 const m=typeof token==='string'?SHAPE.exec(token):null;if(!m)return null;
 try{
  const t=m[1].replace(/-/g,'+').replace(/_/g,'/'),c=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),ch=>ch.charCodeAt(0))));
  return c&&typeof c.sub==='string'&&typeof c.exp==='number'&&c.exp>now?c:null;
 }catch{return null;}
}
const local={get(){try{return localStorage.getItem(KEPT);}catch{return null;}},set(v){try{v==null?localStorage.removeItem(KEPT):localStorage.setItem(KEPT,v);}catch{}}};
export const hubSession={
 // The kept sign-in while it lasts; one that has ended is dropped.
 get(){const t=local.get();if(t&&!sessionClaims(t)){local.set(null);return null;}return t;},
 claims(){return sessionClaims(local.get());},
 keep(token){if(sessionClaims(token))local.set(token);},
 clear(){local.set(null);},
};
