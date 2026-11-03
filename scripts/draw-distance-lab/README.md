# Atrium draw-distance experiment

Run from the repository root, with an existing verified `dist-v2` prepared build:

```powershell
node scripts/draw-distance-lab.mjs
```

Open `http://127.0.0.1:4195/`. The builder reuses the existing geometry and makes a separate instrumented runtime in `.qa/draw-distance-lab`. It does not regenerate geometry or change production source files. `provenance.json` records the source commit, prepared asset and generated runtime.

Use the visible profile/view controls to inspect the result, then run a comparison. Keep this the only active LEO renderer. The iframe has a fixed rendering buffer even when its display is scaled to fit the panel. Device pixel ratio is one and automatic resolution changes are disabled for the experiment.

| Profile | Camera | Visibility rays / vertical probes | Detail policy |
| --- | ---: | ---: | --- |
| Current | 150 m | 90 / 12 m | Existing limits |
| Long | 300 m | 300 / 64 m | Existing furniture limits |
| Whole atrium | 450 m | 450 / 80 m | Existing furniture limits |
| Extra detail | 450 m | 450 / 80 m | All current-deck cabin furniture; phase-6 atrium owners kept in frustum |
| Camera only | 450 m | 90 / 12 m | Existing visibility selection |
| Open atrium | 450 m | Full atrium height while in the open atrium; 90 / 12 m elsewhere | Public atrium owners kept in frustum; known remaining room owners beyond 90 m skipped while in the atrium |

The long profiles also move the far-haze near plane to camera far minus 10 m and lighten atrium distance fog. Cabin privacy, the current-deck cabin gate, and the 45 m lifeboat-interior limit remain. The open-atrium profile keeps the 40-nearest-cabin limit.

Open-atrium public owners include phase-6 zones and terraces, bow cafés, neighborhood cafés/dining, garden commons, public-front rooms, circulation, the voyage forum, observation lounge and the two deck-16 shared rooms. They bypass the launch-D nearby-deck gate when viewed from the open atrium. Unknown owners retain their normal visibility tests. Entering an enclosed café/garden can leave the open-atrium classification and return to the existing traced vertical selection.

Each run uses two reversed-order rounds, three supported standing viewpoints, and still/turning-camera samples: 3 seconds of warmup and 6 seconds of sampling per segment. The 1080p button compares Current, Camera only and Open atrium. The 720p button compares all six profiles. The paired-confirmation button compares Current and Open atrium at 1080p, switching profiles for each view/motion instead of grouping all views under one profile. This keeps the paired samples closer in time.

Measurements include CPU animation-callback time, frame intervals, all-pass GPU timer queries, draw calls, triangles, span queries and phase-4 queries. GPU timers cover all three render passes and exclude unavailable/disjoint results. CPU and GPU times overlap and must not be added. GPU elapsed time can include command-feed stalls. Frame intervals include browser/display scheduling. Rendering instrumentation is shared by every profile.

Raw arrays are saved after each segment to `.qa/draw-distance-results/*.jsonl`. Each row records validity, hidden frames, context/error events, actual hardware/backend/resolution and starting/ending position. The live table shows the average segment mean and the **worst segment p95**. Analyze saved runs with:

```powershell
node scripts/draw-distance-lab/analyze.mjs
```

`analysis.json` contains pooled percentiles, equal-weight segment means, paired deltas and per-view repeat results. Pooled p95 and worst-segment p95 answer different questions; label them explicitly in reports.

This is a local experiment, not a changed shipping default. The runtime adapters assert exact source matches so an incompatible upstream change fails clearly. Reassess the public-owner classification and rerun the comparison after integrating another branch's visibility/performance work. Desktop results do not establish physical-phone or older-laptop performance.
