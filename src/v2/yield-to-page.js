// Gives the page a turn during long loading work. A timer (setTimeout 0) waits for whatever else the page has queued,
// often a frame of the loading card: desktop low-deck batching spent 4 s of its 5 s in those waits. scheduler.yield
// comes back first instead, so the work keeps the thread; a timer turn every PAINT_MS still lets the loading card's
// text and spinner update, as before.
export const PAINT_MS=100;
let lastTurn=0;
export function yieldToPage(){
 const now=performance.now();
 if(!globalThis.scheduler?.yield||now-lastTurn>=PAINT_MS){lastTurn=now;return new Promise(resolve=>setTimeout(resolve,0));}
 return globalThis.scheduler.yield();
}
/** A yield that gives the page a turn only once `ms` of work has run since the last: for loops of many small steps (the
 * phone hull's 1,287 parts each waited for a frame of the loading card, 19 s in all for about half a second of work). */
export function yieldEvery(ms=12){let slice=performance.now();return async()=>{if(performance.now()-slice<ms)return;await yieldToPage();slice=performance.now();};}
