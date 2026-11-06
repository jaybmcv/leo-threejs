import {bakeForWalking as baseBake,showBands as baseShow} from '../walk/render-bake.js';
import {onePassAtriumGlass} from './atrium-visibility.js';
import {shadeContacts} from '../walk/contact-shade.js';
import {glazeLoungeShoulders} from './lounge-shoulders.js';
// The lounge shoulders are glazed (1C) before merging. Contact shading is baked into the merged colours here, before the prepared build records them.
export function bakeForWalking(root,options){onePassAtriumGlass(root);const shoulders=glazeLoungeShoulders(root),baked=baseBake(root,options);baked.loungeShoulders=shoulders;baked.contactShade=shadeContacts(baked.bands);return baked;}
export function showBands(bands,low,high){baseShow(bands,low,high);}
