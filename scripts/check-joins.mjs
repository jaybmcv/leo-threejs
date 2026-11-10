// Ask to join (server/joins.mjs, src/walk/join.js): the request's rules with a stand-in clock and visitors, the server's
// public-area policy, and the wiring in every copy of the server and the page. Real sockets and two browsers are in
// check-live-spatial-v2 and the pull request's browser run; this one is quick and runs with every check.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createJoins,JOIN_MS,DECLINED_MS,MOST_ASKING,ASKS} from '../server/joins.mjs';
import {buildLiveV2} from './build-live-v2.mjs';
import {PROTOCOL} from '../src/walk/net/wire.js';
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};

// Stand-in visitors: an id, a name, where they stand, whether they play; what each was told.
let t=1000;const told=new Map(),people=new Map();
const visitor=(id,name,pos=[0,0,0])=>{const v={id,name,pos,playing:false,ready:true};people.set(id,v);told.set(v,[]);return v;};
const last=v=>told.get(v).at(-1),said=v=>told.get(v).length;
const PUBLIC=p=>Array.isArray(p)&&p[0]>=0;
const joins=createJoins({send:(v,msg)=>told.get(v).push(msg),find:id=>people.get(id)||null,canJoin:PUBLIC,clock:()=>t});
const ann=visitor('a','Ann',[-5,0,0]),bea=visitor('b','Bea',[10,2,3]),cal=visitor('c','Cal'),dot=visitor('d','Dot');
const ask=(v,to)=>joins.message(v,{m:'join',op:'ask',to}),answer=(v,req,ok)=>joins.message(v,{m:'join',op:'answer',req,ok});

ask(ann,'b');const sent=last(ann),asked=last(bea);
assert.deepEqual(sent,{m:'join',e:'sent',req:sent.req,to:'b',name:'Bea',ms:JOIN_MS});assert.deepEqual(asked,{m:'join',e:'ask',req:sent.req,from:'a',name:'Ann',ms:JOIN_MS});
let n=said(ann);answer(cal,sent.req,true);assert.equal(said(ann),n,'only the one asked answers');
answer(bea,sent.req,true);assert.deepEqual(last(ann),{m:'join',e:'go',req:sent.req,to:'b',name:'Bea',at:[10,2,3]});assert.equal(last(bea).e,'done');
n=said(ann);answer(bea,sent.req,true);assert.equal(said(ann),n,'answered once');assert.equal(joins.size,0);
pass('accepted: the asker is told where the one asked stands; only they answer, once');

ask(ann,'b');answer(bea,last(bea).req,false);assert.equal(last(ann).why,'declined');
ask(ann,'b');assert.equal(last(ann).why,'again');t+=DECLINED_MS;joins.tick();ask(ann,'b');assert.equal(last(ann).e,'sent');
pass(`declined: no; asked again within ${DECLINED_MS/1000} s, refused; after that, asked`);

const req=last(ann).req;t+=JOIN_MS-1;joins.tick();assert.equal(joins.size,1);t+=1;joins.tick();
assert.equal(last(ann).why,'expired');assert.deepEqual(last(bea),{m:'join',e:'off',req,from:'a',name:'Ann',why:'expired'});
n=said(ann);answer(bea,req,true);assert.equal(said(ann),n);pass(`unanswered for ${JOIN_MS/1000} s: it runs out for both, and can no longer be accepted`);

t+=ASKS[1];ask(cal,'b');joins.message(cal,{m:'join',op:'cancel'});assert.equal(last(cal).why,'cancelled');assert.equal(last(bea).why,'cancelled');
ask(cal,'b');ask(cal,'a');assert.equal(last(bea).why,'cancelled','a second ask replaces the first');assert.equal(last(ann).e,'ask');
pass('cancelled, or replaced by a new ask: the one asked is told');

joins.left(cal);assert.equal(last(ann).why,'gone','the asker left');
ask(dot,'a');joins.left(ann);people.delete('a');assert.equal(last(dot).why,'gone','the one asked left');assert.equal(joins.size,0);
pass('either side leaves: the other is told, and nothing is left behind');

