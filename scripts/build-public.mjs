import {v2} from './layout-selector.mjs';
if(v2)await import('./public-v2.mjs');else(await import('./run-legacy.mjs')).runLegacy('scripts/build-public.mjs',process.argv.slice(2));
