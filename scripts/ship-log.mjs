import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {loadMedia} from './ship-log-media.mjs';

// The ship log for the walk's change boards (src/walk/changes-board.js): every pull request merged into this branch, newest
// first, read from git at build time. A merge commit's subject names the request ("Merge pull request #12 from ...")
// and its body is the request's title, which becomes the change's name; the commit's date is the day it was completed.
// Merges made outside GitHub carry no title (and may carry git's "# Conflicts:" notes), so their titles are kept in
// ship-log-titles.json. Built from a copy without git history, the log is empty and the boards say so.
// A change also carries where to see it (go, a walk link's query) and its before-and-after pictures (shots), when its
// request's description has them: scripts/ship-log-media.mjs.
const PREFIX=/^(feat|fix|perf|chore|docs|refactor|style|test)(\([^)]*\))?!?:\s*/i,TAG=/^(Walk|Feedback( #\d+)*):\s*/i;
const TITLES=JSON.parse(fs.readFileSync(new URL('./ship-log-titles.json',import.meta.url),'utf8'));
export const plainName=title=>{const s=title.trim().replace(PREFIX,'').replace(TAG,'');return s&&s[0].toUpperCase()+s.slice(1);};
export function shipLog(cwd=process.cwd(),media=loadMedia().media){
 let out='';
 try{out=execFileSync('git',['log','--merges','--format=%x1e%s%x1f%cs%x1f%b'],{cwd,encoding:'utf8',maxBuffer:1<<26,stdio:['ignore','pipe','ignore']});}catch{return [];}
 // Every merged request once, wherever its merge sits in the history (merging main in can move one off the first parent).
 const log=[],seen=new Set();
 for(const record of out.split('\x1e')){
  const [subject,date,body='']=record.split('\x1f'),pr=/^Merge pull request #(\d+) /.exec(subject||'');if(!pr||seen.has(pr[1]))continue;
  const name=plainName(body.split('\n').find(l=>l.trim()&&!l.startsWith('#'))||TITLES[pr[1]]||'');
  if(name&&/^\d{4}-\d\d-\d\d$/.test(date)){seen.add(pr[1]);log.push({id:+pr[1],name:name.slice(0,120),date,...media[pr[1]]});}
 }
 return log;
}
