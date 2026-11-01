// The walk loaded inside Otherside. Otherside shares its Glyph session with a game: it sends glyph:ready, unasked and
// as soon as the game loads, with the player's wallet address, chain ID, username and profile picture, from
// otherside.xyz. So there's no login there: the player comes aboard under their Glyph name, and Discord isn't offered.
// The wallet goes to Leo live, which gives them what a Discord account gets. Nothing in glyph:ready is signed, so the
// server can't check it (glyphVisitor in server/leo-live.mjs). An inline script in walk.html listens from the first
// moment (LEO_HEARD), before this bundle has loaded.
// Otherside has published no example of the message, so readGlyph takes the likely shapes; ?glyphdebug=1 lists whatever
// actually arrives, to check inside ODK.
const ORIGINS=['https://otherside.xyz','https://www.otherside.xyz'];
const page=typeof location==='undefined'?null:location;
const allowed=(()=>{
 // A local stand-in for Otherside for development, from a page on localhost only.
 const asked=page&&new URLSearchParams(page.search).get('otherside');
 return asked&&/^(localhost|127\.0\.0\.1)$/.test(page.hostname)&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(asked)?[...ORIGINS,asked]:ORIGINS;
})();
const heard=typeof window==='undefined'?[]:window.LEO_HEARD||[];
const fromOtherside=m=>m.origin==='event'||allowed.includes(m.origin);

// What a glyph:ready message says, or null if it isn't one: {wallet, chainId, username, picture}, each null if absent.
export function readGlyph(data){
 let d=data;if(typeof d==='string'&&d[0]==='{')try{d=JSON.parse(d);}catch{return null;}
 if(d==='glyph:ready')return {wallet:null,chainId:null,username:null,picture:null};
 if(!d||typeof d!=='object'||![d.type,d.event,d.name,d.action,d.message].includes('glyph:ready'))return null;
 const p=[d.payload,d.data,d.detail,d.user].find(v=>v&&typeof v==='object')||d,user=p.user&&typeof p.user==='object'?{...p,...p.user}:p;
 const wallet=[user.walletAddress,user.address,user.wallet,user.evmWallet].find(w=>typeof w==='string'&&/^0x[0-9a-fA-F]{40}$/.test(w))||null;
 const chainId=Number(user.chainId);
 const username=typeof user.username==='string'&&user.username.trim()?user.username.trim():null;
 const picture=typeof user.profileImageUrl==='string'&&/^https:\/\//.test(user.profileImageUrl)?user.profileImageUrl:null;
 return {wallet,chainId:Number.isFinite(chainId)&&user.chainId!=null?chainId:null,username,picture};
}

// Loaded in a frame of Otherside's, or already told so. Chromium names the pages this one is framed by.
export const inOtherside=(()=>{
 const ancestors=page?.ancestorOrigins?[...page.ancestorOrigins]:[];
 return ancestors.some(o=>allowed.includes(o))||heard.some(m=>fromOtherside(m)&&readGlyph(m.data));
})();

// Calls back with glyph:ready's contents, including if it came before this was called.
export function onGlyph(call){
 if(typeof window==='undefined')return;
 let got=false;
 const take=m=>{debug(m);if(got||!fromOtherside(m))return;const g=readGlyph(m.data);if(g){got=true;call(g);}};
 window.LEO_HEAR=take;heard.splice(0).forEach(take);
}

let debugBox=null;
function debug(m){
 if(!debugBox)return;
 let text;try{text=JSON.stringify(m.data);}catch{text=String(m.data);}
 debugBox.append(`${m.origin}${fromOtherside(m)?' (accepted)':''}: ${String(text).slice(0,400)}\n`);
}
if(page&&typeof document!=='undefined'&&new URLSearchParams(page.search).has('glyphdebug')){
 debugBox=document.createElement('pre');
 debugBox.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;z-index:100;margin:0;padding:10px;background:#000c;color:#7fffd4;font:11px/1.4 monospace;white-space:pre-wrap;pointer-events:none';
 const ancestors=page.ancestorOrigins?[...page.ancestorOrigins].join(', ')||'none':'unknown';
 debugBox.append(`glyphdebug · in Otherside: ${inOtherside} · framed by: ${ancestors} · window.ue: ${typeof window.ue}\n`);
 addEventListener('DOMContentLoaded',()=>document.body.append(debugBox));if(document.body)document.body.append(debugBox);
}
