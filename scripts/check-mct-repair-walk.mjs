import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {ANGLE_IF_ASKED,PLAYWRIGHT_FROM} from './chrome-setup.mjs';
import {serveViewerReview} from './serve-viewer-v2.mjs';

const {chromium}=createRequire(PLAYWRIGHT_FROM)('playwright');
const server=serveViewerReview({base:process.cwd(),out:'dist-v2',port:0});
await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const at=[-107.41,-39.69,40.65],small={width:360,height:540},errors=[];
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu-sandbox',...ANGLE_IF_ASKED]});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.route(origin+'/api/leo/pass',route=>route.fulfill({status:401,body:'{}'}));
 // Resume beside bay 3, facing the open aisle, so the walk records the position through its normal resume timer.
 await page.addInitScript(at=>localStorage.setItem('leo-walk-last-spot',JSON.stringify({at,yaw:0,pitch:-14*Math.PI/180,view:'third',t:Date.now()})),at);
 const query=new URLSearchParams({lv:'2',live:'ws://127.0.0.1:1/live',creamery:origin});
 await page.goto(origin+'/walk.html?'+query,{waitUntil:'domcontentloaded'});
 await page.locator('#who-guest').waitFor({state:'visible',timeout:180000});
 await page.locator('#name-input').fill('Repair check');
 await page.locator('#who-guest').evaluate(form=>form.requestSubmit());
 await page.waitForFunction(()=>document.body.dataset.ready==='1',null,{timeout:180000});
 await page.locator('#prompt .label').filter({hasText:/Repair MCT .*Service 3/}).waitFor({state:'visible',timeout:180000});
 const start=await page.evaluate(()=>JSON.parse(localStorage.getItem('leo-walk-last-spot')).at);
 assert(Math.hypot(...start.map((v,i)=>v-at[i]))<1,'The visitor starts by service bay 3');
 await page.keyboard.press('KeyE');
 const game=page.locator('.mct-repair'),primary=game.locator('[data-primary]');
 assert.equal(await game.locator('[data-vehicle]').textContent(),'MCT-03 Assembly');
 await primary.evaluate(button=>button.addEventListener('click',()=>{
  const random=Math.random;Math.random=()=>.04;queueMicrotask(()=>{Math.random=random;});
 },{capture:true,once:true}));
 await page.keyboard.press('Enter');
 await game.locator('[data-pile] [data-part="wheel"]').waitFor({state:'visible'});
 await page.setViewportSize(small);
 await page.waitForFunction(()=>{
  const bench=document.querySelector('.mct-repair [data-bench]').getBoundingClientRect();
  const parts=[...document.querySelectorAll('.mct-repair [data-part]')];
  return innerWidth===360&&innerHeight===540&&bench.bottom<=innerHeight&&parts.length===40&&parts.every(el=>{
   const r=el.querySelector('svg').getBoundingClientRect();
   return el.getBoundingClientRect().width>=52&&r.left>=bench.left&&r.right<=bench.right&&r.top>=bench.top&&r.bottom<=bench.bottom;
  });
 });
 const wheel=game.locator('[data-part="wheel"]');
 await wheel.focus();
 const center=async el=>{const r=await el.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
 const part=await center(wheel);
 await page.mouse.click(part.x,part.y);
 assert.equal(await wheel.getAttribute('aria-pressed'),'true');
 const mount=game.locator('[data-hotspots] [title="Wheel & Hub"]');
 const marker=await center(mount),frontWheel=await center(game.locator('[data-cart]>svg circle[cx="101"][cy="151"][r="30"]'));
 assert(Math.hypot(marker.x-frontWheel.x,marker.y-frontWheel.y)<1,'The target centers on the drawn front wheel at 360x540');
 await page.mouse.click(marker.x,marker.y);
 assert.equal(await wheel.count(),0,'The wheel installs in the small viewport');
 assert.equal(await mount.getAttribute('class'),'done');
 await page.keyboard.press('Escape');
 await game.waitFor({state:'hidden'});
 await page.keyboard.down('KeyW');
 try{
  await page.waitForFunction(start=>{
   const at=JSON.parse(localStorage.getItem('leo-walk-last-spot'))?.at;
   return at&&at[2]-start[2]>=2.5;
  },start,{polling:100,timeout:8000});
 }finally{await page.keyboard.up('KeyW');}
 assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[small.width,small.height]);
 assert.deepEqual(errors,[]);
 console.log('PASS MCT service bay 3: E opens the game, the wheel aligns and installs after resizing the browser to 360x540, and Esc restores at least 2.5 m of walking at that size.');
}finally{
 try{await browser?.close();}finally{await new Promise(resolve=>server.close(resolve));}
}
