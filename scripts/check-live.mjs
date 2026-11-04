import {layoutVersion} from './layout-selector.mjs';
if(layoutVersion===1)(await import('./run-legacy.mjs')).runLegacy('scripts/check-live.mjs',process.argv.slice(2));else{await import('./check-lever-panel.mjs');await import('./check-live-goto-v2.mjs');await import('./check-live-client-v2.mjs');await import('./check-live-spatial-v2.mjs');}
