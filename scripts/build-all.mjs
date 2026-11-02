import {requireBuildSpace} from './build-storage.mjs';
import {v2} from './layout-selector.mjs';
await requireBuildSpace();
if(!v2)(await import('./run-legacy.mjs')).runLegacy('scripts/build-all.mjs',process.argv.slice(2));
await (await import('./cache-transport-pack-v2.mjs')).preparePackedCacheTransport();
await import('./build-v2.mjs');