const eve=visitor('e','Eve',[-1,0,0]),fay=visitor('f','Fay',[3,0,0]);t+=ASKS[1];
ask(fay,'e');answer(eve,last(eve).req,true);assert.equal(last(fay).why,'busy');assert.equal(last(eve).why,'busy');
eve.pos=[2,0,0];eve.playing=true;ask(fay,'e');answer(eve,last(eve).req,true);assert.equal(last(fay).why,'busy');
eve.playing=false;eve.pos=null;ask(fay,'e');answer(eve,last(eve).req,true);assert.equal(last(fay).why,'busy');
pass('accepted somewhere not public, in a game, or before a pose: nobody is sent');

t+=ASKS[1];const fans=['g','h','i','j'].map(id=>visitor(id,id.toUpperCase()));for(const f of fans.slice(0,MOST_ASKING)){ask(f,'b');assert.equal(last(f).e,'sent');}
ask(fans[MOST_ASKING],'b');assert.equal(last(fans[MOST_ASKING]).why,'busy');pass(`at most ${MOST_ASKING} asking one visitor at once`);
t+=JOIN_MS;joins.tick();t+=ASKS[1];const kim=visitor('k','Kim');for(let i=0;i<ASKS[0];i++){ask(kim,fans[i].id);assert.equal(last(kim).e,'sent');}
ask(kim,'b');assert.equal(last(kim).why,'slow');t+=ASKS[1];ask(kim,'b');assert.equal(last(kim).e,'sent');
pass(`at most ${ASKS[0]} asks in ${ASKS[1]/1000} s`);
ask(kim,'k');assert.equal(last(kim).why,'self');ask(kim,'nobody');assert.equal(last(kim).why,'unknown');ask(kim,42);
assert.equal(last(kim).why,'unknown','a bad id says nothing more');pass('yourself, someone not aboard, and a bad id');

// The server's policy is the walk's public-area rule (src/walk/public-area.js), from the selected layout.
const {policy,spatial}=await import((await buildLiveV2({entry:'src/v2/live-spatial.js',outfile:'output/launch-h/spatial-joins-v2.mjs'})).href);
const club=spatial.restricted.find(z=>z.name==='clubhouse'),cx=club.poly.reduce((s,p)=>s+p[0],0)/club.poly.length,cz=club.poly.reduce((s,p)=>s+p[1],0)/club.poly.length;
assert(policy.canJoin(spatial.selfie)&&policy.canJoin(spatial.maze.start)&&policy.canJoin(spatial.telescope));
assert(!policy.canJoin(spatial.maze.button)&&!policy.canJoin([cx,club.y[0]+.5,cz])&&!policy.canJoin([-180,-27.7,0])&&!policy.canJoin(null)&&!policy.canJoin([NaN,0,0]));
for(const l of spatial.lifts)assert(!policy.canJoin([l.car.x,l.stops[0].y,l.car.z]),l.id);
pass('server policy: public stations can be joined; the maze, the tank bay, the clubhouse and lift shafts cannot');

// Wiring: every server copy routes joins the same way; every page offers it; protocol 10.
assert.equal(PROTOCOL,10);
for(const f of ['live-core','live-core.authoring','live-core.prepared','live-core.public']){const s=await fs.readFile(`server/${f}.mjs`,'utf8');
 for(const piece of ["import {createJoins} from './joins.mjs';","canJoin:policy.canJoin","case 'join':if(allowed(v,'join'))joins.message(v,msg);break;",'joins.left(v);','joins.tick();','ids:here.map(v=>v.id)'])assert(s.includes(piece),f+': '+piece);}
for(const [f,area] of [['live-spatial','public-area'],['live-spatial.authoring','public-area.authoring'],['live-spatial.prepared','public-area'],['live-spatial.public','public-area']]){
 const s=await fs.readFile(`src/v2/${f}.js`,'utf8');assert(s.includes(`from '../walk/${area}.js'`)&&s.includes('restricted:ZONES')&&s.includes('canJoin:'),f);}
for(const f of ['main','main.authoring','main.prepared','main.public']){const s=await fs.readFile(`src/walk/${f}.js`,'utf8');
 for(const piece of ["import {createJoin} from './join.js';",'join=createJoin({live:()=>live,here:joinBlock,land:joinBeside});','join:msg=>join?.fromServer(msg)','away:1.2,radius:4','join?.ask(id,name)'])assert(s.includes(piece),f+': '+piece);}
assert((await fs.readFile('scripts/live-layout-identity.mjs','utf8')).includes("'src/walk/public-area.js'"),'the rule is a live identity input');
pass('all four server copies and all four pages are wired the same way; the rule is part of the live layout identity');
console.log(`check-joins: ${checks} checks passed`);
