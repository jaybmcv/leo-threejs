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

// (Leo) An object's times, kept on the object itself under its LazyWorld's own
// key and valid only in the epoch they were written in: settle() starts a new
// epoch instead of clearing maps, so a read costs two property loads per
// ancestor rather than two map lookups.
type Stamp = { madeEpoch: number; made: number; changedEpoch: number; changed: number };

export class LazyWorld {
  private clock = 0;
  // when the whole tree was last current, when an object's matrixWorld was
  // made since, and when its own transform changed since (Stamp)
  private settledAt = 0;
  private epoch = 1;
  private readonly key = Symbol("lazyWorld");
  // the objects edited since the last settle, in the order first edited
  private readonly editedList: THREE.Object3D[] = [];

  // after invalidate(): nothing under `top` is current until read
  private stale = false;

  // `top`'s own matrixWorld is the caller's to keep current: the solver never
  // edits it, and refreshes it before solving (the avatar may have moved)
  constructor(private readonly top: THREE.Object3D) {}

  private stamp(o: THREE.Object3D): Stamp {
    const held = o as unknown as Record<symbol, Stamp | undefined>;
    let s = held[this.key];
    if (!s) {
      s = { madeEpoch: 0, made: 0, changedEpoch: 0, changed: 0 };
      held[this.key] = s;
    }
    return s;
  }

  // Every matrix under `top` is current: the caller has just refreshed the
  // whole tree (updateMatrixWorld(true)).
  settle(): void {
    this.epoch++;
    this.editedList.length = 0;
    this.settledAt = ++this.clock;
    this.stale = false;
  }

  // Every transform under `top` may have changed (a solve puts each bone back
  // to its rest pose): nothing below is current until read, and a read remakes
  // its path, as an edit's would be. A solve reads about half the skeleton
  // before it next needs all of it, and never the meshes, so this replaces
  // refreshing the whole tree up front.
  invalidate(): void {
    this.settle();
    this.stale = true;
  }

  // Only these subtrees made current (their ancestors first), then the tree
  // taken as current: for a caller that reads nothing outside them before its
  // next full refresh (a solve's probes read bones, not meshes).
  refresh(roots: readonly THREE.Object3D[]): void {
    for (const o of roots) {
      if (o.parent) this.current(o.parent);
      o.updateWorldMatrix(false, true);
    }
    this.settle();
  }

  // `o`'s position, quaternion or scale has changed.
  edited(o: THREE.Object3D): void {
    const s = this.stamp(o);
    if (s.changedEpoch !== this.epoch) {
      s.changedEpoch = this.epoch;
      this.editedList.push(o);
    }
    s.changed = ++this.clock;
  }

  // `o`'s matrixWorld, as the transforms stand now.
  world(o: THREE.Object3D): THREE.Matrix4 {
    this.current(o);
    return o.matrixWorld;
  }

  // Everything edited since the last settle, and all below it, made current
  // once: for readers of every bone (a skeleton's update, a probe).
  flush(): void {
    if (this.stale) {
      for (const o of this.top.children) o.updateWorldMatrix(false, true);
      this.settle();
      return;
    }
    const edited = this.editedList.slice();
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
    // stale, an object not yet remade is older than anything, and its own
    // transform counts as changed
    const s = this.stamp(o);
    const madeAt = s.madeEpoch === this.epoch ? s.made : (this.stale ? -1 : this.settledAt);
    const changedAt = s.changedEpoch === this.epoch ? s.changed : (this.stale ? this.settledAt : 0);
    if (madeAt >= parentAt && madeAt >= changedAt) return madeAt;
    if (changedAt > madeAt && o.matrixAutoUpdate) o.updateMatrix();
    o.matrixWorld.multiplyMatrices(parent.matrixWorld, o.matrix);
    const now = ++this.clock;
    s.made = now;
    s.madeEpoch = this.epoch;
    return now;
  }
}
