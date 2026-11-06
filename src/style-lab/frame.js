import * as T from 'three';
import {STYLE} from './surface.js';
import {TOON_GRADE_GLSL,STYL_GRADE_GLSL} from './grades.js';

// The style lab's frame: the last thing that happens to every pixel. The scene is drawn into a linear HDR target with
// its depth; this pass draws the ink, the sky, the style's grade and its tone curve, after Voyager's Reach's frames:
//   toon       toonFrame.ts: lines on the FAR side of every jump in depth (the line goes round the near thing, so a form
//              keeps its own silhouette), weighted as a building's (1.9 px on a 1080-line frame), and quieter creases
//              where the surface turns; navy ink, brown over warm colours; then the toon palette and a neutral curve
//   stylised   no ink: the Stylised 3D grade and a neutral curve
//   graphic    graphicFrame.ts: one even line round everything and along sharp creases, in the page's ink; no grade and
//              no curve, so the page's flat colours print as they are
//   original   Leo's viewer as it is: ACES at 0.86, no ink
// Reach knows what each surface is (a cat, the ground, grass) and weights or drops lines by it; Leo is one built thing,
// so every surface here is inked as a building is, and lines are found from the depth alone.

// Line weights in pixels on a 1080-line frame, and the least each may shrink to (toonFrame.ts INK_WEIGHTS).
const TOON_INK={prop:{px:1.9,min:1.2},crease:{px:.8,min:.6}};
// The graphic novel's one line: half its width in pixels at 720 (graphicShading.ts G_HW).
const GRAPHIC_HW=.85;
// Toon inks (toonFrame.ts TOON_FRAME_ART.ink): a navy and a brown, chosen between by how warm the paper is.
const TOON_INK_NAVY=0x182333,TOON_INK_BROWN=0x30281f,TOON_INK_WARM=.8;
// How much nearer a thing must be than what lies behind it, as a share of its distance, to be outlined; and how far a
// surface must turn across a pixel, in radians, to be a crease (none at the first, whole at the second). The graphic's
// crease is Reach's GRAPHIC_CREASE_SLOPE; the toon's a little looser, for its quieter lines.
const INK_JUMP=.012,TOON_CREASE=[.55,.85],GRAPHIC_CREASE=[.9,1.2];
// Creases fade out between these distances (metres), where a depth-built normal turns to noise.
const CREASE_FADE=[1400,2400];
// Each style's tone curve (0 none, 1 ACES, 2 neutral), exposure and sky (sRGB hex; the sky is drawn as given, as
// Leo's clear colour is). The toon's exposure brings Leo's ceramic hull, a light grey that the viewer's reflections
// make white, up to the toon's warm white in its lit tone.
const LOOKS={
 [STYLE.original]:{tone:1,exposure:.86,skyTop:0xbac8cd,skyHorizon:0xbac8cd,bands:0},
 [STYLE.toon]:{tone:2,exposure:1.7,skyTop:0x3f86d8,skyHorizon:0xbfe3f0,bands:0},
 [STYLE.stylised]:{tone:2,exposure:1,skyTop:0x5b8fd0,skyHorizon:0xf3d9bd,bands:0},
 [STYLE.graphic]:{tone:0,exposure:1,skyTop:0xa9cfe0,skyHorizon:0xf0e8d2,bands:1},
};
const MAX_REACH=6;

