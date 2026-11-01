import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {listenForHub} from '../src/walk/hub-link.js';
import {walkLink} from '../src/hub/walk-link.js';
import {pill,note,hasTrack,isMoving,trackNodes,groups,stats,feature,shortDate} from '../src/hub/model.js';

// What the Builder's Hub says for each kind of card, and that the built page stays light and holds nobody's data.
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const card=(over={})=>({id:'20261027-010b8b80',stage:'submitted',status:'submitted',dates:{submitted:'2026-10-27T00:00:00Z'},steps:null,stepTotal:null,shots:[],...over});

check('the five stops follow the stage',()=>{
 const states=c=>trackNodes(c).map(n=>n.state);
 assert.deepEqual(states(card()),['now','todo','todo','todo','todo']);
 assert.deepEqual(states(card({stage:'building',status:'review'})),['done','done','now','todo','todo']);
 assert.deepEqual(states(card({stage:'shipped',status:'shipped'})),['done','done','done','now','todo']);
 assert.deepEqual(states(card({stage:'live',status:'live'})),['done','done','done','done','done']);
});
check('only moving work pulses',()=>{
 for(const status of ['building','review','shipped'])assert.equal(isMoving(card({status})),true,status);
 for(const status of ['submitted','decision','approved','paused','live','more-info'])assert.equal(isMoving(card({status})),false,status);
});
check('Shipped says what it is waiting for',()=>{
 assert.match(note(card({status:'shipped',deployment:'pending'})),/next update/);
 assert.match(note(card({status:'shipped',deployment:'unknown'})),/confirm/);
});
check('a step reads with its number, and a total only when known',()=>{
 const steps=[{number:1,status:'live'},{number:2,status:'building'},{number:3,status:'planned'}];
 assert.equal(pill(card({status:'building',steps,stepTotal:3})).text,'Step 2 of 3 · Being built');
 assert.equal(pill(card({status:'building',steps})).text,'Step 2 · Being built');
 assert.equal(pill(card({status:'approved',steps:[{number:1,status:'live'}]})).text,'Step 2 · Approved');
 assert.equal(pill(card({status:'live',steps:[{number:1,status:'live'}],moreToCome:true})).text,'Live on Leo · more to come');
 assert.equal(pill(card({status:'live',steps:[{number:1,status:'live'}]})).text,'Live on Leo');
});
check('finished cards have no track, and only a written reason',()=>{
 for(const status of ['joined','resolved','closed'])assert.equal(hasTrack(card({status})),false);
 assert.equal(note(card({status:'closed'})),null);assert.equal(note(card({status:'closed',reason:'Another way.'})),'Another way.');
});
check('a follow-up uses the written question',()=>{
 assert.equal(note(card({status:'more-info',question:'Which lift?'})),'Which lift?');
 assert.match(note(card({status:'more-info'})),/Feedback/);
});
check('an unknown status from a newer service still reads',()=>assert.equal(pill(card({status:'something-new'})).text,'Received'));
check('cards fall into groups, newest first, with counts',()=>{
 const live=(day,shots=[])=>card({stage:'live',status:'live',dates:{live:`2026-10-${day}T00:00:00Z`},shots});
 const list=[live(10),live(20,[{}]),card({status:'more-info'}),card({status:'review'}),card({status:'decision'}),card({status:'closed'})];
 const g=groups(list);
 assert.deepEqual(g.map(x=>x.key),['needs','works','waiting','live','ended']);
 assert.equal(g[3].cards[0].dates.live,'2026-10-20T00:00:00Z');
 assert.deepEqual(stats(list).map(s=>s.n),[6,1,2,1]);
 assert.equal(feature(list).dates.live,'2026-10-20T00:00:00Z');assert.equal(feature([live(10)]),null);
});
check('dates read short',()=>{
 const now=new Date('2026-10-31T15:00:00');
 assert.equal(shortDate('2026-10-31T10:00:00',now),'Today');assert.equal(shortDate('2026-10-27T10:00:00',now),'Oct 27');
 assert.equal(shortDate('2025-10-27T10:00:00',now),'Oct 27, 2025');assert.equal(shortDate(null,now),'');assert.equal(shortDate('nonsense',now),'');
});
// The Hub and an open walk, over a real BroadcastChannel.
const pause=ms=>new Promise(r=>setTimeout(r,ms));
{
 const hub=walkLink();await pause(30);
 let c=hub.isOpen();assert.equal(c,false,'no walk: nothing open');
 assert.equal(await hub.check(),false,'no walk: nothing answers');
 assert.deepEqual(await hub.go('at=1,2,3'),{sent:false},'no walk: nothing sent');
 const moved=[],side=listenForHub();await pause(30);
 assert.equal(hub.isOpen(),true,'a walk still building counts as open');
 assert.equal(await hub.check(),true,'and needs no answer while it builds');
 let r=await hub.go('at=1,2,3');assert.deepEqual([r.sent,r.loading],[true,true],'told it is still loading');assert.equal(moved.length,0);
 side.ready(s=>{moved.push(s);return s!=='bad';});await pause(30);
 assert.deepEqual(moved,['at=1,2,3'],'the waiting move happens once ready');
 r=await hub.go('at=4,5,6');assert.deepEqual([r.sent,r.ok,r.loading],[true,true,false]);assert.deepEqual(moved.at(-1),'at=4,5,6');
 r=await hub.go('bad');assert.deepEqual([r.sent,r.ok],[true,false],'a spot it cannot reach says so');
 assert.equal(await hub.check(),true,'an open walk answers');
 side.close();assert.equal(await hub.check(),false,'a closed walk does not');
 hub.close();passed++;console.log('PASS the Hub finds and moves an open walk, and copes with none');
}
try{
 const html=await fs.readFile('dist/hub.html','utf8'),script=/<script type="module" src="(hub\.[0-9a-f]{10}\.js)"/.exec(html)?.[1];
 const code=await fs.readFile('dist/'+script,'utf8');
 check('the built page is light and carries no Three.js',()=>{assert.ok(code.length<60*1024,`${code.length} bytes`);assert.ok(!code.includes('WebGLRenderer'));});
 check('the built page uses only text for what the service sends',()=>assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(code)));
 check('the built page names the service, and holds no report data',()=>{assert.ok(code.includes('mcv-feedback-hub.'));assert.ok(!/discord:\d|\b\d{17,20}\b/.test(code+html));});
}catch(e){if(e.code!=='ENOENT')throw e;console.log('dist/hub.html not built; skipped the page checks');}
console.log(`All Builder's Hub checks passed (${passed}).`);
