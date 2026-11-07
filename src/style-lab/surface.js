import * as T from 'three';
import {GRAPHIC_SURFACE_GLSL,pagePaintFor} from './graphic.js';
import {STYL_SURFACE_GLSL,STYL_INDIRECT_SAT,STYL_METAL_PAINT_GLSL,THREE_DIFFUSE} from '../walk/film-shading.js';

// The style lab's surface terms: Voyager's Reach's Bold Ink Toon, Stylised 3D and graphic novel styles, ported onto
// Leo's own materials. Every material is patched once and the style is one uniform (uLabStyle), so switching styles
// never recompiles; at 0 a patched shader computes exactly what Leo's viewer draws.
//   toon       two flat tones to a surface, a hard edge between them where the sun's N.L and its shadow put it; the lit
//              tone opened upward by the toon's lit gain (toonTones.ts CEL_LIT_GAIN), the shade a cool cobalt of it
//   stylised   three's own lighting with the animated-film terms (stylised3d.ts): the key light wraps past the
//              terminator, the shade is the surface's own colour made richer, darks lift off black, normal maps and
//              texture grain are softened, a metal's colour is partly lit like paint
//   graphic    ligne claire (graphicShading.ts): the colour snapped to the page's palette, three flat values (lit, a
//              face the sun only grazes, shade), and shade crossed with world-anchored ink hatching
// The ink lines and the frame grades are the frame pass's (frame.js).
export const STYLE={original:0,toon:1,stylised:2,graphic:3};

export const labUniforms={
 uLabStyle:{value:0},
 // drawing-buffer height / 720: the graphic hatching is set in pixels at 720, as Reach's is
 uLabPx:{value:1},
 // one period of the graphic hatching's slicing plane, in metres: the ship seen whole wants it wide, a room close
 uLabHatchM:{value:1.5},
 // how the toon finds its tones: 0 from the key light (the sun on the hull), 1 from all the light a surface gets, cut
 // into flat bands (a room lit by its lamps, where the key is a dim fill: a lamp's pool is a band of its own)
 uLabLightBands:{value:0},
};

const glf=n=>Number.isInteger(n)?`${n}.0`:String(n);
// The toon's lit tone (toonTones.ts), and its shade as a share of it: two flat colours a step apart, however strong the
// light is (the sun on the hull, or a room's soft key).
const TOON_LIT_GAIN=1.22,TOON_SHADE=.5;
// The banded toon's step between flat tones, in stops (the key-light toon's shade is one stop under its lit tone).
const TOON_BAND_STOPS=1.25;

const PARS=`
uniform float uLabStyle;
uniform float uLabPx;
uniform float uLabHatchM;
uniform float uLabLightBands;
varying vec3 vLabWp;
#define LAB_TOON ( abs( uLabStyle - 1.0 ) < 0.5 )
#define LAB_STYL ( abs( uLabStyle - 2.0 ) < 0.5 ? 1.0 : 0.0 )
#define LAB_GRAPHIC ( uLabStyle > 2.5 )
// the key light's shadow at this fragment (lights_fragment_begin, patched below), and a scratch for each light's
float labSunShadow = 1.0;
float labShadowTap = 1.0;
${STYL_SURFACE_GLSL}
${GRAPHIC_SURFACE_GLSL}`;

