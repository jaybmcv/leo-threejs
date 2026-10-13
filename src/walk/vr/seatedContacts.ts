import * as T from 'three';
export type ContactPoint = readonly [number, number, number];
/** A seated figure's arms set as angles rather than reached to a point, as a pose frame has them
 * (gait.ts PoseFrame: arm + swings it back, - forward; elbow bends it; spread takes it out to the
 * side). A skater's arms in the air are the avatar's own jump's (play/skaterPose.ts). */
export interface SeatArms {
  armL: number;
  armR: number;
  elbowL: number;
  elbowR: number;
  armSpreadL: number;
  armSpreadR: number;
}

/** Wrist/ankle targets in the fitted figure's local coordinates (+Z forward). */
export interface SeatedContacts {
  leftHand?: ContactPoint;
  rightHand?: ContactPoint;
  leftFoot?: ContactPoint;
  rightFoot?: ContactPoint;
}

function worldRotation(bone: T.Object3D, rotation: T.Quaternion): void {
  bone.quaternion.copy(bone.parent ? bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation) : rotation);
  bone.updateWorldMatrix(false, true);
}
function aim(bone: T.Object3D, end: T.Object3D, target: T.Vector3): void {
  const origin = bone.getWorldPosition(new T.Vector3());
  const current = end.getWorldPosition(new T.Vector3()).sub(origin).normalize();
  const desired = target.clone().sub(origin).normalize();
  worldRotation(bone, new T.Quaternion().setFromUnitVectors(current, desired).multiply(bone.getWorldQuaternion(new T.Quaternion())));
}

/** Analytic two-link IK. Only rotations change; unreachable targets clamp to
 * the limb's physical reach, and wrist/sole world orientation stays intact. */
export function solveSeatedLimb(root: T.Object3D, upper: T.Object3D, middle: T.Object3D, end: T.Object3D, target: ContactPoint, pole: ContactPoint): void {
  if (!target.every(Number.isFinite)) return;
  root.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(new T.Vector3()), b = middle.getWorldPosition(new T.Vector3()), c = end.getWorldPosition(new T.Vector3());
  const lengthA = a.distanceTo(b), lengthB = b.distanceTo(c);
  if (Math.min(lengthA, lengthB) < 1e-6) return;
  const destination = root.localToWorld(new T.Vector3(...target));
  const direction = destination.clone().sub(a);
  if (direction.lengthSq() < 1e-12) direction.copy(c).sub(a);
  if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1);
  direction.normalize();
  const distance = T.MathUtils.clamp(a.distanceTo(destination), Math.abs(lengthA - lengthB) + 1e-6, lengthA + lengthB - 1e-6);
  const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, lengthA * lengthA - along * along));
  // Stable anatomical poles avoid an elbow flipping above the shoulder as a
  // control comes closer. Knees project forward; elbows hang down/outward.
  const bend = new T.Vector3(...pole).transformDirection(root.matrixWorld);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-7) bend.copy(b).sub(a).addScaledVector(direction, -b.clone().sub(a).dot(direction));
  if (bend.lengthSq() < 1e-7) bend.set(1, 0, 0).addScaledVector(direction, -direction.x);
  if (bend.lengthSq() < 1e-7) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
  bend.normalize();
  const elbow = a.clone().addScaledVector(direction, along).addScaledVector(bend, height);
  const reached = a.clone().addScaledVector(direction, distance);
  const endOrientation = end.getWorldQuaternion(new T.Quaternion());
  aim(upper, middle, elbow);
  aim(middle, end, reached);
  worldRotation(end, endOrientation);
}

export function applySeatedContacts(root: T.Object3D, bones: ReadonlyMap<string, T.Object3D>, rig: 'blue' | 'dl', contacts: SeatedContacts): void {
  for (const side of ['L', 'R'] as const) {
    const hand = side === 'L' ? contacts.leftHand : contacts.rightHand;
    const foot = side === 'L' ? contacts.leftFoot : contacts.rightFoot;
    const sign = side === 'L' ? 1 : -1;
    const limb = (names: string[], target: ContactPoint | undefined, pole: ContactPoint) => {
      if (!target) return;
      const [a, b, c] = names.map(name => bones.get(name));
      if (a && b && c) solveSeatedLimb(root, a, b, c, target, pole);
    };
    limb(rig === 'blue' ? ['Upperarm', 'Forearm', 'Hand'].map(n => side + '_' + n) : ['upper_arm', 'forearm', 'hand'].map(n => n + '.' + side), hand, [sign * .45, -1, -.15]);
    limb(rig === 'blue' ? ['Thigh', 'Calf', 'Foot'].map(n => side + '_' + n) : ['thigh', 'shin', 'foot'].map(n => n + '.' + side), foot, [sign * .15, 0, 1]);
  }
}
/** The palm approaches the control before the digits close around it. */
export function seatedGripDirections(side: 'L' | 'R', handlebar: boolean) {
  const along = new T.Vector3(0, -.5, 1).normalize();
  const palm = handlebar ? new T.Vector3(0, -1, -.5).normalize() : new T.Vector3(side === 'L' ? -1 : 1, 0, 0);
  return { along, palm };
}

export function orientSeatedPalm(root: T.Object3D, hand: T.Object3D, side: 'L' | 'R', handlebar: boolean): void {
  const { along, palm } = seatedGripDirections(side, handlebar);
  const across = new T.Vector3().crossVectors(along, palm).normalize();
  const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across, along, palm));
  worldRotation(hand, root.getWorldQuaternion(new T.Quaternion()).multiply(q));
}
