// The home inspector's loading cover and its shared ship preparation (src/v2/inspector-loading.js).
// Each scenario is a sequence of clicks and download events a visitor can produce; the cover is what render last got.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createCover,once} from '../src/v2/inspector-loading.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const screen=()=>{const s={text:'ASSEMBLING LEO',writes:0};s.cover=createCover(t=>{s.text=t;s.writes++;});return s;};

{// Deck layout, then Exterior while the full ship is still downloading (the black cover that stayed, 2026-11-09).
 const s=screen(),{cover}=s,ship=deferred();
 const layout=cover.begin(),waiting=cover.wait(layout,'interior',ship.promise);
 assert.equal(s.text,'Assembling Leo','the owner waits: the cover is up before the first progress report');
 cover.say('interior','Loading current ship… 12%');assert.equal(s.text,'Loading current ship… 12%');
 const exterior=cover.begin();assert.equal(s.text,'','Exterior needs nothing more: the cover goes at once');
 assert(cover.owns(exterior)&&!cover.owns(layout));
 const writes=s.writes;
 cover.say('interior','Loading current ship… 60%');cover.say('interior','Preparing the updated decks and cabin parts…');
 assert.equal(s.text,'','late progress from the superseded view does not bring the cover back');assert.equal(s.writes,writes,'and does not touch the page');
 ship.resolve('decks');assert.equal(await waiting,'decks');await tick();assert.equal(s.text,'','nor does its download finishing');
 pass('a view superseded mid-download can neither show the cover nor leave it up');
}
{// The same, the other way round: the view that still owns the screen keeps its cover while an older wait ends.
 const s=screen(),{cover}=s,ship=deferred();
 const first=cover.begin(),a=cover.wait(first,'interior',ship.promise);cover.say('interior','Loading current ship… 40%');
 const second=cover.begin(),b=cover.wait(second,'interior',ship.promise);
 assert.equal(s.text,'Loading current ship… 40%','a second view that needs the same ship shows where the download is');
 cover.say('interior','Loading current ship… 80%');assert.equal(s.text,'Loading current ship… 80%');
 ship.resolve();await Promise.all([a,b]);assert.equal(s.text,'','the cover goes when the owner has what it waited for');
 const third=cover.begin(),c=cover.wait(third,'interior',Promise.resolve());await c;assert.equal(s.text,'','a ship already in memory leaves no cover');
 pass('the cover follows the owner: up while it waits, down when its wait ends');
}
{// Each wait shows only the word for what it waits for.
 const s=screen(),{cover}=s,shell=deferred();
 cover.say('interior','Loading current ship… 99%');
 const start=cover.begin(),w=cover.wait(start,'exterior',shell.promise);
 assert.equal(s.text,'Assembling Leo','another download’s progress is not this wait’s word');
 cover.say('exterior','Loading current ship… 5%');assert.equal(s.text,'Loading current ship… 5%');
 cover.say('interior','Loading current ship… 100%');assert.equal(s.text,'Loading current ship… 5%');
 shell.resolve();await w;assert.equal(s.text,'');
 pass('the cover shows the word for what the owner waits for, not another download’s');
}
{// A failed download: the owner's cover clears and the error reaches its caller; a superseded failure changes nothing.
 const s=screen(),{cover}=s,bad=deferred(),good=deferred();
 const a=cover.begin(),wa=cover.wait(a,'interior',bad.promise);bad.reject(Error('dropped'));
 await assert.rejects(wa,/dropped/);assert.equal(s.text,'','a failed wait leaves no cover over the error');
 const b=cover.begin(),wb=cover.wait(b,'interior',bad.promise).catch(e=>e.message);
 const c=cover.begin(),wc=cover.wait(c,'exterior',good.promise);cover.say('exterior','Loading current ship… 30%');
 assert.equal(await wb,'dropped');assert.equal(s.text,'Loading current ship… 30%','a superseded failure does not clear the owner’s cover');
 good.resolve();await wc;assert.equal(s.text,'');
 pass('failures clear only their own cover');
}
{// Two views ask for the decks while the ship downloads: one download, one preparation.
 let runs=0;const gate=deferred(),get=once(async()=>{runs++;await gate.promise;await tick();return{records:runs};});
 const a=get(),b=get();gate.resolve();const [x,y]=await Promise.all([a,b]);
 assert.equal(runs,1,'the ship is prepared once');assert.equal(x,y,'both callers get the same prepared ship');assert.equal(await get(),x);assert.equal(runs,1);
 let tries=0;const flaky=once(async()=>{if(++tries===1)throw Error('dropped');return'ok';});
 await assert.rejects(flaky(),/dropped/);assert.equal(await flaky(),'ok','a failed run is not kept: the next click tries again');
 pass('concurrent callers share one preparation; a failure can be retried');
}
{// The page keeps to the rule: #loading has one writer, and the decks one preparation.
 const source=await fs.readFile(new URL('../src/v2/inspector.js',import.meta.url),'utf8');
 assert.equal(source.split("$('loading')").length-1,1,'only the cover writes #loading');
 assert.match(source,/const cover=createCover\(/);assert.match(source,/const getInterior=once\(/);
 pass('inspector.js writes #loading in one place and prepares the decks through once()');
}
console.log(`inspector loading: ${passed} checks passed`);
