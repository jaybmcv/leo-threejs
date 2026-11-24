// Gives the page a turn during long loading work. A timer (setTimeout 0) waits for whatever else the page has queued,
// often a frame of the loading card: desktop low-deck batching spent 4 s of its 5 s in those waits. scheduler.yield
// comes back first instead, so the work keeps the thread; a timer turn every PAINT_MS still lets the loading card's
// text and spinner update, as before.
export const PAINT_MS=100;
let lastTurn=0,frames=null,framesCome=true;
/** While someone walks the arrival hall as the ship builds (arrival-preview.js), `due()` says when it has gone too long
 * without drawing: the next turn then waits for its frame. Null puts the turns back as they were. */
export function setFrameTurns(policy){frames=policy;}
// Its frame, then the build again: requestAnimationFrame runs the hall's own frame first (registered a frame earlier), and
// the timer after it resumes the build once that frame is drawn. Bounded: a page the browser gives no frames (a hidden
// tab, a tab behind another, an iframe out of sight, all of which may still say they are visible) waits FRAME_WAIT_MS
// once, and then no turn waits for a frame until one comes (the same requestAnimationFrame, whenever it runs).
const FRAME_WAIT_MS=50;
function frameTurn(){
 return new Promise(resolve=>{let done=false;const go=()=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('visibilitychange',go);resolve();};
  const timer=setTimeout(()=>{framesCome=false;go();},FRAME_WAIT_MS);addEventListener('visibilitychange',go);
  requestAnimationFrame(()=>{framesCome=true;clearTimeout(timer);setTimeout(go,0);});});
}
/** A turn only while the arrival hall is walked (setFrameTurns): build steps that gave the page none before go straight
 * on at every other start. */
export function hallTurn(){return frames?yieldToPage():undefined;}
export function yieldToPage(){
 const now=performance.now();
 if(framesCome&&frames?.due()){lastTurn=now;return frameTurn();}
 if(!globalThis.scheduler?.yield||now-lastTurn>=PAINT_MS){lastTurn=now;return new Promise(resolve=>setTimeout(resolve,0));}
 return globalThis.scheduler.yield();
}
/** A yield that gives the page a turn only once `ms` of work has run since the last: for loops of many small steps (the
 * phone hull's 1,287 parts each waited for a frame of the loading card, 19 s in all for about half a second of work). */
export function yieldEvery(ms=12){let slice=performance.now();return async()=>{if(performance.now()-slice<ms)return;await yieldToPage();slice=performance.now();};}
