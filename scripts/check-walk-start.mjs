import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {preparedFetcher,PREPARED_TRIES} from '../src/v2/prepared-fetch.js';

// The walk's start when it goes wrong, without a browser: the prepared ship's downloads get a few tries
// (src/v2/prepared-fetch.js), and the page's own start script (src/walk/walk.html, LEO_WALK_BOOT) shows one failure line
// and keeps its "last start was cut off" note honest. The start script is run as it ships, cut out of walk.html, against a
// small stand-in for the page; only its import() is swapped for a function the check controls.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const settle=()=>new Promise(r=>setImmediate(r));

// Downloads.
const reply=(status,body='ok')=>({ok:status>=200&&status<300,status,arrayBuffer:async()=>new TextEncoder().encode(body).buffer});
const fetcher=answers=>{const calls=[],waits=[],warned=[];let i=0;const get=preparedFetcher('https://leo.test/base/prepared-walk/',{fetch:async url=>{calls.push(String(url));const a=answers[i++];if(a instanceof Error)throw a;return a;},wait:async ms=>{waits.push(ms);},warn:(...a)=>warned.push(a)});return {get,calls,waits,warned};};
assert.equal(PREPARED_TRIES,3);
{const f=fetcher([reply(200,'part')]);assert.equal(new TextDecoder().decode(await f.get('geometry-0.bin')),'part');assert.deepEqual(f.calls,['https://leo.test/base/prepared-walk/geometry-0.bin']);assert.deepEqual(f.waits,[]);assert.equal(f.warned.length,0);pass('a download that works is fetched once, from the payload\'s folder, with no wait');}
{const f=fetcher([reply(503),TypeError('Failed to fetch'),reply(200,'third')]);assert.equal(new TextDecoder().decode(await f.get('geometry-4.bin')),'third');assert.equal(f.calls.length,3);assert.deepEqual(f.waits,[600,1200]);assert.equal(f.warned.length,2);pass('a server hiccup and a dropped connection are tried again, after 0.6 s and 1.2 s');}
{const f=fetcher([{ok:true,status:200,arrayBuffer:async()=>{throw TypeError('network error');}},reply(200,'whole')]);assert.equal(new TextDecoder().decode(await f.get('geometry-1.bin')),'whole');assert.deepEqual(f.waits,[600]);pass('a download that drops partway is tried again');}
{const f=fetcher([reply(404),reply(200)]);await assert.rejects(f.get('geometry-2.bin'),e=>e.leoWalkFailure==='download'&&/^Prepared walk download failed: geometry-2\.bin \(404\)$/.test(e.message));assert.equal(f.calls.length,1);assert.deepEqual(f.waits,[]);pass('a missing file fails at once: it stays missing');}
{const f=fetcher([reply(503),reply(502),reply(500),reply(200)]);await assert.rejects(f.get('world.json.gz'),e=>e.leoWalkFailure==='download'&&e.message==='Prepared walk download failed: world.json.gz (500)');assert.equal(f.calls.length,3);assert.deepEqual(f.waits,[600,1200]);pass('a server that keeps failing is given up on after three tries');}
{const drop=TypeError('Failed to fetch'),f=fetcher([drop,drop,drop,reply(200)]);await assert.rejects(f.get('geometry-3.bin'),e=>e.leoWalkFailure==='download'&&/the connection dropped/.test(e.message)&&e.cause===drop);assert.equal(f.calls.length,3);pass('a connection that stays down is given up on after three tries, and says so');}
{const full=RangeError('Array buffer allocation failed'),f=fetcher([{ok:true,status:200,arrayBuffer:async()=>{throw full;}},reply(200)]);await assert.rejects(f.get('geometry-5.bin'),e=>e===full);assert.equal(f.calls.length,1);pass('running out of memory is not a download to try again');}
const resource=fs.readFileSync('src/v2/prepared-resource.public.js','utf8');
assert(/readPreparedWorld\(base,\{status,fetchBytes:preparedFetcher\(base\),/.test(resource));pass('the public walk reads its prepared ship through those tries');

// The page's start script.
const html=fs.readFileSync('src/walk/walk.html','utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.includes('window.LEO_WALK_BOOT=function'));
assert.equal(scripts.length,1);assert.equal(scripts[0].split('import(').length,2,'the start script imports the walk script once');
const boot=new vm.Script(scripts[0].replace('import(','LEO_TEST_IMPORT('));
for(const id of ['loading','loading-text','loading-fail','loading-fail-note','loading-reload','loading-slow','phone-walk-note','memory','memory-note','memory-try','who'])assert(html.includes('id="'+id+'"'),id);
// One visit: `storage` outlives it, as localStorage does. The walk script is the promise the check settles.
function visit(storage,{phone=false}={}){
 const elements=new Map(),observers=new Set(),listeners={},errors=[],thrown=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,textContent:id==='loading-text'?'Loading…':'',hidden:/^(loading-fail|loading-slow|phone-walk-note|memory|who)$/.test(id),dataset:{},title:''});return elements.get(id);};
 const body={dataset:{}};let script;const imported=[];
 const page={document:{getElementById:element,body,baseURI:'https://leo.test/walk.html'},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>{storage.set(k,String(v));},removeItem:k=>{storage.delete(k);}},
  MutationObserver:class{constructor(f){this.f=f;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},matchMedia:()=>({matches:phone}),navigator:{userAgent:phone?'Android 14; Mobile':'Windows',deviceMemory:8},screen:{width:phone?400:2560,height:phone?800:1440},
  location:{search:'',reload(){page.reloaded=true;}},URL,Date,console:{error:(...a)=>errors.push(a)},setTimeout:f=>{try{f();}catch(e){thrown.push(e);}},addEventListener:(type,f)=>{(listeners[type]||=[]).push(f);},
  LEO_TEST_IMPORT:url=>{imported.push(url);return new Promise((resolve,reject)=>{script={resolve,reject};});}};
 page.window=page;vm.createContext(page);boot.runInContext(page);page.LEO_WALK_BOOT('walk.0123456789.js');
 const changed=()=>{for(const o of [...observers])o.f();};
 return {page,element,body,listeners,errors,thrown,imported,started:()=>imported.length>0,
  status(text){element('loading-text').textContent=text;changed();},ready(){body.dataset.ready='1';changed();},leave(){for(const f of listeners.pagehide||[])f();},
  async fail(e){script.reject(e);await settle();},failed:()=>element('loading').dataset.failed,line:()=>element('loading-fail-note').textContent,gate:()=>!element('memory').hidden};
}
const NOTE='leo-walk-building',STAGE='leo-walk-stage';

