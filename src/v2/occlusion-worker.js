// Runs in a dedicated worker. All inputs are snapshots from the main camera pass.
export function occlusionWorker(channel) {
  const planes = new Map(), geometry = new Map();
  let nearby = [], eye, frustum, epoch = -1;
  // Each blocker is a single rendered triangle. A tile is only a lookup index.
  // Membership never authorizes hiding geometry across a gap between triangles.
  function prepare(raw) {
    for (let k = 0; k < raw.length; k += 12) {
      const [axis, d, front, side, source, first, ax, az, bx, bz, cx, cz] = raw.subarray(k, k + 12), u = (axis + 1) % 3, v = (axis + 2) % 3;
      const key = axis + ':' + d;
      let layer = planes.get(key);
      if (!layer) {
        layer = { axis, u, v, d, tiles: new Map() };
        planes.set(key, layer);
      }
      const winding = Math.sign((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
      const edge = (x, z, j, l) => { const dx = j - x, dz = l - z, s = winding / Math.hypot(dx, dz), nx = -dz * s, nz = dx * s; return [nx, nz, -nx * x - nz * z - .035]; };
      const patch = { front, side, source, first, edges: [edge(ax, az, bx, bz), edge(bx, bz, cx, cz), edge(cx, cz, ax, az)] };
      for (let x = Math.floor(Math.min(ax, bx, cx) / 6); x <= Math.floor(Math.max(ax, bx, cx) / 6); x++) {
        let zs = layer.tiles.get(x);
        if (!zs) {
          zs = new Map();
          layer.tiles.set(x, zs);
        }
        for (let z = Math.floor(Math.min(az, bz, cz) / 6); z <= Math.floor(Math.max(az, bz, cz) / 6); z++) {
          let bin = zs.get(z);
          if (!bin) {
            bin = [];
            zs.set(z, bin);
          }
          bin.push(patch);
        }
      }
    }
  }
  function view(data) {
    epoch = data.epoch;
    eye = data.eye;
    frustum = data.frustum;
    nearby = [];
    for (const l of planes.values()) {
      const delta = eye[l.axis] - l.d, abs = Math.abs(delta);
      if (abs < .85 || abs > 32)
        continue;
      l.sign = Math.sign(delta);
      l.min = abs - data.half;
      l.max = abs + data.half;
      l.half = data.half;
      nearby.push(l);
    }
    nearby.sort((a, b) => a.min - b.min);
  }
  const b = new Float64Array(6), mat = new Float64Array(16);
  function worldBox(boxes, j, m) {
    for (let i = 0; i < 3; i++) {
      let lo = m[12 + i], hi = lo;
      for (let k = 0; k < 3; k++) {
        const val = m[i + k * 4], x = val * boxes[j + k], y = val * boxes[j + k + 3];
        lo += Math.min(x, y);
        hi += Math.max(x, y);
      }
      b[i] = lo;
      b[i + 3] = hi;
    }
  }
  function outside() {
    for (const p of frustum)
      if (p[0] * b[p[0] > 0 ? 3 : 0] + p[1] * b[p[1] > 0 ? 4 : 1] + p[2] * b[p[2] > 0 ? 5 : 2] + p[3] < -.05)
        return true;
    return false;
  }
  // At the blocker plane, the ray from eye E to target B is their weighted
  // average. Bound each edge at the whole eye cell and at the whole target
  // box. The lower bound of the weighted sum must be positive on all edges.
  function hiddenBox(scope, witness) {
    for (const l of nearby) {
      const { axis: h, u, v, d, sign } = l, near = sign > 0 ? d - b[h + 3] : b[h] - d;
      if (!(near > .08))
        continue;
      const far = sign > 0 ? d - b[h] : b[h + 3] - d;
      const weight = (eye[h] - d) / (eye[h] - (b[h] + b[h + 3]) * .5), eu = eye[u], ev = eye[v];
      const tile = l.tiles.get(Math.floor((eu + weight * ((b[u] + b[u + 3]) * .5 - eu)) / 6))?.get(Math.floor((ev + weight * ((b[v] + b[v + 3]) * .5 - ev)) / 6));
      if (!tile)
        continue;
      for (const t of tile) {
        if (t.side === 0 && t.front * sign < 0 || t.side === 1 && t.front * sign > 0)
          continue;
        const ranges = scope.get(t.source);
        if (!ranges)
          continue;
        let on = false;
        for (let j = 0; j < ranges.length; j += 2)
          if (ranges[j] <= t.first && ranges[j + 1] >= t.first + 3) {
            on = true;
            break;
          }
        if (!on)
          continue;
        let inside = true;
        for (const [nx, nz, k] of t.edges) {
          const fe = nx * eu + nz * ev + k - l.half * (Math.abs(nx) + Math.abs(nz)), fb = nx * b[u + (nx >= 0 ? 0 : 3)] + nz * b[v + (nz >= 0 ? 0 : 3)] + k;
          if (!((fe < 0 ? far : near) * fe + (fb < 0 ? l.max : l.min) * fb > 0)) {
            inside = false;
            break;
          }
        }
        if (inside) {
          witness.add(t);
          return true;
        }
      }
    }
    return false;
  }
  function affine(matrix, start) { return matrix[start + 3] === 0 && matrix[start + 7] === 0 && matrix[start + 11] === 0 && matrix[start + 15] === 1; }
  function test(job, scope) {
    const tree = geometry.get(job.geo), witness = new Set();
    if (!tree)
      return null;
    function visit(node, lo, width, world) {
      const j = node * 6;
      if (lo >= job.end || lo + width <= job.first || tree.boxes[j] === Infinity)
        return true;
      worldBox(tree.boxes, j, world);
      if (outside() || hiddenBox(scope, witness))
        return true;
      if (node >= tree.leaves)
        return false;
      const half = width / 2;
      return visit(node * 2, lo, half, world) && visit(node * 2 + 1, lo + half, half, world);
    }
    const w = job.world, a = job.slots;
    if (!affine(w, 0))
      return null;
    for (let i = 0; i < (a ? a.length / 16 : 1); i++) {
      if (a) {
        if (!affine(a, i * 16))
          return null;
        for (let col = 0; col < 4; col++)
          for (let r = 0; r < 4; r++) {
            const j = i * 16 + col * 4;
            mat[col * 4 + r] = w[r] * a[j] + w[4 + r] * a[j + 1] + w[8 + r] * a[j + 2] + w[12 + r] * a[j + 3];
          }
      }
      if (!visit(1, 0, tree.leaves * tree.stride, a ? mat : w))
        return null;
    }
    // Many covered leaves can use the same floor. Store one conservative
    // requirement per active submitted range, then validate it on the main thread.
    const required = new Map();
    for (const t of witness) {
      const ranges = scope.get(t.source);
      for (let j = 0; j < ranges.length; j += 2)
        if (ranges[j] <= t.first && ranges[j + 1] >= t.first + 3) {
          const key = t.source + ':' + j;
          let pair = required.get(key);
          if (!pair) {
            pair = [t.source, t.first, t.first + 3];
            required.set(key, pair);
          }
          else {
            pair[1] = Math.min(pair[1], t.first);
            pair[2] = Math.max(pair[2], t.first + 3);
          }
          break;
        }
    }
    return [...required.values()].flat();
  }
  channel.onmessage = ({ data }) => {
    if (data.anchors) {
      prepare(data.anchors);
      channel.postMessage({ ready: true });
      return;
    }
    if (data.view && data.view.epoch !== epoch)
      view(data.view);
    for (const g of data.trees)
      geometry.set(g.id, g);
    const scope = new Map(), answers = [];
    let previous = 0;
    for (const job of data.jobs) {
      while (previous < job.scope) {
        const id = data.scope[previous++], first = data.scope[previous++], end = data.scope[previous++];
        let rows = scope.get(id);
        if (!rows) {
          rows = [];
          scope.set(id, rows);
        }
        rows.push(first, end);
      }
      answers.push([job.id, job.version, test(job, scope)]);
    }
    for (const id of data.retired || [])
      geometry.delete(id);
    channel.postMessage({ epoch, answers });
  };
}
