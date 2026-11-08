// Laps for the full build: each call prints the seconds since the previous one as a [build-timing] line, so the
// deploy log shows where a long build went. Timing only; nothing here changes what is built.
export function buildLaps(label){let t=performance.now();return name=>{const now=performance.now();console.log('[build-timing] '+label+' '+name+': '+((now-t)/1000).toFixed(1)+' s');t=now;};}
