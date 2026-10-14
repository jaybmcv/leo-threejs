import {WALK_SPEED,RUN_SPEED} from './worldCore.js';

/** Cosmo's run, fitted to Run Cycle (1).mp4 (side) and Run Cycle 2.mp4
 * (rear). One stride repeats every 18 frames at 30 fps. Limb directions
 * preserve the avatar's native bone lengths and skin weights. */
export const COSMO_RUN_DURATION = .6;
const DEGREES = Math.PI / 180;

// Preserve the previous 4.5 m/s jog's planted foot before introducing the
// supplied sprint. The donor walk/jog blend has a different speed range.
export function cosmoRunBlend(speed:number){
  const t=Math.max(0,Math.min(1,(speed-4.6)/((WALK_SPEED+RUN_SPEED)/2-4.6)));
  return t*t*(3-2*t);
}

// Thigh, shin, shoe pitch, upper arm, forearm, shoe yaw and roll (degrees).
// The opposite limb follows half a cycle later; phase zero is push-off.
const limbKeys = [
  [3.80, -60.10, 35.00, 6.60, 91.00, -1.50, -5.25],
  [-13.25, -65.40, 67.25, 8.90, 102.75, 2.25, -5.25],
  [-23.85, -82.55, 96.50, 4.05, 111.45, 4.50, -4.50],
  [-21.40, -104.65, 120.50, -8.60, 114.80, 4.50, -3.75],
  [-9.50, -123.15, 134.50, -24.35, 108.15, 7.50, -5.25],
  [2.90, -131.40, 138.50, -38.10, 91.70, 5.25, -7.50],
  [23.20, -124.40, 133.75, -50.25, 71.70, 5.25, -8.25],
  [43.75, -109.75, 119.25, -63.60, 48.15, 4.50, -3.00],
  [63.20, -91.90, 100.00, -79.85, 26.05, 6.00, -0.75],
  [75.60, -70.30, 73.25, -93.15, 1.05, 4.50, 0.00],
  [78.30, -45.50, 41.50, -96.55, -9.25, 1.50, 0.75],
  [75.70, -22.30, 17.75, -93.40, -3.15, -2.25, -1.50],
  [70.25, -7.10, 2.25, -83.20, 18.70, -4.50, -6.75],
  [64.50, -3.15, 0.25, -70.20, 38.10, -8.25, -15.75],
  [57.80, -14.75, 5.75, -55.00, 53.40, -8.25, -18.00],
  [52.30, -33.90, 10.00, -37.25, 66.70, -6.00, -8.25],
  [40.80, -50.20, 8.50, -18.45, 73.40, -4.50, -4.50],
  [22.30, -60.40, 15.00, -3.65, 72.20, -3.75, -4.50],
] as const;

// The near glove stays closed during recovery and opens just before push-off.
// Its opening has a different phase from the arm's forward swing.
const rightHandKeys = [
  [.14], [.12], [.12], [.14], [.20], [.32], [.45], [.50], [.50],
  [.50], [.50], [.50], [.50], [.50], [.50], [.50], [.50], [.38],
] as const;

// Pelvis pitch, torso bend, head pitch, chest yaw (degrees), sole lift (m).
// Keep the torso's own curve: its motion is not two identical half strides.
const bodyKeys = [
  [22.70, 13.30, -12.15, -0.05, 0.018],
  [24.30, 11.10, -12.20, 9.26, 0.009],
  [26.05, 11.55, -15.25, 17.27, 0.126],
  [17.90, 17.05, -13.40, 25.03, 0.236],
  [13.35, 22.90, -14.70, 28.23, 0.187],
  [10.95, 28.35, -20.55, 27.74, 0.134],
  [13.75, 27.30, -23.50, 21.44, 0.133],
  [14.80, 25.55, -23.00, 14.36, 0.139],
  [17.35, 21.05, -20.60, 10.19, 0.090],
  [19.10, 19.25, -21.60, 3.30, 0.013],
  [18.40, 18.40, -15.75, -5.09, 0.000],
  [17.25, 19.60, -11.20, -14.45, 0.120],
  [15.45, 17.30, -2.50, -23.57, 0.238],
  [18.25, 17.60, -5.80, -26.24, 0.208],
  [21.70, 14.80, -16.00, -27.16, 0.149],
  [27.10, 8.10, -18.30, -28.23, 0.131],
  [21.75, 12.75, -15.40, -21.97, 0.125],
  [23.00, 13.60, -12.80, -9.94, 0.093],
] as const;

// Periodic cubic interpolation closes both position and velocity at wrap.
function curve(keys:readonly (readonly number[])[],phase:number,channel:number){
  const frame=((phase%1+1)%1)*keys.length,index=Math.floor(frame),t=frame-index;
  const at=(offset:number)=>keys[(index+offset+keys.length)%keys.length]![channel]!;
  const a=at(-1),b=at(0),c=at(1),d=at(2);
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
}
export function cosmoRunLeg(phase:number){
  return {thigh:curve(limbKeys,phase,0)*DEGREES,shin:curve(limbKeys,phase,1)*DEGREES,
    foot:curve(limbKeys,phase,2)*DEGREES,arm:curve(limbKeys,phase,3)*DEGREES,
    forearm:curve(limbKeys,phase,4)*DEGREES,footYaw:curve(limbKeys,phase,5)*DEGREES,
    footRoll:curve(limbKeys,phase,6)*DEGREES};
}
export function cosmoRunPose(phase:number){
  const cycle=phase*Math.PI*2;
  return {right:cosmoRunLeg(phase),left:cosmoRunLeg(phase+.5),
    rightHandCurl:curve(rightHandKeys,phase,0),leftHandCurl:.5,
    pelvisPitch:curve(bodyKeys,phase,0)*DEGREES,torsoPitch:curve(bodyKeys,phase,1)*DEGREES,
    headPitch:curve(bodyKeys,phase,2)*DEGREES,chestYaw:curve(bodyKeys,phase,3)*DEGREES,
    // Preserve the fitted average gaze with a small motion at each footfall.
    // Stabilize in the figure's frame so torso bends cannot add a sharp nod.
    gazePitch:(22.35+1.25*Math.cos(cycle*2-.3))*DEGREES,
    neckPitch:22.5*DEGREES,shoulderYaw:-7*DEGREES,armSpread:.16,forearmSpread:.03125,
    twist:Math.sin(cycle)*4.125*DEGREES,bank:Math.sin(cycle)*2*DEGREES,
    flight:Math.max(0,curve(bodyKeys,phase,4))};
}