const FRAG=`
uniform sampler2D tColor;
uniform highp sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear, uFar, uStyle, uTone, uExposure, uInkW, uCreaseK, uSkyBands, uLogDepth, uOwnSky;
uniform vec2 uCreaseCut;
uniform vec3 uInkNavy, uInkBrown, uSkyTop, uSkyHorizon;
uniform mat4 uProjInv, uCamWorld;
varying vec2 vUv;
const vec3 G_INK = vec3(0.019, 0.016, 0.028);
${TOON_GRADE_GLSL}
${STYL_GRADE_GLSL}

float depthAt(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (d >= 1.0) return uFar;
  // (a logarithmic depth buffer, as the walk's: three writes log2(1 + w) / log2(far + 1))
  if (uLogDepth > 0.5) return min(uFar, exp2(d * log2(uFar + 1.0)) - 1.0);
  float ndc = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}
vec3 rayAt(vec2 uv) { vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return p.xyz / p.w; }
vec3 viewPos(vec2 uv, float z) { vec3 r = rayAt(uv); return r * (z / -r.z); }
// The surface's normal, rebuilt from depth: each axis from the side whose depth changes least, so a pixel on an edge
// takes its own face's slope and not the jump.
vec3 normalAt(vec2 uv) {
  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);
  vec3 P = viewPos(uv, depthAt(uv));
  vec3 L = viewPos(uv - tx, depthAt(uv - tx)), R = viewPos(uv + tx, depthAt(uv + tx));
  vec3 D = viewPos(uv - ty, depthAt(uv - ty)), U = viewPos(uv + ty, depthAt(uv + ty));
  vec3 hx = abs(R.z - P.z) < abs(P.z - L.z) ? R - P : P - L;
  vec3 hy = abs(U.z - P.z) < abs(P.z - D.z) ? U - P : P - D;
  return normalize(cross(hx, hy));
}
// A round brush of radius w, on the far side of every jump: this pixel is inked by any nearer pixel within reach whose
// depth stands off this one by more than the slope here explains (a grazing floor is not a wall).
float silhouette(vec2 uv, float dp, float w) {
  float dl = depthAt(uv - vec2(uTexel.x, 0.0)), dr = depthAt(uv + vec2(uTexel.x, 0.0));
  float dd = depthAt(uv - vec2(0.0, uTexel.y)), du = depthAt(uv + vec2(0.0, uTexel.y));
  float g = dp >= uFar ? 0.0 : length(vec2(min(abs(dr - dp), abs(dp - dl)), min(abs(du - dp), abs(dp - dd))));
  float cover = 0.0;
  for (int y = -${MAX_REACH}; y <= ${MAX_REACH}; y++) {
    for (int x = -${MAX_REACH}; x <= ${MAX_REACH}; x++) {
      vec2 o = vec2(float(x), float(y));
      float r = length(o);
      if (r < 0.5 || r > w + 1.0) continue;
      float dq = depthAt(uv + o * uTexel);
      if (dq >= uFar) continue;
      if (dp - dq > ${INK_JUMP} * dq + 2.5 * r * g + 0.02) cover = max(cover, 1.0 - smoothstep(w - 0.5, w + 0.5, r - 0.5));
    }
  }
  return cover;
}
// A one-pixel line where the surface turns sharply between this pixel and the next (right or up), on one surface.
float crease(vec2 uv, float dp) {
  if (dp >= uFar) return 0.0;
  vec3 n = normalAt(uv);
  float best = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 q = uv + (k == 0 ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y));
    float dq = depthAt(q);
    if (dq >= uFar || abs(dq - dp) > 0.03 * dp + 0.5) continue;
    float turn = acos(clamp(dot(n, normalAt(q)), -1.0, 1.0));
    best = max(best, smoothstep(uCreaseCut.x, uCreaseCut.y, turn));
  }
  return best * (1.0 - smoothstep(${CREASE_FADE[0].toFixed(1)}, ${CREASE_FADE[1].toFixed(1)}, dp));
}
vec3 skyAt(vec2 uv) {
  vec3 dir = normalize(mat3(uCamWorld) * rayAt(uv));
  float t = uSkyBands > 0.5 ? step(0.06, dir.y) : smoothstep(-0.1, 0.6, dir.y);
  return mix(uSkyHorizon, uSkyTop, t);
}
vec3 aces(vec3 color) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = IN * (color / 0.6);
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  return clamp(OUT * (a / b), 0.0, 1.0);
}
// Khronos PBR Neutral, as three's NeutralToneMapping: the palette shows as authored
vec3 neutral(vec3 color) {
  const float start = 0.8 - 0.04, desat = 0.15;
  float x = min(color.r, min(color.g, color.b));
  color -= x < 0.08 ? x - 6.25 * x * x : 0.04;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < start) return color;
  float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  color *= newPeak / peak;
  return mix(color, vec3(newPeak), 1.0 - 1.0 / (desat * (peak - newPeak) + 1.0));
}
vec3 toSRGB(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }

void main() {
  // The scene is drawn over a clear of alpha 0, so alpha is how much of the pixel the ship covers (an edge antialiased by
  // the target's samples, or a pane of glass against the sky): the ship's colour is graded alone and laid over the sky by it.
  vec4 t = texture2D(tColor, vUv);
  // (a scene that draws its own sky, as the walk's stars and haze, covers every pixel)
  float coverage = uOwnSky > 0.5 ? 1.0 : clamp(t.a, 0.0, 1.0);
  vec3 c = t.rgb / max(coverage, 1e-4);
  vec3 sky = skyAt(vUv);
  float dp = depthAt(vUv);
  bool toon = abs(uStyle - 1.0) < 0.5, graphic = uStyle > 2.5;
  float cover = 0.0;
  if (toon || graphic) cover = clamp(max(silhouette(vUv, dp, uInkW), crease(vUv, dp) * uCreaseK), 0.0, 1.0);
  vec3 paper = mix(sky, c, coverage);
  float l = dot(paper, vec3(0.2126, 0.7152, 0.0722));
  vec3 ink = graphic ? G_INK : mix(uInkNavy, uInkBrown, clamp((paper.r - paper.b) / (l + 0.05), 0.0, 1.0) * ${TOON_INK_WARM});
  c = mix(c, ink, cover);
  if (toon) c = toonGrade(c, cover);
  else if (abs(uStyle - 2.0) < 0.5) c = stylGrade(c, vUv);
  c *= uExposure;
  if (uTone > 1.5) c = neutral(c);
  else if (uTone > 0.5) c = aces(c);
  c = mix(mix(sky, ink, cover), c, coverage);
  gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
}`;

