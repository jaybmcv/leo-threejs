import type { SeatedVariant, PlayerStance } from './worldCore.js';
// What the body is doing this frame, as angles — the whole of the avatar's
// animation, and none of its geometry. Pure numbers in, pure numbers out, so
// it can be reasoned about and tested without a renderer (test/gait.test.ts);
// avatar.ts is the only thing that knows which bone each channel lands on.
//
// The rules it is built on, which are what separate a walk from a puppet:
//   · the stride is measured in DISTANCE, so the feet never skate;
//   · nothing is ever straight — a locked knee or elbow reads as a mannequin;
//   · the pelvis and the chest turn OPPOSITE ways, which is the single
//     strongest cue that a body is walking rather than sliding;
//   · every limb has a hinge below it that lags what drives it;
//   · a body at rest is still breathing.
//
// Sign conventions, all radians, all in the figure's own frame:
//   swing   + is BACKWARD (a limb hanging at 0 swings back positive)
//   knee    + folds the heel toward the rump; elbow + folds hand to shoulder
//   lateral + is the figure's own RIGHT
//   turn    + turns toward the figure's own LEFT
//   roll    + drops the figure's RIGHT side

export interface PoseFrame {
  // the body as a whole
  bob: number; // metres, up
  sway: number; // metres, to its right
  lean: number; // pitch, forward positive
  bank: number; // roll into a turn
  // pelvis
  hipRoll: number; // + drops the right hip
  hipTurn: number; // + brings the left hip forward
  // spine, shared out along the chain
  spinePitch: number; // + folds forward
  spineTurn: number; // + turns the chest to its left
  spineBend: number; // + bends toward its right
  // neck and head
  headPitch: number; // + tips the face down
  headTurn: number;
  headRoll: number;
  // legs
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  ankleL: number; // + points the toes down
  ankleR: number;
  toeL: number; // + bends the toes up off the ground
  toeR: number;
  legSpread: number;
  // arms
  shoulderL: number; // the blade: + lifts and comes forward
  shoulderR: number;
  armL: number;
  armR: number;
  armSpreadL: number;
  armSpreadR: number;
  elbowL: number;
  elbowR: number;
  handL: number; // wrist, + folds down
  handR: number;
  // tail
  tailLift: number; // + raises the base
  tailTurn: number; // + swings it to the figure's left
  tailWave: number; // amplitude of the travelling wave
  tailPhase: number;
  // 0..1, how much of a walk this is — the tail and the ears read it
  moving: number;
}

export interface GaitInput {
  speedMs: number; // horizontal
  grounded: boolean;
  swimming: boolean;
  submerged: boolean;
  seated: boolean;
  seatedVariant?: SeatedVariant;
  stance?: PlayerStance;
  jumpCount?: number;
  jumpS?: number;
  dip: number; // 0..1, the landing crouch (playMode's spring)
  turnRate: number; // rad/s, + turning to its left
  accelMs2: number; // along the direction of travel
  riseMs: number; // vertical velocity
  dt: number;
  // the longest step taken whole (AvatarPose.stepMax); an ordinary one is
  // held to a twentieth of a second
  stepMax?: number;
}

const KEYS: Array<keyof PoseFrame> = [
  "bob", "sway", "lean", "bank", "hipRoll", "hipTurn",
  "spinePitch", "spineTurn", "spineBend", "headPitch", "headTurn", "headRoll",
  "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "toeL", "toeR", "legSpread",
  "shoulderL", "shoulderR", "armL", "armR", "armSpreadL", "armSpreadR",
  "elbowL", "elbowR", "handL", "handR",
  "tailLift", "tailTurn", "tailWave", "tailPhase", "moving",
];

export function zeroFrame(): PoseFrame {
  const f = {} as PoseFrame;
  for (const k of KEYS) f[k] = 0;
  return f;
}

