# Atrium visibility from adjoining spaces

2026-11-03 · render-pc · design/leo-selected-interiors-20261102

The atrium previously disappeared when the walker left its footprint, even while
looking into it through a doorway or glass. The runtime now separates physical
membership from camera-visible atrium. It retains the full atrium band and fog
while visible, and unions that band with local traced visibility so the observer's
floor and ceiling remain present, including views from below Deck 6.

The sight detector clips a conservative atrium envelope to the camera. Within a
known enclosed footprint it checks the room's exits instead. Opaque BVH triangle
shadows must cover the entire visible portal to hide it; a finite set of blocked
sample rays alone is not accepted as proof. Glass is transparent to sight. The
budget is 24 point tests plus bounded proof lookups; unresolved cases remain
visible. Checks are cached, normally 150 ms apart, with short closing hysteresis.
Large camera changes bypass the interval. Matrices are refreshed before culling.

Phase-4 instances retain their original matrices, owners, collision and seat data.
Conservatively offscreen instances and subpixel detail are omitted from rendering.
The projected diameter threshold is 0.75 drawing-buffer pixels, or 0.54 for already
visible detail. Motion padding and an immediate-update guard protect turns. This
is a detail cutoff, not a new decimated geometric LOD. Existing distant structural
rendering and cabin/lifeboat limits remain. Prepared geometry bounds are preserved
because position buffers may pool vertices belonging to unrelated meshes.

## Paired 1080p measurement

Actual RTX 3090 / Chromium 156 session, fixed 1920 × 1080 buffer and pixel ratio 1.
Two reversed-order rounds, three views, still and turning, 3 s warmup plus 6 s
sampling. All 36 segments were valid. This compares policies in the same
instrumented runtime against identical prepared geometry; it is not a phone or
older-laptop result. The prior regular preview remained open in the browser.

| Frame interval (mean of two repeats) | Previous position switch | Camera sight + detail culling | Delta |
| --- | ---: | ---: | ---: |
| Neighborhood approach · still | 41.1 ms | 79.5 ms | 38.4 ms |
| Neighborhood approach · turning | 98.6 ms | 93.3 ms | -5.3 ms |
| Linen doorway · still | 44.5 ms | 80.0 ms | 35.5 ms |
| Linen doorway · turning | 199.6 ms | 115.7 ms | -83.9 ms |
| Open atrium · still | 65.3 ms | 65.1 ms | -0.2 ms |
| Open atrium · turning | 51.7 ms | 59.8 ms | 8.1 ms |

Giving each view/motion segment equal weight, the mean of segment frame means was 83.4 → 82.2 ms;
the pooled frame mean was 60.6 → 78.2 ms, and
pooled p95 was 156.2 → 123.5 ms.
The aggregate hides the tradeoff: stationary doorway views render substantially
more structure, while turning avoids expensive old owner queries. Repeat values
vary, especially in the open atrium; do not interpret the small overall difference
as a stable speedup. The equally weighted segment mean GPU elapsed time increased 11.2 ms.
CPU and GPU overlap and must not be added.

The new sight check averaged 0.86 ms when reevaluated (p95 1.20 ms).
Detail culling removed about 108 offscreen instances (equally weighted segment means);
no subpixel instances were removed at 1080p (four were omitted in the 720p entrance
check). Compared with the same sight policy without detail culling, the observed
equally weighted segment mean frame difference was -0.71 ms and GPU difference -0.61 ms. These are modest, noisy savings.

Raw run: distance-1793732105727-0pvz93.jsonl. The lab and analyzer are under scripts/draw-distance-lab.
The original lab provenance names base HEAD 0d81421; this run included the current
uncommitted boundary fix. Its generated runtime is separately identified in the
saved review provenance.

## Validation

26 sight fixtures, 22 integration/culling checks, 11 detail checks and 16 height
cases pass. The normal prepared runtime compiles. The 1,200-ray visibility fixture
matches the physical ray hits and distances exactly and does not modify the
physical collider. The canonical prepared refresh completed successfully. All 30
geometry transport parts are byte-identical to the prior artifact. The decoded
physical signature is unchanged: 656 BVHs, 35,270 rest records, 34,974 seats and
5,028 placements. Public build and size gates pass at 215,332,013 bytes, with
34,667,987 bytes of headroom. The regular walkthrough loaded runtime
`walk.b6f7676944.js` from clean source commit `7ddfea437bbf01454942e3b55941569f86144af6`.
A native five-second backward walk from the Deck 6 threshold retained distant
galleries through the opening and the local floor/ceiling. Browser warnings and
errors were empty. Exact post-movement coordinates were not read. The canonical
prepared refresh took about 56 minutes despite identical geometry; its legacy
source coupling and oversized serial cuts remain build-time costs in this branch.

Hydro-Nip Lounge and exterior artwork were not edited. Main is untouched. The
parallel performance/build work has not been merged or rebased into this branch.
