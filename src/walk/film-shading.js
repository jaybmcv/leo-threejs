// Voyager's Reach's Stylised 3D, as GLSL: the walk's film look (film-look.js) and the style lab (src/style-lab) both
// draw with these, so the look the lab previews is the look the walk ships.

const glf=n=>Number.isInteger(n)?`${n}.0`:String(n);

// Stylised 3D's surface art (stylised3d.ts STYL_WRAP and STYL_SURFACE_ART): the key light wraps past the terminator,
// the shade is the surface's own colour made richer, darks lift off black, a metal's colour is partly lit like paint.
export const STYL_WRAP=.25,STYL_FLOOR=[.028,.027,.03],STYL_LIFT_GONE=.1,STYL_METAL_PAINT=.6,STYL_INDIRECT_SAT=1.32;
export const STYL_SURFACE_GLSL=`const float STYL_WRAP = ${STYL_WRAP.toFixed(3)};
const vec3 STYL_ALB_FLOOR = vec3(${STYL_FLOOR.map(v=>v.toFixed(3)).join(', ')});
vec3 stylLift(vec3 c, vec3 lift) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c + lift * (1.0 - smoothstep(0.0, ${glf(STYL_LIFT_GONE)}, l));
}
vec3 stylSat(vec3 c, float s) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(vec3(0.0), vec3(l) + (c - vec3(l)) * s);
}
// the cosine the key light lights a form with: its tail runs past the terminator and eases in
float stylWrapNL(float x) {
  float w = clamp((x + STYL_WRAP) / (1.0 + STYL_WRAP), 0.0, 1.0);
  return w * w * (3.0 - 2.0 * w);
}
// richer and a little warm where light turns to shade, gone in full light and full dark
vec3 stylTerminator(vec3 alb, float x) {
  float band = smoothstep(-0.5, 0.05, x) * (1.0 - smoothstep(0.05, 0.75, x));
  return mix(alb, stylSat(alb, 1.55) * vec3(1.06, 0.97, 0.9), band * 0.75);
}`;

// The lines of three's diffuse lighting that Stylised 3D replaces (three 0.185).
export const THREE_DIFFUSE={
 physicalDirect:'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );',
 physicalIndirect:'vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );',
 lambertDirect:'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
 lambertIndirect:'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
 map:'diffuseColor *= sampledDiffuseColor;',
};
export const STYL_METAL_PAINT_GLSL=`material.specularColorBlended * ( ${glf(STYL_METAL_PAINT)} * material.metalness )`;

// Stylised 3D's grade (stylised3d.ts STYL_GRADE_GLSL), on linear light before the tone curve: vibrance that spares the
// light colours, a split tone (cool violet in the shade, warm cream in the light), the bright yellows and the emeralds
// held short of neon, a little more depth in the shade, a film's cool toe, and the frame staged toward shade at its
// corners and foot (`uv`, 0 to 1 across the frame from its lower left).
const S={lightSpare:[.5,1.5],yellow:{hue:[.55,.95],blue:[.1,.5],bright:[.3,.8],keep:.7},rich:{sat:[.6,.9],luma:[.03,.12]},green:[.25,.5],satCap:.7,
 shade:{keep:.92,window:[.02,.22]},toe:{lift:[.018,.022,.038],window:[0,.05]},stage:{corner:.15,foot:.08}};
const ss=(w,x)=>`smoothstep(${w[0].toFixed(2)}, ${w[1].toFixed(2)}, ${x})`;
export const STYL_GRADE_GLSL=`
vec3 stylGrade(vec3 color, vec2 uv) {
  float gl = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float gMax = max(color.r, max(color.g, color.b));
  float gSat = (gMax - min(color.r, min(color.g, color.b))) / max(gMax, 1e-4);
  float gk = mix(1.5, 0.94, smoothstep(0.22, 0.7, gSat));
  gk = mix(gk, 1.0, ${ss(S.lightSpare,'gl')});
  vec3 graded = max(vec3(0.0), vec3(gl) + (color - vec3(gl)) * gk);
  graded *= mix(vec3(0.965, 0.985, 1.045), vec3(1.025, 1.005, 0.975), smoothstep(0.03, 0.45, gl));
  float gYellow = ${ss(S.yellow.hue,'min(color.r, color.g) / max(max(color.r, color.g), 1e-4)')} * (1.0 - ${ss(S.yellow.blue,'color.b / max(gMax, 1e-4)')});
  float gHot = ${ss(S.yellow.bright,'gl')} * gYellow;
  float gRich = ${ss(S.rich.sat,'gSat')} * ${ss(S.rich.luma,'gl')};
  float gGreen = ${ss(S.green,'(color.g - max(color.r, color.b)) / max(color.g, 1e-4)')} * gRich;
  float gl2 = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  float gmx = max(graded.r, max(graded.g, graded.b));
  float gsG = (gmx - min(graded.r, min(graded.g, graded.b))) / max(gmx, 1e-4);
  float gCap = 1.0 - max(gsG - ${S.satCap.toFixed(2)}, 0.0) / max(gsG, 1e-4);
  graded = vec3(gl2) + (graded - vec3(gl2)) * mix(1.0, ${S.yellow.keep.toFixed(2)}, gHot) * mix(1.0, gCap, gGreen);
  graded *= mix(${S.shade.keep.toFixed(2)}, 1.0, ${ss(S.shade.window,'dot(graded, vec3(0.2126, 0.7152, 0.0722))')});
  graded += vec3(${S.toe.lift.map(v=>v.toFixed(3)).join(', ')}) * (1.0 - ${ss(S.toe.window,'gl')});
  vec2 gq = (uv - 0.5) * vec2(1.0, 1.1);
  graded *= 1.0 - ${S.stage.corner.toFixed(2)} * smoothstep(0.08, 0.5, dot(gq, gq)) - ${S.stage.foot.toFixed(2)} * (1.0 - smoothstep(0.0, 0.4, uv.y));
  return graded;
}`;
