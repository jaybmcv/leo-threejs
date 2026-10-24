import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Before-and-after pictures and walk spots for the ship log (scripts/ship-log.mjs, src/walk/changes-board.js), read from
// the merged pull requests' descriptions. The build timers' requests show their screenshots in a table, before on the
// left and after on the right, each pair over a row naming the spot it was taken from (`walk.html?at=…`), and say
// "Where to look" with a walk link. The pictures stay on the repository's pr-media branch; only their paths are kept.
// The build asks GitHub (the gh command) for the descriptions and falls back to ship-log-media.json, the copy this
// script writes when run on its own: node scripts/ship-log-media.mjs
const REPO='jaybmcv/leo-threejs',SNAPSHOT=new URL('./ship-log-media.json',import.meta.url);
export const MEDIA_BASE=`https://raw.githubusercontent.com/${REPO}/pr-media/`;
const IMAGE=new RegExp(String.raw`!\[([^\]]*)\]\(${MEDIA_BASE.replace(/[./]/g,'\\$&')}([\w./-]+\.(?:jpe?g|png|webp))\)`,'g');
const SPOT=/walk\.html\?([^\s`)>\]"'|]+)/,MAX_SHOTS=8;

// A walk link's query, kept to what the walk reads (src/walk/link.js), or null.
export function spotQuery(link){
 const p=new URLSearchParams(link.replace(/&amp;/g,'&')),at=(p.get('at')||'').split(',').map(Number);
 if(at.length!==3||!at.every(Number.isFinite))return null;
 const out=[`at=${at.map(v=>+v.toFixed(2)).join(',')}`];
 for(const k of ['yaw','pitch']){const v=Number(p.get(k));if(p.has(k)&&Number.isFinite(v))out.push(`${k}=${Math.round(v)}`);}
 if(p.get('view')==='first')out.push('view=first');
 return out.join('&');
}
// A sentence's punctuation after a link isn't part of it.
const spotIn=line=>{const m=SPOT.exec(line);return m?spotQuery(m[1].replace(/[.,;:]+$/,'')):null;};
// "report-view, before" or "fin, reporter's view, before" → "Report view", "Fin, reporter's view"; a bare "before" →
// the file's name.
function label(alt,path){
 let s=alt.replace(/[,\s]*\b(before|after)\b\s*$/i,'').trim();
 if(!s)s=path.split('/').pop().replace(/\.\w+$/,'').replace(/-(before|after)$/,'');
 s=s.replace(/[-_]+/g,' ').trim();return s&&s[0].toUpperCase()+s.slice(1);
}
// {go, shots:[{label, before, after, at}]} from one description; go and at are walk queries, before and after paths
// under MEDIA_BASE. Either may be missing.
export function parseMedia(body=''){
 const lines=body.split(/\r?\n/),shots=[];let go=null,where=false,first=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],spot=spotIn(line);
  if(/where to look/i.test(line))where=true;
  if(spot){first??=spot;if(where&&!go)go=spot;}
  const images=[...line.matchAll(IMAGE)];
  if(!line.trim().startsWith('|')||images.length<2||shots.length>=MAX_SHOTS)continue;
  const [b,a]=images,shot={label:label(b[1],b[2]),before:b[2],after:a[2]};
  // The row under a pair names where it was taken.
  const next=lines[i+1]||'';if(next.trim().startsWith('|')&&!IMAGE.test(next)){const at=spotIn(next);if(at)shot.at=at;}
  IMAGE.lastIndex=0;shots.push(shot);
 }
 go??=shots.find(s=>s.at)?.at??first;
 return {...(go?{go}:{}),...(shots.length?{shots}:{})};
}
// Every merged request's pictures and spot, by number, from GitHub; null when gh can't answer.
export function fetchMedia(){
 let prs;
 try{prs=JSON.parse(execFileSync('gh',['pr','list','--repo',REPO,'--state','merged','--limit','1000','--json','number,body'],{encoding:'utf8',maxBuffer:1<<26,timeout:30000,stdio:['ignore','pipe','ignore']}));}
 catch{return null;}
 const media={};
 for(const pr of prs.sort((a,b)=>a.number-b.number)){const m=parseMedia(pr.body);if(m.go||m.shots)media[pr.number]=m;}
 return media;
}
export function readSnapshot(){try{return JSON.parse(fs.readFileSync(SNAPSHOT,'utf8'));}catch{return {};}}
// GitHub's answer when there is one, else the copy kept here.
export function loadMedia(){const fresh=fetchMedia();return fresh?{media:fresh,from:'GitHub'}:{media:readSnapshot(),from:'ship-log-media.json'};}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const media=fetchMedia();if(!media){console.error('gh could not list the pull requests; ship-log-media.json is unchanged.');process.exit(1);}
 fs.writeFileSync(SNAPSHOT,JSON.stringify(media,null,1)+'\n');
 const all=Object.values(media);
 console.log(`ship-log-media.json: ${all.length} requests with a spot or pictures, ${all.filter(m=>m.shots).length} with before-and-after pictures (${all.reduce((n,m)=>n+(m.shots?.length||0),0)} pairs).`);
}