// The flat tones, after the lights are declared: one sun (the key light, the only shadow caster, so the first
// directional light) and an ambient that does not turn with the normal, so a tone is one flat colour.
const FLAT_PARS=`
// The toon by all the light a surface gets (three's own, lamps and all): its strength cut into flat bands a step of
// TOON_BAND_STOPS apart with a hard edge between them, its colour kept, so a lamp's pool is a warm flat patch on a
// cooler, darker one.
vec3 labToonBands(vec3 alb, vec3 diffuseLight, vec3 emissive) {
  vec3 light = diffuseLight / max(alb, vec3(0.03));
  float level = max(dot(light, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
  float x = log2(level) / ${TOON_BAND_STOPS.toFixed(2)};
  float aa = max(fwidth(x), 1e-3);
  float band = floor(x) + smoothstep(1.0 - aa, 1.0, fract(x));
  return alb * (light / level) * exp2(band * ${TOON_BAND_STOPS.toFixed(2)}) * ${TOON_LIT_GAIN.toFixed(2)} + emissive;
}
#if NUM_DIR_LIGHTS > 0
vec3 labFlatAmbient() {
  vec3 a = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    a += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, 0.7);
  #endif
  return a;
}
float labSunLit(vec3 n, out float face, out float nl) {
  nl = dot(n, directionalLights[0].direction);
  float aa = max(fwidth(nl), 1e-3);
  face = smoothstep(-aa, aa, nl);
  return face * smoothstep(0.35, 0.65, labSunShadow);
}
vec3 labToon(vec3 alb, vec3 n, vec3 emissive) {
  float face, nl;
  float lit = labSunLit(n, face, nl);
  vec3 litTone = alb * (directionalLights[0].color + labFlatAmbient()) * RECIPROCAL_PI * ${TOON_LIT_GAIN.toFixed(2)};
  vec3 shadeTone = litTone * ${TOON_SHADE.toFixed(2)} * vec3(0.80, 0.88, 1.10);
  return mix(shadeTone, litTone, lit) + emissive;
}
vec3 labGraphic(vec3 alb, vec3 n, vec3 emissive) {
  float face, nl;
  float lit = labSunLit(n, face, nl);
  return graphicFinish(labSnap(alb), nl, face, lit, vLabWp) + emissive * 0.5;
}
#endif`;

// three's diffuse lighting with the Stylised 3D wrap and richer shade (stylised3d.ts DIRECT_STYL / INDIRECT_STYL),
// each left as three wrote it when the style is not on.
const DIRECT_STYL=(albedo,paint='vec3( 0.0 )')=>`{
    vec3 stylIrr = irradiance;
    vec3 stylAlb = ${albedo};
    if ( LAB_STYL > 0.0 ) {
      float stylNL = dot( geometryNormal, directLight.direction );
      stylIrr = directLight.color * stylWrapNL( stylNL );
      stylAlb += ${paint};
      stylAlb = stylTerminator( stylAlb, stylNL );
      stylAlb = stylLift( stylAlb, STYL_ALB_FLOOR );
    }
    reflectedLight.directDiffuse += stylIrr * BRDF_Lambert( stylAlb );
  }`;
const INDIRECT_STYL=(albedo,paint='vec3( 0.0 )')=>`vec3 stylAlbI = ${albedo};
	if ( LAB_STYL > 0.0 ) {
		stylAlbI += ${paint};
		stylAlbI = stylLift( stylSat( stylAlbI, ${glf(STYL_INDIRECT_SAT)} ), STYL_ALB_FLOOR );
	}`;
const METAL_PAINT=STYL_METAL_PAINT_GLSL;

// A line of three's text, swapped; a three without it fails loudly here rather than drawing the wrong style.
function swap(text,from,to,label){
 if(!text.includes(from))throw new Error(`Style lab: three's ${label} has changed; the patch needs updating`);
 return text.replace(from,to);
}
const C=T.ShaderChunk;
const PHYSICAL_PARS=(()=>{
 const s=swap(C.lights_physical_pars_fragment,THREE_DIFFUSE.physicalDirect,DIRECT_STYL('material.diffuseContribution',METAL_PAINT),'physical direct diffuse');
 return swap(s,THREE_DIFFUSE.physicalIndirect,`${INDIRECT_STYL('material.diffuseContribution',METAL_PAINT)}
	vec3 diffuse = irradiance * BRDF_Lambert( stylAlbI );`,'physical indirect diffuse');
})();
const LAMBERT_PARS=(()=>{
 const s=swap(C.lights_lambert_pars_fragment,THREE_DIFFUSE.lambertDirect,DIRECT_STYL('material.diffuseColor'),'lambert direct diffuse');
 return swap(s,THREE_DIFFUSE.lambertIndirect,`${INDIRECT_STYL('material.diffuseColor')}
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( stylAlbI );`,'lambert indirect diffuse');
})();
// The key light's shadow, kept for the flat styles as well as applied (it is the first directional light: three puts
// shadow casters first, and the key is the only one).
const LIGHTS_BEGIN=swap(C.lights_fragment_begin,
 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
 `labShadowTap = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		directLight.color *= labShadowTap;
		if ( UNROLLED_LOOP_INDEX == 0 ) labSunShadow = labShadowTap;`,'directional shadow');
