import {v2} from './layout-selector.mjs';
if(v2)await import('./check-public-v2.mjs');else(await import('./run-legacy.mjs')).runLegacy('scripts/check-public.mjs');
