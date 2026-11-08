// The graphic novel's surface terms for the style lab, after Voyager's Reach's ligne claire (graphicShading.ts,
// graphicPalette.ts): a few flat colours, three flat values, and shade crossed with ink hatching anchored in the world.

// The page's palette (graphicPalette.ts GRAPHIC_PALETTE), in its own order.
export const GRAPHIC_PALETTE=[
 ['paper','#f0e8d2'],['chalk','#d2cbb8'],['stone','#a39b8c'],['slate','#6f7885'],['charcoal','#3c3a46'],['ink-black','#211f2a'],
 ['sand','#dcc58e'],['straw','#c9a751'],['clay','#c2693f'],['rust','#8c4c37'],['dirt','#8a6d4b'],['soil','#65503d'],
 ['sage','#93a666'],['olive','#7c8a3f'],['leaf','#5b8a47'],['forest','#2f4d3a'],['haze-blue','#a9cfe0'],['sea','#4a90b8'],
 ['turquoise','#37a6a3'],['deep-blue','#2d5179'],['night-blue','#232f4f'],['mauve','#9b7a97'],['rose','#d98b84'],['lavender','#b3a7d3'],
];
// Lightness below this is not divided by (a very dark colour's chromaticity is noise), and how much lightness counts
// for a grey and for a coloured surface (graphicPalette.ts).
const L_FLOOR=.12,LIGHTNESS_WEIGHT=.7,LIGHTNESS_BASE=.06;
// The flat values (graphicShading.ts): a face the sun only grazes, and the shade.
const SIDE_VALUE=.84,SHADE_VALUE=.64,SIDE_NL=.28;
// Hatching: the least gap between lines in pixels at 720 (a built thing's), and how dark a line is. One period of the
// slicing plane is a uniform (uLabHatchM, surface.js); the stripes double their spacing with distance, level by level,
// so it only sets where the doubling starts.
const HATCH_GAP_PX=8,HATCH_INK=.85;
// Every other line fades out over this share of each level (graphicStripes.ts GRAPHIC_STRIPE_FADE).
const STRIPE_FADE=[.5,.8];

