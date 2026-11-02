import {v2} from './layout-selector.mjs';
if(!v2)(await import('./run-legacy.mjs')).runLegacy('scripts/check-walk.mjs',process.argv.slice(2));
await import('./check-budgets-v2.mjs');
await (await import('./run-v2.mjs')).runV2('walk');
