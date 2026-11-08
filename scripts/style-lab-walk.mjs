import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as esbuild from 'esbuild';

// The style lab's walk: this checkout's public walk compiled in debug mode against the deployed assets
// (scripts/walk-frame-build.mjs, unchanged), with the style hook (src/style-lab/walk-styles.js) loaded beside it. The
// walk's own code is not changed; the hook finds it through the debug build's globalThis.__walk. Output goes to
// output/perf-walk/builds/style-lab; `npm run style-lab` serves it at http://127.0.0.1:4180/walk/walk.html.
// Usage: node scripts/style-lab-walk.mjs [--skip-walk] (--skip-walk rebuilds only the hook, for style changes).
const out=path.resolve('output/perf-walk/builds/style-lab');
if(!process.argv.includes('--skip-walk'))execFileSync(process.execPath,['scripts/walk-frame-build.mjs','--tag=style-lab','--debug'],{stdio:'inherit'});

// The hook uses the walk's own three (page-three.js), so its targets and materials are the renderer's own kind.
const pageThree={name:'page-three',setup(b){b.onResolve({filter:/^three$/},()=>({path:path.resolve('src/style-lab/page-three.js')}));}};
await esbuild.build({entryPoints:['src/style-lab/walk-styles.js'],bundle:true,format:'esm',target:'es2022',outfile:path.join(out,'style-walk.js'),plugins:[pageThree],logLevel:'warning'});

// Loaded once the walk has published its debug handle (after the ship is built): a classic script, so it does not wait
// on the walk module's own top-level awaits.
const LOADER=`<script data-style-lab>(function wait(){if(globalThis.__walk&&globalThis.LEO_THREE){import('./style-walk.js').then(m=>m.installWalkStyles(globalThis.__walk),e=>console.error('Style lab:',e));return;}setTimeout(wait,250);})();</script>`;
const page=path.join(out,'walk.html');
let html=await fs.readFile(page,'utf8');
html=html.replace(/<script data-style-lab>.*?<\/script>/s,'');
if(!html.includes('</body>'))throw new Error('The walk page has no </body> to load the style lab before');
await fs.writeFile(page,html.replace('</body>',`${LOADER}</body>`));
console.log('Style lab walk ready: npm run style-lab, then http://127.0.0.1:4180/walk/walk.html');
