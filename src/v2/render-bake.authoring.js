import {bakeForWalking as baseBake,showBands as baseShow} from '../walk/render-bake.authoring.js';
import {onePassAtriumGlass} from './atrium-visibility.js';
import {shadeContacts} from '../walk/contact-shade.js';
// Contact shading is baked into the merged colours here, before the prepared build records them.
export function bakeForWalking(root,options){onePassAtriumGlass(root);const baked=baseBake(root,options);baked.contactShade=shadeContacts(baked.bands);return baked;}
export function showBands(bands,low,high){baseShow(bands,low,high);}
