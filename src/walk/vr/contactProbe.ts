// THE CONTACT PROBE. Where a skinned figure's lowest point is, without
// skinning it.
//
// A cat is stood on the floor by its lowest vertex, and the exact way to
// find that is a precise bounding box: every vertex of every mesh skinned
// on the CPU. Measured 2026-09-17 with twenty-five visitors at the arrival
// view, that one box per cat per frame was nearly half of a 38 ms frame.
//
// A vertex moves with the bone that owns most of it, so the figure is, near
// enough, a set of rigid lumps, one a bone. A lump's lowest point in any
// pose is a corner of its CONVEX HULL — the lowest of a linear function over
// a convex shape is always at one of its vertices — so the probe keeps each
// bone's hull, in that bone's own space, and a frame's lowest point is the
// lowest of those under the bones' current world matrices: a few thousand
// multiply-adds, not a skin.
//
// It used to keep only each bone's extremes along 26 fixed directions, and
// that read HIGH whenever the lowest point fell between two of them.
// Measured 2026-09-19 on a walking cat: 0.81 mm high at the worst frame,
// which grounded the boot sole 0.81 mm under the floor. Keeping every point,
// still rigid to its bone, was off by 0.000 mm at that same frame — so the
// whole error was the sampling and none of it the rigid-lump assumption, and
// a hull, which is every point that can ever be lowest, closes it exactly.
//
// Nothing here knows the model. The extremes are MEASURED from whatever
// meshes are handed in, in whatever pose they stand in, so a re-rigged or
// re-sculpted cat measures itself again at load. The test holds the probe
// to the exact box across real poses, so a model it does not suit fails
// there, not on the floor.

import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";

interface Lump {
  bone: THREE.Bone;
  // the bone-space corners of its hull, xyz after xyz
  points: Float32Array;
}

export class ContactProbe {
  private readonly lumps: Lump[] = [];

  // The meshes as they stand now: their world matrices and skeletons must be
  // up to date (updateMatrixWorld, skeleton.update).
  constructor(meshes: readonly THREE.SkinnedMesh[]) {
    const owned = new Map<THREE.Bone, number[]>();
    const world = new THREE.Vector3();
    const inverse = new Map<THREE.Bone, THREE.Matrix4>();
    for (const mesh of meshes) {
      const indices = mesh.geometry.getAttribute("skinIndex");
      const weights = mesh.geometry.getAttribute("skinWeight");
      const count = mesh.geometry.getAttribute("position").count;
      for (let v = 0; v < count; v++) {
        // the bone that owns most of this vertex
        let slot = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(v, k) > weights.getComponent(v, slot)) slot = k;
        const bone = mesh.skeleton.bones[indices.getComponent(v, slot)];
        if (!bone) continue;
        let inv = inverse.get(bone);
        if (!inv) {
          inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
          inverse.set(bone, inv);
        }
        mesh.getVertexPosition(v, world).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
        let list = owned.get(bone);
        if (!list) {
          list = [];
          owned.set(bone, list);
        }
        list.push(world.x, world.y, world.z);
      }
    }
    for (const [bone, flat] of owned) this.lumps.push({ bone, points: hullCorners(dedupe(flat)) });
  }

  // how many points a frame's probe reads
  get size(): number {
    let n = 0;
    for (const lump of this.lumps) n += lump.points.length / 3;
    return n;
  }

  // The lowest world height of the figure under the bones' CURRENT world
  // matrices (the caller keeps those up to date, as it does for the skin),
  // leaving out the lumps of any bones in `skip` — a tail that would prop a
  // cat lying on its back half a metre off the floor.
  lowestY(skip?: ReadonlySet<THREE.Bone>): number {
    let low = Infinity;
    for (const { bone, points } of this.lumps) {
      if (skip?.has(bone)) continue;
      const e = bone.matrixWorld.elements;
      const m1 = e[1]!, m5 = e[5]!, m9 = e[9]!, m13 = e[13]!;
      for (let i = 0; i < points.length; i += 3) {
        const y = m1 * points[i]! + m5 * points[i + 1]! + m9 * points[i + 2]! + m13;
        if (y < low) low = y;
      }
    }
    return low;
  }
}

// A mesh repeats a position wherever its UVs or normals split, so a lump
// arrives with many copies of the same point.
function dedupe(points: readonly number[]): Float32Array {
  const seen = new Set<string>();
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    const key = `${points[i]},${points[i + 1]},${points[i + 2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(points[i]!, points[i + 1]!, points[i + 2]!);
  }
  return new Float32Array(out);
}

// The corners of a lump's convex hull: every point that can ever be the
// lowest, and no other. The hull library keeps ALL its input in `vertices`,
// so the corners are the ones its faces actually use, found by walking each
// face's half-edges. A lump it cannot hull — fewer than four points, or all
// of them in a plane — keeps every point it has: still exact, only slower,
// and such lumps are tiny.
function hullCorners(points: Float32Array): Float32Array {
  if (points.length < 12) return points;
  const input: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i += 3) input.push(new THREE.Vector3(points[i]!, points[i + 1]!, points[i + 2]!));
  let hull: ConvexHull;
  try {
    hull = new ConvexHull().setFromPoints(input);
  } catch {
    return points;
  }
  if (hull.faces.length === 0) return points;
  const corners = new Set<THREE.Vector3>();
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      corners.add(edge.head().point);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  const out = new Float32Array(corners.size * 3);
  let i = 0;
  for (const p of corners) {
    out[i++] = p.x;
    out[i++] = p.y;
    out[i++] = p.z;
  }
  return out;
}
