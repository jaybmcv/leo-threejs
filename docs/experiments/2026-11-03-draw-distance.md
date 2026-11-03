# LEO atrium draw distance: measured comparison

2026-11-03 · render-pc · local runtime experiment on design/leo-selected-interiors-20261102.

The selective 450 m prototype increased the measured mean frame interval from 24.7 to 28.9 ms (+4.3 ms, +17.3%). The cost varies by viewpoint and camera movement. This is an instrumented desktop comparison, not a universal device estimate or a changed shipping default.

## Final paired 1080p result

| Measurement | Current 150 m | Selective 450 m |
| --- | ---: | ---: |
| Frame interval, equal-weight segment mean | 24.7 ms | 28.9 ms |
| Frame interval, pooled p95 | 48.3 ms | 39.6 ms |
| CPU animation callback, wall-clock mean | 23.2 ms | 28.0 ms |
| GPU elapsed time, all render passes | 14.7 ms | 20.5 ms |
| Submitted triangles per frame | 11,066,125 | 8,699,158 |
| Draw calls per frame | 2,538 | 4,878 |

CPU callback wall time and GPU elapsed time overlap. Do not add them. The CPU measurement can include driver waits; GPU elapsed time can include command-feed stalls. Frame intervals include browser/display scheduling. A 60 fps target allows 16.7 ms per frame.

| View and motion | Current mean, ms | Selective 450 m mean, ms | Change, ms |
| --- | ---: | ---: | ---: |
| Deck 6, lengthwise, standing | 19.2 | 26.7 | +7.5 |
| Deck 6, lengthwise, turning | 26.2 | 25.8 | -0.4 |
| Deck 6, across the lake, standing | 24.9 | 28.0 | +3.1 |
| Deck 6, across the lake, turning | 38.6 | 26.3 | -12.3 |
| Deck 7, upper gallery, standing | 16.8 | 32.3 | +15.5 |
| Deck 7, upper gallery, turning | 22.3 | 34.5 | +12.2 |

Each row averages two repeats. Full repeat values, paired deltas and raw-sample percentile summaries are in the attached analysis JSON. The live lab table uses the worst segment p95, whereas this report's p95 pools the raw samples; those are different statistics.

The final visibility-update samples averaged 53.0 ms for current and 1.1 ms for the selective candidate. The candidate submits about 4,878 draw calls per frame versus 2,538 current, and GPU elapsed time rises by 5.8 ms. Cheaper visibility decisions reduce spikes while the extra drawing still has a cost.

## What the candidate changes

The detailed camera reaches 450 m, enough to span the approximately 382 × 127 m atrium. The distant haze begins at 440 m to avoid a broad overlap with the detailed glazing. Atrium fog is lighter at distance.

While the player is in the open atrium, render-band selection covers its full vertical space, from deck 6 through the roof. Public atrium zones, terraces, cafés, dining spaces, garden galleries, public overlooks and circulation details remain within the camera frustum without repeated opaque-visibility probes. Known remaining room owners farther than 90 m are skipped there; unknown owners retain normal visibility checks. The public-owner exception also preserves upper public-front details that the existing nearby-deck gate would hide.

Cabin privacy, the current-deck cabin gate, the 40-nearest-cabin furniture limit and the 45 m lifeboat-interior limit remain. Entering a café or garden can leave the open-atrium classification and return to the existing traced vertical selection. This does not claim every hidden room or every distant cabin fitting is rendered. No geometry, art, lighting assets, collision data or navigation data were regenerated.

## Why a blanket increase was rejected

The first 720p sweep raised the camera, visibility rays and vertical probes together. Current averaged 21.7 ms; 300 m averaged 56.8 ms; unrestricted 450 m visibility averaged 136.6 ms. Long visibility queries were especially expensive while turning. The extra-detail diagnostic also remained expensive (67.9 ms).

An exploratory 1080p sweep found that changing only the camera reached 55.3 ms, while the first selective prototype reached 24.6 ms against 41.1 ms current. The final confirmation above alternates the two profiles at each viewpoint/motion and also preserves fallback circulation owners explicitly. Baseline timing varied across the grouped runs. Use the final adjacent-pair result for the final candidate; retain the earlier runs as exploratory evidence.

## Method and limits

- Intel Core i9-11900K; 64 GiB installed system memory; WebGL selected one NVIDIA RTX 3090 via ANGLE Direct3D 11; Chromium 156 on Windows. The machine has two installed GPUs, but this is not a combined-GPU result.
- Fixed 1920 × 1080 rendering buffer, pixel ratio 1, automatic resolution changes disabled. The display panel scales the iframe without changing that buffer.
- Three verified supported viewpoints, stationary player, still and sinusoidal turning-camera motion. Each segment has 3 seconds warmup and 6 seconds measurement. Two rounds, with profile order reversed in round two; paired profiles are adjacent for each view/motion.
- Same prepared geometry artifact: 51f2878d0e5da865c38f7622ed48f5ec07f3f373f358d39701fe9638612a18d7. Runtime adapters only; main and the regular preview remain unchanged.
- GPU timing sums sequential queries around all three renderer passes using EXT_disjoint_timer_query_webgl2. Query availability and disjoint state are checked; invalid readings are excluded. See the [Khronos extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).
- Final recorded segments valid: 24/24; no hidden frames or invalid GPU queries. Start/end positions are retained in the raw rows. No physical-phone or older-laptop measurements were performed. These measurements precede integration of the separate performance branch.
- One pre-ready MutationObserver error appeared in the browser console without a source URL; it was not found in the LEO runtime sources. No measured segment failed because of it.
- Source adapters, client syntax, paired ordering, all-pass counters, input restoration and profile reset behavior were checked. The real browser completed 108 measured segments across the three runs. Existing geometry/navigation validation was reused with the identical prepared artifact.

## Recommendation and reproducibility

Treat the selective 450 m policy as an optional long-view mode for the open atrium. The upper-gallery cost is still substantial, and this build does not hold 60 fps throughout. Retain shorter enclosed-interior and cabin-detail limits, and validate transitions plus lower-powered devices before choosing a shipping default. The remaining rendering work includes static baked chunks, glass overdraw, distant façade/proxy geometry, foliage and draw-call submission. Coordinate these changes with the other performance work before rebasing.

Run `node scripts/draw-distance-lab.mjs` and use the visible controls at http://127.0.0.1:4195/. The lab reuses the verified geometry and builds its runtime in seconds. Run `node scripts/draw-distance-lab/analyze.mjs` for saved results. See [the lab guide](../../scripts/draw-distance-lab/README.md).

Evidence runs: distance-1793715999369-6uol7q.jsonl, distance-1793716918060-frkxv7.jsonl, distance-1793717572610-qlawxl.jsonl. Aggregate evidence is [saved beside this report](data/2026-11-03-draw-distance-analysis.json). Full raw rows and screenshots are retained in the local outputs/leo-draw-distance-evidence directory. All work remains on the isolated design branch; no deployment or merge was performed.
