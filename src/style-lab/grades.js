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

// Stylised 3D's grade (stylised3d.ts STYL_GRADE_GLSL): vibrance that spares the light colours, a split tone (cool
// violet in the shade, warm cream in the light), the bright yellows and the emeralds held short of neon, a little more
// depth in the shade, a film's cool toe, and the frame staged toward shade at its corners and foot.
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
