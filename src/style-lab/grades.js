// The frame grades of the style lab, ported from Voyager's Reach and run on the finished frame in linear light, before
// the tone curve. Both are the daytime grades: Leo has no night or golden hour, so Reach's night and low-sun terms are
// left out (they are 0 at noon there too).

// Bold Ink Toon's palette (toonGrade.ts): warm whites, terracotta, cobalt and pine green. Vibrance lifts dull colours
// and eases vivid ones; greens lean pine, reds clay, blues cobalt; the shade leans cool and the light warm; nothing is
// black. `inkShare` is how much of the pixel is a line, which keeps the darkness it was drawn with.
const G={
 vibrance:{lift:1.36,liftSat:[.04,.24],ease:.72,easeSat:[.45,.92]},
 olive:{cut:.12},
 terracotta:{redLift:1.1,green:.25,blue:.11,share:.85},
 darkLift:{gamma:.86,share:.75,depthKeep:.5},
};
export const TOON_GRADE_GLSL=`
vec3 toonGrade(vec3 c, float inkShare) {
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  float l = dot(c, LUMA);
  float cMax = max(c.r, max(c.g, c.b));
  float cSat = (cMax - min(c.r, min(c.g, c.b))) / max(cMax, 1e-4);
  float gain = mix(1.0, ${G.vibrance.lift.toFixed(2)}, smoothstep(${G.vibrance.liftSat[0].toFixed(2)}, ${G.vibrance.liftSat[1].toFixed(2)}, cSat)) * mix(1.0, ${G.vibrance.ease.toFixed(2)}, smoothstep(${G.vibrance.easeSat[0].toFixed(2)}, ${G.vibrance.easeSat[1].toFixed(2)}, cSat));
  c = max(vec3(0.0), l + (c - l) * gain);
  // a neutral that is not light (concrete, a grey panel) leans cool: the palette has warm whites and cobalt, no grey
  c *= mix(vec3(1.0), vec3(0.92, 0.975, 1.10), (1.0 - smoothstep(0.03, 0.14, cSat)) * smoothstep(0.015, 0.12, l) * (1.0 - smoothstep(0.25, 0.60, l)) * 0.8);
  float gm = smoothstep(0.0, 0.12, c.g - max(c.r, c.b));
  float rm = smoothstep(0.0, 0.14, c.r - max(c.g, c.b));
  float bm = smoothstep(0.0, 0.12, c.b - max(c.r, c.g));
  c *= mix(vec3(1.0), vec3(0.93, 1.0, 0.90), gm * 0.55);
  float yg = smoothstep(0.0, 0.10, c.g - c.b) * (1.0 - smoothstep(0.0, 0.08, c.r - c.g));
  c.r *= 1.0 - ${G.olive.cut.toFixed(2)} * yg;
  float gv = gm * smoothstep(0.30, 0.75, c.g);
  c *= mix(vec3(1.0), vec3(0.90, 0.92, 1.10), gv * 0.6);
  c *= mix(vec3(1.0), vec3(1.05, 0.92, 0.86), rm * 0.5);
  // a crimson or a magenta is turned to terracotta
  float redShare = (c.r - max(c.g, c.b)) / max(c.r, 1e-4);
  float wine = smoothstep(0.5, 0.8, redShare) * smoothstep(0.02, 0.10, (c.b - c.g) / max(c.r, 1e-4));
  float terra = c.r * (1.0 + ${G.terracotta.redLift.toFixed(1)} * wine);
  c = mix(c, vec3(terra, ${G.terracotta.green.toFixed(2)} * terra, ${G.terracotta.blue.toFixed(2)} * terra), wine * ${G.terracotta.share.toFixed(2)});
  c *= mix(vec3(1.0), vec3(0.86, 0.95, 1.12), bm * 0.55);
  // the darks are lifted a little, so a wide dark pad still reads as a colour; a saturated dark keeps its depth
  float depthKeep = smoothstep(0.12, 0.40, cSat) * (1.0 - smoothstep(0.05, 0.16, l));
  float liftK = ${G.darkLift.share.toFixed(2)} * (1.0 - inkShare) * mix(1.0, ${G.darkLift.depthKeep.toFixed(1)}, depthKeep);
  c = mix(c, pow(max(c, vec3(0.0)), vec3(${G.darkLift.gamma.toFixed(2)})), liftK);
  // split tone: cool cobalt in the shade, warm white in the light
  float sh = 1.0 - smoothstep(0.012, 0.28, l);
  float hl = smoothstep(0.30, 1.1, l);
  c *= mix(vec3(1.0), vec3(0.94, 0.97, 1.06), sh * 0.6);
  c *= mix(vec3(1.0), vec3(1.05, 1.015, 0.95), hl * 0.75);
  // shadows are ink-blue, never black
  c += vec3(0.0075, 0.0105, 0.026) * (1.0 - smoothstep(0.0, 0.05, l)) * (1.0 - inkShare);
  return c;
}`;

// Stylised 3D's grade is the walk's film look's own (src/walk/film-shading.js).
export {STYL_GRADE_GLSL} from '../walk/film-shading.js';
