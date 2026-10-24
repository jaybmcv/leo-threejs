import {execFileSync} from 'node:child_process';

// The ship log for the walk's change boards (src/walk/changes-board.js): every pull request merged into this branch, newest
// first, read from git at build time. A merge commit's subject names the request ("Merge pull request #12 from ...")
// and its body is the request's title, which becomes the change's name; the commit's date is the day it was completed.
// Built from a copy without git history, the log is empty and the boards say so.
const PREFIX=/^(feat|fix|perf|chore|docs|refactor|style|test)(\([^)]*\))?!?:\s*/i,TAG=/^(Walk|Feedback( #\d+)*):\s*/i;
export const plainName=title=>{const s=title.trim().replace(PREFIX,'').replace(TAG,'');return s&&s[0].toUpperCase()+s.slice(1);};
export function shipLog(cwd=process.cwd()){
 let out='';
 try{out=execFileSync('git',['log','--first-parent','--merges','--format=%x1e%s%x1f%cs%x1f%b'],{cwd,encoding:'utf8',maxBuffer:1<<26,stdio:['ignore','pipe','ignore']});}catch{return [];}
 const log=[];
 for(const record of out.split('\x1e')){
  const [subject,date,body='']=record.split('\x1f'),pr=/^Merge pull request #(\d+) /.exec(subject||''),name=plainName(body.split('\n').find(l=>l.trim())||'');
  if(pr&&name&&/^\d{4}-\d\d-\d\d$/.test(date))log.push({id:+pr[1],name:name.slice(0,120),date});
 }
 return log;
}
