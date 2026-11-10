// A/B switches for what a GPU spends on each pixel, for a test on a visitor's own machine with the Stats readout
// (?fps=1): is it short of pixels (multisampled edges, the drawing size, depth writes) or of triangles? Depth has its
// own switches beside the renderer (?deskdepth=, ?phonedepth= in main.public.js). Each link then says everything it
// draws with, whatever the visitor's own Detail and Res choices are.

// ?deskaa=0 or 1 turns a desktop's multisampling off or on whatever the Detail level chose (a phone has ?phoneaa=0).
export const deskAntialias=(query,byDetail)=>{const v=query?.get('deskaa');return v==='0'?false:v==='1'?true:byDetail;};

// ?res=high, med (or medium) or low holds that level of the Res button for this visit. The walk reads it where it
// reads the saved level, so nothing is saved and slow frames never step it down: a measurement keeps one drawing size.
// Null when none is asked or the button has no such level.
export function heldRes(query,levels){
 const asked=(query?.get('res')??'').toLowerCase(),v=asked==='medium'?'med':asked;
 return levels.find(l=>l.toLowerCase()===v)??null;
}

// The Stats readout's line for them: the samples the context really got (a browser may refuse multisampling, or give
// fewer than asked) and which depth buffer the walk draws with.
export const pixelLine=({samples,logDepth}={})=>`msaa ${samples>1?'×'+samples:'off'}   ${logDepth?'log':'linear'} depth`;