function mix(a: PoseFrame, b: PoseFrame, t: number): PoseFrame {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const out = {} as PoseFrame;
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Toward a target at a limited rate — how a state change is worn.
function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

const SEAT_BLEND_S = 0.22;
const SWIM_BLEND_S = 0.28;
// Leaving the ground is worn a little slower than arriving on it, and the
// landing is not instant either: legs that snap from a fall into a stride
// are the one thing that reads worse than legs that do not move at all.
const AIR_BLEND_S = 0.14;
const LAND_BLEND_S = 0.16;

// A smooth bump around one point of the cycle: 1 at `centre`, falling away
// over roughly `width` radians and back to almost nothing on the far side.
// Periodic by construction, so a curve built from these can never step.
function bump(phase: number, centre: number, width: number): number {
  const k = 1 / (width * width);
  return Math.exp(k * (Math.cos(phase - centre) - 1));
}

// Stance takes longer than swing — about six tenths of the cycle — so the
// leg goes back slowly and comes forward quickly. Warping the phase gives
// that asymmetry without a second curve for each joint.
function stanceWarp(phase: number): number {
  return phase + 0.22 * Math.sin(phase);
}

// A second-order follow: it reaches its target through its own momentum, so
// what it drives arrives late and settles rather than snapping. This is the
// whole of the avatar's secondary motion.
class Spring {
  value = 0;
  private vel = 0;
  constructor(
    private readonly k: number,
    private readonly damp: number,
  ) {}
  // An ordinary step takes at most a thirtieth of a second of dt; `whole`
  // takes all of it, in thirtieths (a distant cat posed every few frames
  // hands on the time between, remotePlayers.ts).
  step(target: number, dt: number, whole = false): number {
    const n = whole ? Math.max(1, Math.ceil(dt * 30 - 1e-9)) : 1;
    const h = whole ? dt / n : Math.min(dt, 1 / 30);
    for (let i = 0; i < n; i++) {
      this.vel += ((target - this.value) * this.k - this.vel * this.damp) * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
  reset(v = 0): void {
    this.value = v;
    this.vel = 0;
  }
}

// --- the walk ---------------------------------------------------------------

// Hip to toe on the figure, metres — MEASURED on the Mars Cat rig, not
// assumed from a human: its legs fold into a cat's hock, so the toe is
// 0.60 m from the hip while sitting only 0.19 m below it. This number and
// STANCE_SHARE together decide whether a planted foot stays planted, and
// getting it 15% wrong is 15% of skating.
const LEG_REACH_M = 0.6;
// The share of the cycle a foot spends on the ground. Everything about the
// stride is sized from this: it is what the phase advance has to agree with
// for a planted foot to actually stay planted. A walk keeps a foot down for
// most of the cycle; a RUN cannot — the ground it has to cover in one stance
// is more than a leg that length can reach, and the way out is the way a
// real run takes it: a flight phase, with neither foot down for a third of
// the cycle. Without this the feet skate through every sprint.
const WALK_STANCE = 0.62;
const RUN_STANCE = 0.42;
// How far the body drops for a given spread of the legs — the geometry of
// the figure, not a taste: MEASURED against the Mars Cat rig by walking it
// and watching the lowest point of the toe against the ground.
const BOB_PER_SPREAD = 0.42;
// The legs will not churn faster than this whatever the ground demands, so
// that a body outrunning its own legs slips a little instead of strobing.
const MAX_CYCLES_S = 3.6;

const WALK_MS = 4.5;
const RUN_MS = 7.5;

interface GaitTuning {
  hip: number;
  kneeSwing: number;
  kneeStance: number;
  ankleStrike: number;
  anklePush: number;
  toePush: number;
  arm: number;
  elbowBase: number;
  elbowSwing: number;
  shoulder: number;
  bob: number;
  sway: number;
  hipRoll: number;
  hipTurn: number;
  lean: number;
}

const WALK: GaitTuning = {
  hip: 0.7,
  kneeSwing: 1.05,
  kneeStance: 0.22,
  ankleStrike: -0.14,
  anklePush: 0.45,
  toePush: 0.35,
  arm: 0.32,
  elbowBase: 0.34,
  elbowSwing: 0.34,
  shoulder: 0.05,
  bob: 0.022,
  sway: 0.03,
  hipRoll: 0.055,
  hipTurn: 0.07,
  lean: 0.07,
};

const RUN: GaitTuning = {
  hip: 0.85,
  kneeSwing: 1.75,
  kneeStance: 0.42,
  ankleStrike: -0.18,
  anklePush: 0.62,
  toePush: 0.5,
  arm: 0.7,
  elbowBase: 1.05,
  elbowSwing: 0.45,
  shoulder: 0.1,
  bob: 0.05,
  sway: 0.02,
  hipRoll: 0.075,
  hipTurn: 0.14,
  lean: 0.2,
};

function blendTuning(t: number): GaitTuning {
  const out = {} as GaitTuning;
  for (const k of Object.keys(WALK) as Array<keyof GaitTuning>) out[k] = lerp(WALK[k], RUN[k], t);
  return out;
}

// How far the body travels in one cycle at this gait — the distance the
// planted foot sweeps under it, which is the arc the hip turns through
// during stance. Get this wrong and the feet skate, however good the
// curves look.
export function cycleMetres(hipAmp: number, stance = WALK_STANCE): number {
  // the CHORD the foot sweeps, not the arc: what the ground sees of a leg
  // swinging through 2·hipAmp is its horizontal span
  return (2 * LEG_REACH_M * Math.sin(hipAmp)) / stance;
}

// The hip through one cycle, as a share of the amplitude: -1 fully forward
// at the plant, +1 fully back at toe-off. Through STANCE it moves at a
// CONSTANT rate — that is the whole trick, because a foot on the ground has
// to travel backwards exactly as fast as the body travels forwards. The
// swing back to the front is a Hermite that leaves and arrives at the same
// rate, so there is no corner where the foot lifts, and it overshoots each
// end by a few per cent, which is the leg trailing after toe-off and
// reaching before the plant.
function hipCurve(u: number, stance: number): number {
  if (u < stance) return -1 + (2 * u) / stance;
  const t = (u - stance) / (1 - stance);
  const m = (2 / stance) * (1 - stance);
  const t2 = t * t;
  const t3 = t2 * t;
  return 4 * t3 - 6 * t2 + 1 + m * (2 * t3 - 3 * t2 + t);
}

// A bump placed by where it happens IN THE CYCLE rather than in radians:
// every one of these is a moment of the step, and reads better named that way.
function at(u: number, centre: number, width: number): number {
  return bump(u * TAU, centre * TAU, width * TAU);
}

// One leg's worth of the cycle. Phase 0 is the moment this foot plants.
function leg(f: PoseFrame, side: "L" | "R", phase: number, g: GaitTuning, amp: number, stance: number): void {
  const u = phase / TAU;
  const hip = hipCurve(u, stance) * g.hip * amp;
  // Knee: a small give just after the foot lands, taking the weight, and a
  // deep fold through the swing so the foot clears the ground.
  const knee = (at(u, 0.12, 0.13) * g.kneeStance + at(u, 0.72, 0.25) * g.kneeSwing) * amp;
  // Ankle: toes up at the strike, a hard push off the back at toe-off, and
  // up again through the swing so the toe does not catch.
  const ankle =
    (g.ankleStrike * at(u, 0.02, 0.1) +
      g.anklePush * at(u, 0.55, 0.1) +
      g.ankleStrike * 0.7 * at(u, 0.78, 0.14)) *
    amp;
  const toe = g.toePush * at(u, 0.6, 0.07) * amp;
  if (side === "L") {
    f.hipL = hip;
    f.kneeL = knee;
    f.ankleL = ankle;
    f.toeL = toe;
  } else {
    f.hipR = hip;
    f.kneeR = knee;
    f.ankleR = ankle;
    f.toeR = toe;
  }
}

// The arm over this leg. It runs on the leg's own curve, negated, so the
// opposition holds by construction whatever the walk does; the elbow folds
// most as the hand comes forward, which is what stops an arm reading as a
// stick swinging from a shoulder.
function arm(f: PoseFrame, side: "L" | "R", phase: number, g: GaitTuning, amp: number, stance: number): void {
  const c = -hipCurve(phase / TAU, stance);
  const swing = c * g.arm * amp;
  const elbow = (g.elbowBase + g.elbowSwing * Math.max(0, -c)) * amp;
  const blade = c * g.shoulder * amp;
  if (side === "L") {
    f.armL = swing;
    f.elbowL = elbow;
    f.shoulderL = blade;
  } else {
    f.armR = swing;
    f.elbowR = elbow;
    f.shoulderR = blade;
  }
}

// --- the poser --------------------------------------------------------------

export class Poser {
  private phase = 0;
  private tailPhase = 0;
  private clock = 0;
  private airFrame = zeroFrame();
  private airTime = 0; // seconds since the feet left the ground
  // A state change is worn over a moment, never in a frame: boarding a car
  // or breaking the surface would otherwise snap every joint at once.
  private seatW = 0;
  private swimW = 0;
  private airW = 0;
  // The speed the BODY believes in. A remote player's speed is measured from
  // the poses that reach us and can step; a body cannot, so this eases.
  private speed = 0;
  private readonly bankSpring = new Spring(90, 15);
  private readonly leanSpring = new Spring(70, 14);
  private readonly headTurnSpring = new Spring(55, 13);
  private readonly headPitchSpring = new Spring(60, 14);
  private readonly tailTurnSpring = new Spring(40, 9);
  private readonly tailLiftSpring = new Spring(45, 10);
  private readonly handSpring = new Spring(120, 16);
  // the hands trail what the elbows do, so a swing ends with a small flick
  private lastElbow = 0;

  // Put the cycle back where a body that has just stood up starts from.
  reset(): void {
    this.phase = 0;
    this.airTime = 0;
    this.airFrame = zeroFrame();
    this.seatW = 0;
    this.swimW = 0;
    this.airW = 0;
    this.speed = 0;
    for (const s of [
      this.bankSpring,
      this.leanSpring,
      this.headTurnSpring,
      this.headPitchSpring,
      this.tailTurnSpring,
      this.tailLiftSpring,
      this.handSpring,
    ]) {
      s.reset();
    }
  }

  step(input: GaitInput): PoseFrame {
    const dt = Math.min(input.dt, input.stepMax ?? 1 / 20);
    this.clock += dt;
    // and it changes gear over about a fifth of a second: a body breaking
    // into a run does not swap gaits between two frames
    this.speed += (input.speedMs - this.speed) * Math.min(1, dt * 8);
    const moving = clamp(this.speed / WALK_MS, 0, 1);
    const runShare = smoothstep(WALK_MS * 0.85, RUN_MS, this.speed);
    const g = blendTuning(runShare);

    // The cycle advances with ground covered, never with time: this is why
    // the feet stay put under a body that changes speed.
    const cycle = cycleMetres(g.hip, lerp(WALK_STANCE, RUN_STANCE, runShare));
    if (input.grounded && !input.swimming) {
      const cycles = Math.min(input.speedMs / cycle, MAX_CYCLES_S);
      this.phase = (this.phase + TAU * cycles * dt) % TAU;
    }
    this.tailPhase += dt * (2.2 + moving * 6);
    this.airTime = input.grounded ? 0 : this.airTime + dt;

    this.seatW = approach(this.seatW, input.seated ? 1 : 0, dt / SEAT_BLEND_S);
    this.swimW = approach(this.swimW, input.swimming ? 1 : 0, dt / SWIM_BLEND_S);
    // a single frame's worth of air is a bump in the ground, not a jump
    const wantAir = this.airTime > 0.02 ? 1 : 0;
    this.airW = approach(this.airW, wantAir, dt / (wantAir === 1 ? AIR_BLEND_S : LAND_BLEND_S));
    let frame = mix(input.stance && input.stance !== "stand" ? movementPose(input.stance, this.phase / TAU, moving) : this.walk(input, moving, runShare, g), this.air(input), this.airW);
    if (this.swimW > 0) frame = mix(frame, this.swim(input, moving), this.swimW);
    if (this.seatW > 0) frame = mix(frame, this.seated(input, moving), this.seatW);

    this.wear(frame, input, moving, runShare);
    frame.tailPhase = this.tailPhase;
    frame.moving = moving;
    return frame;
  }

  // Everything that is true whatever the body is doing: the lean it carries,
  // the roll it takes into a turn, the head that holds its own gaze, the
  // hands that trail the arms, the tail that answers all of it.
  private wear(f: PoseFrame, input: GaitInput, moving: number, runShare: number): void {
    const dt = Math.min(input.dt, input.stepMax ?? 1 / 20);
    const whole = input.stepMax !== undefined;
    // Into the turn like a runner, and forward against what it is asking of
    // its legs: both arrive through a spring, so neither snaps on.
    const bank = this.bankSpring.step(clamp(input.turnRate * 0.1, -0.26, 0.26) * moving, dt, whole);
    const lean = this.leanSpring.step(f.lean + clamp(input.accelMs2 * 0.012, -0.1, 0.16), dt, whole);
    f.bank += bank;
    f.lean = lean;
    // The head keeps looking where the body is going: it takes out most of
    // the chest's turn, then arrives late at the turn itself.
    const headTurn = this.headTurnSpring.step(clamp(input.turnRate * 0.16, -0.4, 0.4), dt, whole);
    f.headTurn += headTurn - f.spineTurn * 0.55;
    f.headRoll += bank * 0.45 + f.spineBend * -0.4;
    f.headPitch = this.headPitchSpring.step(f.headPitch - lean * 0.75, dt, whole);
    // Hands trail the forearms — the flick at the end of a swing.
    const elbow = (f.elbowL + f.elbowR) * 0.5;
    const rate = (elbow - this.lastElbow) / Math.max(dt, 1e-4);
    this.lastElbow = elbow;
    const trail = this.handSpring.step(clamp(-rate * 0.05, -0.5, 0.5), dt, whole);
    f.handL += trail + 0.12;
    f.handR += trail + 0.12;
    // The tail is the counterweight: out on a turn, up when the ground goes
    // away, and always a little alive.
    f.tailTurn += this.tailTurnSpring.step(clamp(input.turnRate * 0.4, -0.7, 0.7), dt, whole);
    f.tailLift += this.tailLiftSpring.step(clamp(input.riseMs * 0.045, -0.5, 0.5) + 0.1 + runShare * 0.25, dt, whole);
    f.tailWave += 0.05 + moving * 0.1;
  }

  // On its feet: the walk itself, blended out of an idle that never stands
  // perfectly still, and folded by whatever is left of a landing.
  private walk(input: GaitInput, moving: number, runShare: number, g: GaitTuning): PoseFrame {
    const f = zeroFrame();
    const amp = smoothstep(0, 0.35, moving); // the cycle fades in as it sets off
    const p = this.phase;
    const stance = lerp(WALK_STANCE, RUN_STANCE, runShare);
    leg(f, "L", p, g, amp, stance);
    leg(f, "R", (p + Math.PI) % TAU, g, amp, stance);
    // each arm takes its own leg's phase — arm() swings it the other way,
    // which is the opposition that keeps a walking body facing forward
    arm(f, "L", p, g, amp, stance);
    arm(f, "R", (p + Math.PI) % TAU, g, amp, stance);

    // THE PELVIS RIDES OVER THE STANCE LEG, and this is not decoration: a
    // leg swung out to the side of vertical reaches less far down than one
    // straight under the hip, so a body held at a fixed height walks on
    // feet that never touch the ground. Riding down over the spread legs
    // and up over the vertical one puts the feet back on the floor, and
    // gives the walk its bounce for free — twice a cycle, lowest where both
    // legs are spread, exactly as a real one does.
    const spread = Math.min(Math.abs(f.hipL), Math.abs(f.hipR));
    f.bob = -BOB_PER_SPREAD * (1 - Math.cos(spread)) * amp + g.bob * amp * runShare;
    f.sway = -Math.sin(p) * g.sway * amp;
    f.hipRoll = Math.sin(p) * g.hipRoll * amp;
    f.hipTurn = Math.cos(p) * g.hipTurn * amp;
    // and the chest turns against it, which is what makes it a body
    f.spineTurn = -f.hipTurn * 0.8;
    f.spineBend = -f.hipRoll * 0.35;
    f.spinePitch = 0.04 + runShare * 0.16;
    f.lean = g.lean * amp;
    f.legSpread = 0.03 + runShare * 0.02;
    f.armSpreadL = 0.06 + runShare * 0.1;
    f.armSpreadR = f.armSpreadL;

    this.idle(f, 1 - amp);
    this.land(f, input.dip);
    return f;
  }

  // Standing: a weight shift that wanders, breath in the chest, and the
  // faint bend that a real body keeps in every joint.
  private idle(f: PoseFrame, w: number): void {
    if (w <= 0) return;
    const breath = Math.sin(this.clock * 1.5);
    const shift = Math.sin(this.clock * 0.31);
    const drift = Math.sin(this.clock * 0.23 + 1.1);
    f.bob += w * breath * 0.006;
    f.sway += w * shift * 0.022;
    f.hipRoll += w * shift * 0.05;
    f.hipTurn += w * shift * 0.03;
    f.spineTurn += w * -shift * 0.04;
    f.spinePitch += w * (0.03 + breath * 0.022);
    f.spineBend += w * shift * -0.03;
    f.headTurn += w * drift * 0.09;
    f.headPitch += w * breath * -0.02;
    // nothing on a living body is straight
    f.kneeL += w * (0.09 + shift * 0.03);
    f.kneeR += w * (0.09 - shift * 0.03);
    f.hipL += w * (-0.04 + shift * 0.02);
    f.hipR += w * (-0.04 - shift * 0.02);
    f.ankleL += w * 0.04;
    f.ankleR += w * 0.04;
    f.elbowL += w * (0.22 + breath * 0.03);
    f.elbowR += w * (0.22 - breath * 0.03);
    f.armL += w * -0.04;
    f.armR += w * -0.04;
    f.armSpreadL += w * 0.07;
    f.armSpreadR += w * 0.07;
    f.shoulderL += w * breath * 0.03;
    f.shoulderR += w * breath * 0.03;
    f.tailWave += w * 0.06;
  }

  // What is left of a landing: the knees go on taking it after the feet
  // have stopped, which is the difference between landing and arriving.
  private land(f: PoseFrame, dip: number): void {
    if (dip <= 0) return;
    f.kneeL += dip * 0.6;
    f.kneeR += dip * 0.6;
    f.hipL += dip * -0.3;
    f.hipR += dip * -0.3;
    f.ankleL += dip * -0.25;
    f.ankleR += dip * -0.25;
    f.spinePitch += dip * 0.28;
    f.armL += dip * -0.35;
    f.armR += dip * -0.35;
    f.elbowL += dip * 0.5;
    f.elbowR += dip * 0.5;
    f.bob += dip * -0.05;
    f.tailLift += dip * -0.3;
  }

  // Off the ground. Going up it gathers itself; coming down it reaches for
  // the ground with everything. The two are never quite symmetric, and the
  // sides are never quite the same — a matched pair reads as a doll.
  private air(input: GaitInput): PoseFrame {
    this.airFrame = mix(this.airFrame, jumpPose(input.riseMs, input.jumpS ?? this.airTime, input.jumpCount ?? 1), 1 - Math.exp(-Math.min(input.dt, 0.05) * 16));
    return this.airFrame;
  }

  // At the surface it crawls; under it, a breaststroke. Both are the walk's
  // machinery pointed a different way: the body pitches over, the legs kick
  // instead of stepping, and the arms reach and sweep.
  private swim(input: GaitInput, moving: number): PoseFrame {
    const f = zeroFrame();
    const stroke = this.clock * (2.4 + moving * 2.2);
    if (input.submerged) {
      const s = Math.sin(stroke);
      const c = Math.cos(stroke);
      f.lean = Math.PI * 0.5;
      f.legSpread = 0.3 + Math.max(0, s) * 0.5;
      f.hipL = -0.15 - Math.max(0, s) * 0.35;
      f.hipR = f.hipL;
      f.kneeL = 0.25 + Math.max(0, s) * 1.0;
      f.kneeR = f.kneeL;
      f.ankleL = -0.2 + Math.max(0, -s) * 0.5;
      f.ankleR = f.ankleL;
      f.armSpreadL = 0.35 + Math.max(0, c) * 0.75;
      f.armSpreadR = f.armSpreadL;
      f.armL = -1.15 + Math.max(0, -c) * 0.9;
      f.armR = f.armL;
      f.elbowL = 0.35 + Math.max(0, c) * 0.6;
      f.elbowR = f.elbowL;
      f.spinePitch = -0.12 + s * 0.06;
      f.headPitch = -0.3;
      f.tailLift = -0.15;
      f.tailWave = 0.16;
      return f;
    }
    // at the surface: the head stays up, the arms take turns overhead
    const s = Math.sin(stroke);
    const o = Math.sin(stroke + Math.PI);
    f.lean = Math.PI * 0.42;
    f.hipL = -0.1 + s * 0.3;
    f.hipR = -0.1 + o * 0.3;
    f.kneeL = 0.3 + Math.max(0, -s) * 0.5;
    f.kneeR = 0.3 + Math.max(0, -o) * 0.5;
    f.ankleL = 0.2 + s * 0.25;
    f.ankleR = 0.2 + o * 0.25;
    f.armL = -0.6 + s * 1.5;
    f.armR = -0.6 + o * 1.5;
    f.armSpreadL = 0.28 + Math.max(0, s) * 0.3;
    f.armSpreadR = 0.28 + Math.max(0, o) * 0.3;
    f.elbowL = 0.5 + Math.max(0, -s) * 0.5;
    f.elbowR = 0.5 + Math.max(0, -o) * 0.5;
    f.spineTurn = s * 0.16;
    f.spineBend = s * 0.1;
    f.hipTurn = -s * 0.1;
    f.spinePitch = -0.2;
    f.headPitch = -0.55;
    f.tailWave = 0.2;
    f.tailLift = -0.1;
    return f;
  }

  // In a seat: thighs out, shins hanging, hands up on whatever it is
  // steering, and the small movements of somebody sitting still.
  private seated(input: GaitInput, moving: number): PoseFrame {
    return seatedPose(input.seatedVariant ?? "car", this.clock, input.turnRate).frame;
  }
}

// A four-second breath for the Blue Cat's neutral stance. Only upper-body
// angles: the pelvis and feet stay planted. avatar.ts maps these channels.
export function blueCatIdle(timeS: number): { chestPitch: number; headPitch: number; shoulderLift: number } {
  const breath = Math.sin((timeS % 4) * Math.PI / 2);
  return { chestPitch: breath * 0.025, headPitch: -breath * 0.012, shoulderLift: breath * 0.018 };
}

// Seat-local pelvis height plus the same numeric channels used by every
// figure. Legacy seat coordinates differ: car/bike anchors are below their
// cushions, while airliner cabin anchors are at cushion height. No physics moves.
export function seatedPose(variant: SeatedVariant, timeS = 0, turnRate = 0): { frame: PoseFrame; hipHeight: number; forward: number } {
  if (variant === "stand") return standingRide(timeS);
  const f = zeroFrame();
  const rider = variant === "bike", passenger = variant === "passenger", pilot = variant === "pilot";
  f.hipL = f.hipR = rider ? -0.7 : passenger ? -1.5 : -1.4;
  f.kneeL = f.kneeR = rider ? 1.25 : passenger ? 1.5 : 1.25;
  f.ankleL = f.ankleR = 0.08;
  f.legSpread = rider ? 0.5 : passenger ? 0.04 : 0.08;
  f.armL = f.armR = rider ? -1.12 : passenger ? -0.18 : pilot ? -0.7 : -0.9;
  f.elbowL = f.elbowR = rider ? 0.0 : passenger ? 1.0 : pilot ? 0.35 : 0.35;
  f.armSpreadL = f.armSpreadR = rider ? 0.14 : passenger ? 0.03 : 0.08;
  f.lean = rider ? 1.0 : passenger ? -0.04 : pilot ? 0.2 : 0.16;
  f.spinePitch = Math.sin(timeS * 1.4) * 0.012;
  f.spineTurn = passenger ? 0 : Math.max(-0.15, Math.min(0.15, turnRate * 0.06));
  f.headPitch = -f.lean * (rider ? .95 : .5);
  f.tailWave = 0.06;
  return { frame: f, hipHeight: rider ? 0.84 : passenger ? 0.2 : pilot ? 0.45 : 0.98, forward: passenger ? 0.22 : 0 };
}


// On your feet on a deck (a skateboard, a kick scooter): knees soft, hips
// back a little, feet apart and arms loose, the body a touch forward over
// the feet. The deck's contact points (vehicleContacts.ts) then put the feet
// and hands where they go; this is the frame they bend from. The hips ride
// this high over the deck: Cosmo's hip is half a metre above the ankle with
// the leg straight, and the ankle 0.13 m above the sole (measured on the
// stream), so this leaves the knees soft.
export const STAND_HIP_M = 0.58;
function standingRide(timeS: number): { frame: PoseFrame; hipHeight: number; forward: number } {
  const f = zeroFrame();
  f.hipL = f.hipR = -0.32;
  f.kneeL = f.kneeR = 0.6;
  f.ankleL = f.ankleR = 0.1;
  f.legSpread = 0.2;
  f.armL = f.armR = -0.3;
  f.elbowL = f.elbowR = 0.45;
  f.armSpreadL = f.armSpreadR = 0.4;
  f.lean = 0.22;
  f.spinePitch = Math.sin(timeS * 1.4) * 0.012;
  f.headPitch = -0.15;
  f.tailWave = 0.08;
  return { frame: f, hipHeight: STAND_HIP_M, forward: 0 };
}

// Cosmetic roll about the seated torso, in radians. Bikes lean visibly into
// the turn; aircraft occupants respond much less. Exponential easing gives
// the same response at different frame rates and softens reversals/seat exit.
export function seatedSway(variant: SeatedVariant | null, turnRate: number, previous: number, dt: number): number {
  const limit = variant === "bike" ? 0.24 : variant === "pilot" ? 0.075 : variant === "passenger" ? 0.06 : 0.1;
  const gain = variant === "bike" ? 0.3 : variant === "pilot" ? 0.07 : variant === "passenger" ? 0.055 : 0.1;
  const target = variant === null ? 0 : clamp(-turnRate * gain, -limit, limit);
  return previous + (target - previous) * (1 - Math.exp(-Math.max(0, dt) * 6));
}


// Simulation jumpS is a button-cut timer and becomes -1 at release/apex.
// Keep a presentation clock through the whole flight, restarting on impulse.
export class VisualJumpClock {
  private age = 0;
  private airborne = false;
  private count = 0;
  step(airborne: boolean, count: number, simulationAge: number | undefined, dt: number): number {
    if (!airborne) { this.age = 0; this.airborne = false; this.count = 0; return 0; }
    const reported = simulationAge !== undefined && simulationAge >= 0 ? simulationAge : undefined;
    if (!this.airborne || count > this.count) this.age = reported ?? (count === 0 ? 0.5 : 0);
    else this.age = Math.max(this.age + Math.max(0, dt), reported ?? 0);
    this.airborne = true; this.count = count;
    return this.age;
  }
}

// Joint angles only. A jump first pushes long, gathers near its apex, then
// opens the legs for contact. The second impulse adds a brief stronger tuck.
export function jumpPose(riseMs: number, jumpS: number, jumpCount = 1): PoseFrame {
  const f = zeroFrame();
  const gather = smoothstep(0.09, 0.34, jumpS) * (1 - smoothstep(1, 6, -riseMs));
  const second = jumpCount > 1 ? smoothstep(0, 0.08, jumpS) * (1 - smoothstep(0.16, 0.42, jumpS)) : 0;
  // Drive from the backswing, let the arms settle at the apex, then open
  // for balance. Separate smooth phases avoid holding one airborne gesture.
  const drive = smoothstep(0, 0.16, jumpS);
  const settle = smoothstep(0.2, 0.48, jumpS);
  const landing = smoothstep(1, 6, -riseMs);
  f.hipL = lerp(-0.12 - gather * 1.02, -1.25, second);
  const trailingGather = smoothstep(0.12, 0.38, jumpS) * (1 - smoothstep(1, 6, -riseMs));
  f.hipR = lerp(-0.08 - trailingGather * 0.94, -1.14, second);
  f.kneeL = lerp(0.2 + gather * 1.65, 2.05, second);
  f.kneeR = lerp(0.24 + trailingGather * 1.48, 1.92, second);
  f.armL = 0.42 - drive * 2.18 + settle * 0.96 + landing * 0.5;
  f.armR = 0.35 - drive * 1.98 + settle * 0.89 + landing * 0.48;
  f.elbowL = 0.22 + gather * 0.55 + second * 0.15;
  f.elbowR = 0.27 + gather * 0.47 + second * 0.12;
  f.armSpreadL = f.armSpreadR = 0.16 + (1 - smoothstep(-3, 3, riseMs)) * 0.26;
  f.ankleL = f.ankleR = 0.22 * (1 - landing) - landing * 0.08;
  f.legSpread = 0.08; f.lean = 0.06 + gather * 0.16 + second * 0.06 - landing * 0.08; f.headPitch = -f.lean * 0.8;
  f.tailLift = 0.2; f.tailWave = 0.12;
  return f;
}

// Dip is the existing impact/recovery envelope; soften it at both endpoints.
export function landingPose(dip: number): PoseFrame {
  const f=zeroFrame(), impact=smoothstep(0, 1, clamp(dip, 0, 1));
  f.hipL=f.hipR=-0.08-impact*0.72;
  f.kneeL=f.kneeR=0.16+impact*1.35;
  f.lean=impact*0.36; f.headPitch=-impact*0.28;
  f.armL=-0.12-impact*0.65; f.armR=-0.08-impact*0.6;
  f.elbowL=f.elbowR=0.25+impact*0.3;
  f.armSpreadL=f.armSpreadR=0.18;
  return f;
}

export function movementPose(stance: PlayerStance, cycle = 0, moving = 0): PoseFrame {
  const f = zeroFrame(), stride = Math.sin(cycle * TAU) * clamp(moving, 0, 1);
  if (stance === "crouch") {
    f.lean = 0.85; f.headPitch = -0.65;
    f.hipL = -1.35 + stride * 0.12; f.hipR = -1.35 - stride * 0.12;
    f.kneeL = 2.55 + Math.max(0, stride) * 0.1; f.kneeR = 2.55 + Math.max(0, -stride) * 0.1;
    f.armL = 0.85 - stride * 0.12; f.armR = 0.85 + stride * 0.12;
    f.elbowL = f.elbowR = 0.35; f.legSpread = 0.16;
  } else if (stance === "prone") {
    f.lean = 1.7; f.headPitch = -1.25;
    f.hipL = 1.48 + stride * 0.04; f.hipR = 1.48 - stride * 0.04;
    f.kneeL = 0.12 + Math.max(0, stride) * 0.22; f.kneeR = 0.12 + Math.max(0, -stride) * 0.22;
    f.armL = -1.45 - stride * 0.28; f.armR = -1.45 + stride * 0.28;
    f.elbowL = 0.42 - stride * 0.22; f.elbowR = 0.42 + stride * 0.22;
    f.legSpread = 0.2;
  } else if (stance === "slide") {
    f.lean = -1.2; f.headPitch = 1.2;
    f.hipL = -1.57; f.hipR = -2.35; f.kneeL = 0.12; f.kneeR = 1.8;
    f.armL = -1.0; f.armR = -1.2; f.elbowL = 0.55; f.elbowR = 0.4; f.legSpread = 0.2;
  }
  f.armSpreadL = f.armSpreadR = 0.12;
  return f;
}


// Impulses need a quick response; lowering or raising the whole body needs
// enough time for the limbs to fold. Accept clip names and plain action names.
export function movementBlendSeconds(from: string, to: string): number {
  const action = (name: string) => name.replace(/^reach:/, "").split(":")[0] ?? "";
  const source = action(from), target = action(to);
  if (movementUsesCrouchWaypoint(from, to)) return 0.62;
  if (target === "jump" || target === "double-jump" || target === "doublejump") return 0.1;
  if (target === "land") return 0.14;
  if (target === "slide") return 0.2;
  if (source === "prone" || target === "prone") return 0.42;
  if (source === "crouch" || target === "crouch") return 0.28;
  return 0.18;
}

// A low support pose gives the pelvis and knees a path between upright and prone.
export function movementUsesCrouchWaypoint(from: string, to: string): boolean {
  const action = (name: string) => name.replace(/^reach:/, "").split(":")[0] ?? "";
  const a = action(from), b = action(to);
  const upright = (name: string) => ["idle", "stand", "walk", "run"].includes(name);
  return (a === "prone" && upright(b)) || (b === "prone" && upright(a));
}

// Reach toward the floor while knees still support the body, before extending prone.
export function proneSupportPose(): PoseFrame {
  const f = movementPose("crouch");
  f.armL = f.armR = -0.65;
  f.elbowL = f.elbowR = 0.25;
  return f;
}

// Soft hands in motion; open fingers only when supporting the body.
export function handClosure(stance: PlayerStance, airborne: boolean, seat?: SeatedVariant): number {
  // (standing on a deck the hands hang open: they hold nothing)
  if (seat) return seat === "bike" ? 0.7 : seat === "passenger" || seat === "stand" ? 0.2 : 0.45;
  return stance === "prone" ? 0.06 : airborne ? 0.5 : 0.25;
}