{const storage=new Map(),v=visit(storage);assert.deepEqual(v.imported,['https://leo.test/walk.0123456789.js']);assert(storage.has(NOTE));v.status('Loading prepared rooms… 43%');assert.equal(storage.get(STAGE),'Loading prepared rooms… 43%');
 v.ready();assert(!storage.has(NOTE)&&!storage.has(STAGE));assert.equal(storage.get('leo-walk-walked'),'1');assert.equal(v.failed(),undefined);assert(v.element('loading-fail').hidden);
 const again=visit(storage);assert(again.started()&&!again.gate());pass('a start that finishes clears its note, shows no failure line, and the next visit goes straight in');}
{const storage=new Map(),v=visit(storage);v.status('Loading prepared rooms… 43%');
 const again=visit(storage);assert(again.gate()&&!again.started());assert.match(again.element('memory-note').textContent,/closed before it finished loading \(it had reached “Loading prepared rooms… 43%”\)/);
 again.element('memory-try').onclick();assert(again.started()&&again.element('memory').hidden);pass('a start cut off mid-build (no leaving, no failure) is asked about on the next visit');}
{const storage=new Map(),v=visit(storage);v.status('Loading prepared rooms… 43%');v.leave();assert(!storage.has(NOTE)&&!storage.has(STAGE));
 const again=visit(storage);assert(again.started()&&!again.gate());pass('leaving during the download, before the walk script has run, leaves no note');}
{const storage=new Map(),v=visit(storage);v.status('Loading prepared rooms… 43%');
 const dropped=Object.assign(Error('Prepared walk download failed: geometry-7.bin (the connection dropped)'),{leoWalkFailure:'download'});await v.fail(dropped);
 assert.equal(v.failed(),'download');assert.equal(v.body.dataset.failed,'download');assert(!v.element('loading-fail').hidden);
 assert.equal(v.line(),'The walk could not finish loading: a download failed. Check your connection, then reload.');assert.match(v.element('loading-fail-note').title,/geometry-7\.bin/);assert.match(v.errors[0][0],/could not finish loading \(at “Loading prepared rooms… 43%”\)/);assert.deepEqual(v.thrown,[dropped],'the error stays an uncaught one');
 assert(!storage.has(NOTE)&&!storage.has(STAGE));v.status('Loading prepared rooms… 47%');assert(!storage.has(STAGE),'a late loading line is not kept after a failure');
 v.element('loading-reload').onclick();assert(v.page.reloaded);v.leave();
 const again=visit(storage);assert(again.started()&&!again.gate());pass('a failed download shows the failure line with Reload, and is not taken for a memory problem next visit');}
{const lines={};for(const [name,e]of [['script',TypeError('Failed to fetch dynamically imported module: https://leo.test/walk.0123456789.js')],['exterior',Error('Could not load leo-exterior-web.glb: the connection dropped. Please retry.')],['webgl',Error('Error creating WebGL context.')],['checks',Error('Prepared metadata integrity failed')],['odd','stopped']]){const storage=new Map(),v=visit(storage);await v.fail(e);lines[name]=[v.failed(),v.line()];assert(!storage.has(NOTE),name);assert.match(v.line(),/^The walk could not finish loading/);}
 assert.equal(lines.script[0],'download');assert.equal(lines.exterior[0],'download');assert.deepEqual(lines.webgl,['webgl','The walk could not finish loading: this browser did not start its 3D view (WebGL). Reload to try again.']);
 assert.deepEqual(lines.checks,['error','The walk could not finish loading. Reload to try again.']);assert.equal(lines.odd[0],'error');pass('a walk script that cannot be fetched, a lost exterior, WebGL that will not start and a ship that fails its checks each say the start could not finish');}
{const storage=new Map(),v=visit(storage);await v.fail(RangeError('Array buffer allocation failed'));assert.equal(v.failed(),'memory');assert.match(v.line(),/could not finish loading: this device ran short of memory/);assert(storage.has(NOTE));v.leave();assert(storage.has(NOTE));
 const again=visit(storage);assert(again.gate()&&!again.started());pass('a start that ran out of memory keeps its note, through Reload too, so the next visit asks first');}
{const storage=new Map(),v=visit(storage);v.ready();v.body.dataset.ready='0';v.page.LEO_WALK_FAILED('The view stopped: this device ran short of graphics memory. Reload to walk again.');
 assert.equal(v.failed(),'view');assert.equal(v.line(),'The view stopped: this device ran short of graphics memory. Reload to walk again.');assert.equal(v.errors.length,0);assert.equal(v.thrown.length,0);
 await v.fail(Error('later'));assert.equal(v.thrown.length,1);assert.equal(v.failed(),'view');assert.match(v.line(),/^The view stopped/);pass('the walk script\'s own line (a lost graphics context) is shown as given, and the first failure keeps the card');}
{const storage=new Map(),v=visit(storage);v.status('Preparing first view…');v.page.LEO_WALK_ARMED=true;await v.fail(TypeError('Cannot read properties of null'));assert.equal(v.failed(),undefined);assert(v.element('loading-fail').hidden);assert.equal(v.errors.length,0);assert.equal(v.thrown.length,1);assert(storage.has(NOTE));
 v.ready();assert(!storage.has(NOTE));assert.equal(storage.get('leo-walk-walked'),'1');pass('an error in the walk script after it has set its frames going stays an uncaught error and is not shown: that walk still draws');}
{const v=visit(new Map());assert.deepEqual(Object.keys(v.listeners),['pagehide']);pass('nothing but the walk script\'s own start can put the failure line up: the page listens for no stray errors');}
{const phone=visit(new Map(),{phone:true});assert(phone.gate()&&!phone.started());assert.equal(phone.failed(),undefined);pass('a phone\'s first visit is still asked before anything loads');}

