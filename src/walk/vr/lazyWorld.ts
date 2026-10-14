// WORLD MATRICES ON DEMAND, for a solver that edits one bone at a time.
//
// Cosmo's solver refreshed a bone's whole subtree after every edit
// (updateWorldMatrix(false, true)) and read positions through three's
// getters, which recompute every ancestor up to the scene. An edit to the
// spine redid nearly the whole skeleton, and a frame makes dozens. Measured
// 2026-09-22 with fifty visitors in view: that matrix work was over half of
// the frame, and a visitor's frame grew 0.55 ms with each cat in view.
//
// Here an edit only notes the bone. A read brings the one path from the
// figure's root down to the bone up to date, skipping each link that is
// already current, and flush() brings the rest when every bone is wanted.
// Every world matrix is still parent × local, made from the same inputs, so
// the numbers are the ones the eager refresh made
// (dlCatFigureMatrixParity.test.ts holds the two together).

import * as THREE from "three";

// EULER ANGLES ON DEMAND. three keeps every object's `rotation` in step with
// its quaternion, working the angles out again on every write, and a solve
// writes each bone's quaternion several times a frame while nothing reads a
// bone's angles: 9.7% of the frame with fifty visitors in view (2026-09-22).
// Here a write to the quaternion only notes it, and reading `rotation` works
// the angles out first. Writing `rotation` still sets the quaternion.
export function eulerOnDemand(o: THREE.Object3D): void {
  const euler = o.rotation;
  const quaternion = o.quaternion;
  let stale = false;
  quaternion._onChange(() => {
    stale = true;
  });
  Object.defineProperty(o, "rotation", {
    configurable: true,
    enumerable: true,
    get(): THREE.Euler {
      if (stale) {
        stale = false;
        euler.setFromQuaternion(quaternion, undefined, false);
      }
      return euler;
    },
  });
}

export class LazyWorld {
  private clock = 0;
  // when the whole tree was last current, when an object's matrixWorld was
  // made since, and when its own transform changed since
  private settledAt = 0;
  private readonly madeAt = new Map<THREE.Object3D, number>();
  private readonly changedAt = new Map<THREE.Object3D, number>();

  // `top`'s own matrixWorld is the caller's to keep current: the solver never
  // edits it, and refreshes it before solving (the avatar may have moved)
  constructor(private readonly top: THREE.Object3D) {}

  // Every matrix under `top` is current: the caller has just refreshed the
  // whole tree (updateMatrixWorld(true)).
  settle(): void {
    this.madeAt.clear();
    this.changedAt.clear();
    this.settledAt = ++this.clock;
  }

  // `o`'s position, quaternion or scale has changed.
  edited(o: THREE.Object3D): void {
    this.changedAt.set(o, ++this.clock);
  }

  // `o`'s matrixWorld, as the transforms stand now.
  world(o: THREE.Object3D): THREE.Matrix4 {
    this.current(o);
    return o.matrixWorld;
  }

  // Everything edited since the last settle, and all below it, made current
  // once: for readers of every bone (a skeleton's update, a probe).
  flush(): void {
    const edited = [...this.changedAt.keys()];
    const set = new Set(edited);
    for (const o of edited) {
      // the topmost edits only: each one's subtree carries the ones below
      let under = false;
      for (let p = o.parent; p && p !== this.top; p = p.parent) {
        if (set.has(p)) {
          under = true;
          break;
        }
      }
      if (under) continue;
      if (o.parent) this.current(o.parent);
      o.updateWorldMatrix(false, true);
    }
    this.settle();
  }

  // The time `o`'s matrixWorld was made, remaking it first if its own
  // transform or anything above it has changed since.
  private current(o: THREE.Object3D): number {
    if (o === this.top) return this.settledAt;
    const parent = o.parent;
    if (!parent) {
      // not under `top`: fall back to three's own full walk
      o.updateWorldMatrix(true, false);
      return ++this.clock;
    }
    const parentAt = this.current(parent);
    const madeAt = this.madeAt.get(o) ?? this.settledAt;
    const changedAt = this.changedAt.get(o) ?? 0;
    if (madeAt >= parentAt && madeAt >= changedAt) return madeAt;
    if (changedAt > madeAt && o.matrixAutoUpdate) o.updateMatrix();
    o.matrixWorld.multiplyMatrices(parent.matrixWorld, o.matrix);
    const now = ++this.clock;
    this.madeAt.set(o, now);
    return now;
  }
}
