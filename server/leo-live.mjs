// The public entry point: v1 remains the unadapted server; v2 uses the client's exact layout pipeline.
import {layoutVersion} from '../scripts/layout-selector.mjs';
const entry=layoutVersion===2?await (await import('../scripts/build-live-v2.mjs')).buildLiveV2():new URL('./live-core.mjs',import.meta.url);
export const {server}=await import(entry.href);
