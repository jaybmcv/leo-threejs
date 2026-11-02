// Coordinated layout entry. LEO_LAYOUT=1 retains the pinned rollback implementation.
import {layoutVersion} from '../scripts/layout-selector.mjs';
if(layoutVersion===1)(await import('../scripts/run-legacy.mjs')).ensureLegacyWorkspace();
const entry=layoutVersion===2?await (await import('../scripts/build-live-v2.mjs')).buildLiveV2():new URL('../legacy/v1/server/leo-live.mjs',import.meta.url);
export const {server}=await import(entry.href);