// `options`: logDepth for a renderer with a logarithmic depth buffer; ownSky for a scene that draws its own sky into the
// target; exposure, per style id, to retune a style's exposure for that scene's light.
export function createStyleFrame(renderer,{logDepth=false,ownSky=false,exposure={}}={}){
 const depthTexture=new T.DepthTexture(1,1,T.FloatType);
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4,depthTexture});
 const uniforms={
  tColor:{value:target.texture},tDepth:{value:depthTexture},uTexel:{value:new T.Vector2(1,1)},
  uNear:{value:1},uFar:{value:6000},uLogDepth:{value:logDepth?1:0},uOwnSky:{value:ownSky?1:0},uStyle:{value:0},uTone:{value:1},uExposure:{value:1},uInkW:{value:1},uCreaseK:{value:1},uSkyBands:{value:0},
  uCreaseCut:{value:new T.Vector2(...TOON_CREASE)},uInkNavy:{value:new T.Color(TOON_INK_NAVY)},uInkBrown:{value:new T.Color(TOON_INK_BROWN)},
  uSkyTop:{value:new T.Color()},uSkyHorizon:{value:new T.Color()},uProjInv:{value:new T.Matrix4()},uCamWorld:{value:new T.Matrix4()},
 };
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:FRAG});
 const quad=new T.Mesh(geometry,material),scene=new T.Scene(),camera=new T.Camera();quad.frustumCulled=false;scene.add(quad);
 return {
  target,
  // `width`, `height`: the panel's drawing-buffer pixels.
  setSize(width,height){if(target.width!==width||target.height!==height)target.setSize(width,height);uniforms.uTexel.value.set(1/width,1/height);},
  // Draws the frame for `style` into `viewport` (CSS pixels) of the canvas, from the scene already drawn into `target`.
  render(style,sceneCamera,viewport){
   const look=LOOKS[style],h=target.height,u=uniforms;
   u.uStyle.value=style;u.uTone.value=look.tone;u.uExposure.value=exposure[style]??look.exposure;u.uSkyBands.value=look.bands;
   u.uSkyTop.value.set(look.skyTop);u.uSkyHorizon.value.set(look.skyHorizon);
   u.uNear.value=sceneCamera.near;u.uFar.value=sceneCamera.far;u.uProjInv.value.copy(sceneCamera.projectionMatrixInverse);u.uCamWorld.value.copy(sceneCamera.matrixWorld);
   if(style===STYLE.graphic){u.uInkW.value=Math.min(MAX_REACH-1,Math.max(1,2*GRAPHIC_HW*h/720));u.uCreaseCut.value.set(...GRAPHIC_CREASE);u.uCreaseK.value=1;}
   else{const s=h/1080,w=k=>Math.max(TOON_INK[k].min,TOON_INK[k].px*s);u.uInkW.value=Math.min(MAX_REACH-1,w('prop'));u.uCreaseCut.value.set(...TOON_CREASE);u.uCreaseK.value=Math.min(1,w('crease'));}
   renderer.setRenderTarget(null);renderer.setViewport(viewport.x,viewport.y,viewport.w,viewport.h);renderer.setScissor(viewport.x,viewport.y,viewport.w,viewport.h);renderer.setScissorTest(true);
   renderer.render(scene,camera);renderer.setScissorTest(false);
  },
 };
}