// The card and the walk script's side of it.
const hidden=html.match(/([^\r\n]*)\{display:none!important\}/g).find(rule=>rule.includes('#loading[data-failed]'));
for(const id of ['loading-text','loading-slow','phone-walk-note','memory','who'])assert(hidden.includes('#loading[data-failed] #'+id),id);pass('a failed card hides the loading line, the slow note, the phone note, the memory question and the name block');
const main=fs.readFileSync('src/walk/main.public.js','utf8'),lost=main.split(/\r?\n/).find(line=>line.includes("addEventListener('webglcontextlost'"));
assert(lost.includes('window.LEO_WALK_FAILED(line)')&&lost.includes("document.body.dataset.ready='0'"));pass('a lost graphics context goes through the same failure card');
// The walk's frames wait for `warmed`, which only the script's last statement and its 18 s fallback set. The fallback is
// set on the line that tells the page (LEO_WALK_ARMED), after the script's last await: a start that rejected before that
// line can never also become ready, which is what makes it fatal, and one that rejected after it still draws.
const lines=main.split(/\r?\n/),awaits=lines.flatMap((line,i)=>/^(?:await |\S.*[=(;{]await )/.test(line)?[i]:[]),sets=lines.flatMap((line,i)=>line.includes('warmed=true')?[i]:[]),armed=lines.flatMap((line,i)=>line.includes('LEO_WALK_ARMED')?[i]:[]);
assert(awaits.length>=3);assert.equal(sets.length,2);assert.deepEqual(armed,[sets[0]]);assert.equal(lines[armed[0]],'setTimeout(()=>{warmed=true;},3*WARM_WAIT_MS);window.LEO_WALK_ARMED=true;');assert(armed[0]>Math.max(...awaits));
assert.equal(lines[sets[0]+1],'renderer.setAnimationLoop(()=>{');assert(lines.slice(sets[0]+1,sets[0]+6).includes(' if(!warmed)return;'));assert.equal(sets[1],lines.findLastIndex(line=>line.trim()));
assert(!main.includes("addEventListener('pagehide',()=>{try{localStorage.removeItem(STARTING)"));pass('the walk cannot become ready unless its script reached the line that tells the page so, and leaves the note to the page');
console.log(`walk start: ${checks} checks passed`);
