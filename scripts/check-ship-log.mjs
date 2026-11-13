import {parseMedia,spotQuery,readSnapshot} from './ship-log-media.mjs';

// The ship log's pictures and spots (scripts/ship-log-media.mjs): what the parser takes from a build timer's pull request
// description, and that the kept copy holds only what the walk's change boards can use.
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'ok  ':'FAIL'} ${name}${ok||!detail?'':' · '+detail}`);if(!ok)failed++;};
const RAW='https://raw.githubusercontent.com/jaybmcv/leo-threejs/pr-media/';
const body=`**Where to look**
https://leo.marscatsvoyage.com/walk.html?at=5.29,21.28,52.58&yaw=81&pitch=-24&view=first, then walk along the counter.

| Before | After |
|---|---|
| ![report-view, before](${RAW}feedback-issue-86/7d9254f/report-view-before.jpg) | ![report-view, after](${RAW}feedback-issue-86/7d9254f/report-view-after.jpg) |
| live site | this pull request: \`walk.html?at=24,21.28,51.2&yaw=40&pitch=-25&view=first\` |
| ![before](${RAW}fin-glass-height/d79d321/fin-height-side-before.jpg) | ![after](${RAW}fin-glass-height/d79d321/fin-height-side-after.jpg) |
| ![elsewhere](https://example.com/a-before.jpg) | ![elsewhere](https://example.com/a-after.jpg) |`;
const m=parseMedia(body);
check('the "Where to look" link is the change\'s spot',m.go==='at=5.29,21.28,52.58&yaw=81&pitch=-24&view=first',m.go);
check('each before | after row is one pair, before on the left',m.shots?.length===2&&m.shots[0].before.endsWith('report-view-before.jpg')&&m.shots[0].after.endsWith('report-view-after.jpg'),JSON.stringify(m.shots));
check('a pair takes its spot from the row under it',m.shots?.[0].at==='at=24,21.28,51.2&yaw=40&pitch=-25&view=first'&&!m.shots?.[1].at);
check('a pair is named from its alt text, or its file when that only says before',m.shots?.[0].label==='Report view'&&m.shots?.[1].label==='Fin height side',m.shots?.map(s=>s.label).join());
check('pictures from anywhere but the pr-media branch are left out',!JSON.stringify(m).includes('example.com'));
check('a description with neither gives nothing',JSON.stringify(parseMedia('Just words.'))==='{}');
check('walk links keep only the walk\'s own keys',spotQuery('at=1,2,3&yaw=90.4&pitch=x&live=wss://evil&view=first')==='at=1,2,3&yaw=90&view=first'&&spotQuery('at=1,2')===null);
const snap=Object.entries(readSnapshot()),shots=snap.flatMap(([,v])=>v.shots||[]);
check('the kept copy has spots and pictures',snap.length>0&&shots.length>0,`${snap.length} changes, ${shots.length} pairs`);
check('every kept spot and picture is one the walk can use',snap.every(([id,v])=>/^\d+$/.test(id)&&(!v.go||spotQuery(v.go)===v.go))&&shots.every(s=>s.label&&/^[\w./-]+\.(jpe?g|png|webp)$/.test(s.before)&&/^[\w./-]+\.(jpe?g|png|webp)$/.test(s.after)&&(!s.at||spotQuery(s.at)===s.at)));
if(failed){console.log(`${failed} ship log check(s) failed`);process.exit(1);}
console.log('ship log checks pass');