// Texture grain: Stylised 3D reads three mips down (its broad colour), the flat styles two (markings stay, grain goes).
const MAP=swap(C.map_fragment,THREE_DIFFUSE.map,`if ( uLabStyle > 0.5 ) {
		vec3 labBroad = texture2D( map, vMapUv, LAB_STYL > 0.0 ? 3.0 : 2.0 ).rgb;
		sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, labBroad, LAB_STYL > 0.0 ? 0.8 : 1.0 );
	}
	diffuseColor *= sampledDiffuseColor;`,'map read');
// A normal map bends the light less in Stylised 3D, and not at all in the flat styles (big simple shapes).
const NORMAL_SOFTEN=`
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_NORMALMAP_OBJECTSPACE ) || defined( USE_BUMPMAP )
  if ( uLabStyle > 0.5 ) normal = normalize( mix( normal, nonPerturbedNormal, LAB_STYL > 0.0 ? 0.65 : 1.0 ) );
#endif`;
const FLAT_OVERRIDE=`
  if ( LAB_TOON && uLabLightBands > 0.5 ) outgoingLight = labToonBands( diffuseColor.rgb, reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, totalEmissiveRadiance );
#if NUM_DIR_LIGHTS > 0
  else if ( LAB_TOON ) outgoingLight = labToon( diffuseColor.rgb, normal, totalEmissiveRadiance );
  else if ( LAB_GRAPHIC ) outgoingLight = labGraphic( diffuseColor.rgb, normal, totalEmissiveRadiance );
#endif`;
const WORLD_POSITION=`
vec4 labWp = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  labWp = batchingMatrix * labWp;
#endif
#ifdef USE_INSTANCING
  labWp = instanceMatrix * labWp;
#endif
vLabWp = ( modelMatrix * labWp ).xyz;`;

function patchShader(shader,material){
 const page=pagePaintFor(material.name);
 Object.assign(shader.uniforms,labUniforms,{uLabPage:{value:new T.Vector3(...(page??[-1,-1,-1]))}});
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLabWp;').replace('#include <project_vertex>',`#include <project_vertex>${WORLD_POSITION}`);
 shader.fragmentShader=shader.fragmentShader
  .replace('#include <common>',`#include <common>${PARS}`)
  .replace('#include <lights_pars_begin>',`#include <lights_pars_begin>${FLAT_PARS}`)
  .replace('#include <lights_physical_pars_fragment>',PHYSICAL_PARS)
  .replace('#include <lights_lambert_pars_fragment>',LAMBERT_PARS)
  .replace('#include <lights_fragment_begin>',LIGHTS_BEGIN)
  .replace('#include <map_fragment>',MAP)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>${NORMAL_SOFTEN}`)
  .replace('#include <opaque_fragment>',`${FLAT_OVERRIDE}\n#include <opaque_fragment>`);
}

// Patches every lit material under `root` once (shared materials are shared programs), except those of `keep`: a cat
// keeps the colours it was drawn in, as Reach's cats do (the frame still inks and grades it).
export function patchStyleMaterials(root,keep=null){
 let count=0;const kept=new Set();
 keep?.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>kept.add(m));});
 root.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(m.userData.styleLab||kept.has(m)||!(m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial))continue;
   // (a material's own patch runs first and keeps its own program key: the walk's materials have both)
   const before=m.onBeforeCompile,beforeKey=m.customProgramCacheKey.bind(m);
   m.onBeforeCompile=(shader,renderer)=>{before?.call(m,shader,renderer);patchShader(shader,m);};
   m.customProgramCacheKey=()=>`leo-style-lab-1|${beforeKey()}`;
   m.userData.styleLab=true;m.needsUpdate=true;count++;
  }
 });
 return count;
}
