import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// The prepared walk's startup order, read from source: it needs no build, so fast deploys run it too (check-quick-v2.mjs)
// as well as the full prepared frame-time fixture. Furnishing batching (furnishing-batches.js) is batching too, so it may
// sit between the low-deck batches and the settle; the settle must still come after every batch.
const SETTLES_AFTER_BATCHING=/batchLowDeckDraws\(baked,renderer(?:,\{[^;]*\})?\);\}?(?:if\(!preparedPhone\)ship\.v2FurnishingBatches=batchFurnishing\(ship\.liveDraws,renderer\);)?(atriumGeometry=(?:preparedPhone\?null:|atriumPack\?)?createAtriumGeometryRuntime\(baked,renderer,\{[^;]*\}\)(?::null)?;)?settlePreparedStatic\(ship\);/;
export async function checkPreparedStartupSource(){
 for(const suffix of ['', '.authoring', '.public'])assert((await fs.readFile('src/v2/prepared-runtime'+suffix+'.js','utf8')).includes('preparedBake(ship){rememberPreparedStatic(ship);'),'Prepared bake must capture fixed contents before late activities');
 for(const suffix of ['.prepared','.public'])assert(SETTLES_AFTER_BATCHING.test(await fs.readFile('src/walk/main'+suffix+'.js','utf8')),'Prepared startup must settle after all reparenting and batching');
 const main=await fs.readFile('src/walk/main.public.js','utf8');assert(SETTLES_AFTER_BATCHING.test(main),'Public startup must settle after all reparenting and batching');
 return 'Prepared bake captures fixed contents first; prepared and public startup settle after all reparenting and batching';
}
