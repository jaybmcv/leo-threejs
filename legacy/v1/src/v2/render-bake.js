import {bakeForWalking as baseBake,showBands as baseShow} from '../walk/render-bake.js?legacy';
import {atriumSpan,onePassAtriumGlass} from './atrium-visibility.js';
export function bakeForWalking(root,options){onePassAtriumGlass(root);return baseBake(root,options);}
export function showBands(bands,low,high){baseShow(bands,...atriumSpan(low,high));}
