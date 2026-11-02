// Native tools and bundled pages consume the same selected room frames.
import {readFileSync} from 'node:fs';
import {selectedRuntimeLayout} from './runtime-layout.js';
export default selectedRuntimeLayout(JSON.parse(readFileSync(new URL('../../output/leo-interior-v02/layout.json',import.meta.url),'utf8')));