const toLinear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
export function hexToLinear(hex){const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255].map(v=>toLinear(v/255));}
export function linearToOklab([r,g,b]){
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const vec3=v=>`vec3(${v.map(x=>x.toFixed(5)).join(', ')})`;
const PAL_RGB=GRAPHIC_PALETTE.map(([,hex])=>hexToLinear(hex)),PAL_LAB=PAL_RGB.map(linearToOklab);
const chromaticity=([l,a,b])=>[a/Math.max(l,L_FLOOR),b/Math.max(l,L_FLOOR)];

// Leo's own paints that the page names outright (by material name), as Reach's buildings are painted for its page: the
// ceramic hull is a cool light grey (#b8bbc6) that the viewer's reflections make white, and by the palette's own measure
// it is nearest haze-blue, which reads as a blue ship. Everything not named here is snapped.
const PAGE_PAINTS=[[/^V32_Ceramic_satin/,'paper'],[/^V33_window_frames$/,'chalk']];
export function pagePaintFor(materialName){
 const hit=PAGE_PAINTS.find(([re])=>re.test(materialName));
 return hit?hexToLinear(GRAPHIC_PALETTE.find(([name])=>name===hit[1])[1]):null;
}

export const GRAPHIC_SURFACE_GLSL=`
// the ink: a dark, warm near-black (linear light)
const vec3 G_INK = vec3(0.019, 0.016, 0.028);
// half the page's one line width, in pixels at 720
const float G_HW = 0.85;
// the hatching's slicing plane (unit vector): stripes are where it cuts a surface, so they run true across every facet
const vec3 G_HS1 = vec3(0.612, 0.590, 0.526);
#define G_PAL_N ${GRAPHIC_PALETTE.length}
const vec3 G_PAL_RGB[G_PAL_N] = vec3[G_PAL_N](${PAL_RGB.map(vec3).join(',\n  ')});
const vec3 G_PAL_LAB[G_PAL_N] = vec3[G_PAL_N](${PAL_LAB.map(vec3).join(',\n  ')});
const vec2 G_PAL_CH[G_PAL_N] = vec2[G_PAL_N](${PAL_LAB.map(chromaticity).map(c=>`vec2(${c.map(x=>x.toFixed(5)).join(', ')})`).join(',\n  ')});
// a paint the page names for this material (PAGE_PAINTS), or negative to snap
uniform vec3 uLabPage;
float gGrad(float x) { return length(vec2(dFdx(x), dFdy(x))); }
vec3 gOklab(vec3 c) {
  vec3 lms = vec3(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)), dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)), dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)));
  lms = pow(max(lms, vec3(0.0)), vec3(1.0 / 3.0));
  return vec3(dot(lms, vec3(0.2104542553, 0.793617785, -0.0040720468)), dot(lms, vec3(1.9779984951, -2.428592205, 0.4505937099)), dot(lms, vec3(0.0259040371, 0.7827717662, -0.808675766)));
}
// The nearest of the page's colours (graphicPalette.ts gSnapL): by chromaticity (chroma over lightness), with lightness
// counting fully only for a grey, so a warm white and a pale sand are two colours but a lit and a shaded panel of one
// paint are one.
vec3 labSnap(vec3 c) {
  vec3 lab = gOklab(c);
  // (only where the paint is the light one: a pod's ceramic is painted navy below its split, concept-paint.js)
  if (uLabPage.r >= 0.0 && lab.x > 0.5) return uLabPage;
  vec2 chrom = lab.yz / max(lab.x, ${L_FLOOR.toFixed(2)});
  float coloured = length(chrom) * smoothstep(0.08, 0.25, lab.x);
  float wl = ${LIGHTNESS_BASE.toFixed(2)} + ${LIGHTNESS_WEIGHT.toFixed(2)} * (1.0 - smoothstep(0.03, 0.10, coloured));
  float best = 1e9;
  int k = 0;
  for (int i = 0; i < G_PAL_N; i++) {
    vec2 dc = chrom - G_PAL_CH[i];
    float dl = lab.x - G_PAL_LAB[i].x;
    float d = dot(dc, dc) + wl * dl * dl;
    if (d < best) { best = d; k = i; }
  }
  return G_PAL_RGB[k];
}
// Stripes in h (one period per unit), a fixed number of pixels wide and never closer than minGapPx: where they would
// be, every other line fades out and the spacing doubles, level by level, until the surface is flat tone.
float gStripes(float h, float widthPx, float minGapPx) {
  float fw = max(gGrad(h), 1e-6);
  float lod = clamp(log2(minGapPx * fw), -2.0, 6.5);
  float l0 = floor(lod);
  float fl = lod - l0;
  float scale = exp2(-l0);
  float hh = h * scale;
  float fwl = fw * scale;
  float idx = floor(hh + 0.5);
  float dist = abs(hh - idx);
  float hw = 0.5 * widthPx * fwl;
  float cov = 1.0 - smoothstep(hw - 0.5 * fwl, hw + 0.5 * fwl, dist);
  cov *= 1.0 - mod(idx, 2.0) * smoothstep(${STRIPE_FADE[0].toFixed(2)}, ${STRIPE_FADE[1].toFixed(2)}, fl);
  cov *= 1.0 - smoothstep(4.5, 6.5, lod);
  return cov;
}
// The page's colour for a surface: lit, a face the sun only grazes (a built thing's third value), or shade, which is
// the same flat colour crossed with ink.
vec3 graphicFinish(vec3 pal, float nl, float face, float lit, vec3 wp) {
  float aa = max(fwidth(nl), 1e-3);
  float side = (1.0 - smoothstep(${SIDE_NL.toFixed(2)} - aa, ${SIDE_NL.toFixed(2)} + aa, nl)) * lit;
  float value = mix(mix(1.0, ${SIDE_VALUE.toFixed(2)}, side), ${SHADE_VALUE.toFixed(2)}, 1.0 - lit);
  float hatch = gStripes(dot(wp, G_HS1) / uLabHatchM, 2.0 * G_HW * uLabPx, ${HATCH_GAP_PX.toFixed(1)} * uLabPx) * (1.0 - lit);
  return mix(pal * value, G_INK, hatch * ${HATCH_INK.toFixed(2)});
}`;
