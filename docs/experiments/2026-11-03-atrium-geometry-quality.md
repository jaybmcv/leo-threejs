# Atrium geometry detail and static batching

The full atrium remains available through the existing camera-visible atrium policy. A new Detail menu offers High, Balanced (default), and Performance. The browser remembers the choice, changes apply immediately, and the existing Res control remains independent.

Static opaque prepared meshes are merged within their original band, compatible material/attributes/render flags, and 80 m X/Z grid cells. Original geometry and physics references remain intact. Artwork, transparent surfaces, live meshes, custom render callbacks, morphs, skins and mirrored transforms are excluded. This uses ordinary Mesh objects and does not require WEBGL_multi_draw. Larger combined bounds can submit slightly more offscreen geometry; the spatial grid limits this tradeoff.

Index-only geometric LOD shares immutable vertex attributes. Attribute-aware meshoptimizer simplification locks borders and uses absolute error bounds of 0.015/0.05 m in geometry space. Runtime selection accounts for transform scale, projected error and distance, with hysteresis. High retains exact geometry; Balanced uses a conservative 0.65 px target beyond 55 m, Performance 1.25 px beyond 30 m. Thresholds have hysteresis; unsupported cases remain exact. This never removes an entire atrium band to save work.

Additional retained render buffers are capped at 128 MiB on desktop and 48 MiB on constrained devices. Simplification has a 3.5 s / 0.8 s work budget, so generated coverage varies with the device and load during startup. One browser initialization retained 117.6 MiB and took 5.58 s including 3.50 s of simplification. These are additional buffer and initialization costs, not total application memory/startup time. CPU/GPU copies and temporary allocations are not a combined 128 MiB memory guarantee.

The first BatchedMesh prototype reduced submissions more aggressively but added GPU shader/indirection work. It was replaced after browser measurements. The final ordinary-mesh approach prioritizes preserving the view and limiting GPU overhead.

## Measurements and limits

Device: render-pc, Windows, Chrome 156 in-app browser, RTX 3090 through ANGLE D3D11/WebGL2, fixed 1920 × 1080 drawing buffer at pixel ratio 1. GPU time uses EXT_disjoint_timer_query_webgl2. Views: west atrium, neighborhood approach, and linen doorway; still and turning samples; two reversed-order rounds, 3 s warm-up and 6 s sampling per segment.

Three-view run `distance-1793738796403-xuww4m.jsonl` measured these average render workloads (equal segment weighting):

| Setting | Draw submissions/frame | Triangles/frame |
| --- | ---: | ---: |
| Existing full visible atrium | 4,925 | 9.304 M |
| High | 4,233 | 9.382 M |
| Balanced | 4,233 | 8.807 M |
| Performance | 4,233 | 8.725 M |

That is about 14% fewer submissions in every preset, 5.3% fewer triangles in Balanced and 6.2% fewer in Performance. High can submit slightly more triangles because a merged bound keeps its neighboring pieces together.

Do not use this run for a precise frame-time claim: background/minimized app behavior contaminated timings. A subsequent run reached roughly 1,000 ms frame intervals while document.visibilityState still reported visible. It is explicitly unusable for performance conclusions.

After Jay restored the app and opened this chat, the focused west-view confirmation `distance-1793739910763-7p8rkx.jsonl` completed 16 segments. Its workload reduction repeated: 4,422 to 3,766 submissions; 8.255 M to 7.871 M Balanced / 7.762 M Performance triangles. Frame medians were 19.8 ms baseline, 19.3 ms High/Balanced and 19.6 ms Performance, but large repeat-to-repeat spikes remained (pooled p95 approximately 37–58 ms). There is no dependable claim that this recovers the earlier 35–38 ms cost. Do not substitute pooled medians for equal-segment means or compare different runs as a controlled before/after.

Raw runs remain under `.qa/draw-distance-results/`; summarized evidence is in the workspace `outputs/leo-geometry-quality-measurements.json`. The lab offers a current-view-only checkbox for shorter repeated comparisons. Rendering workload is established; a reliable device-specific frame-time gain still needs quieter, foreground measurement.

## Verification

- Geometry checks cover open holes/borders, prepared pooled ranges, transforms/shear, high and near restoration, disposal of shared attributes, memory limits, excluded/live/art geometry and authoring skip.
- Preference checks cover defaults, persistence, invalid values, storage failure and subscriptions.
- Existing atrium boundary and height checks pass.
- Physical signature remains `88dfcdcb9ae8e24111e00720af61f6ae952930c5658514501d6f789cde8cd67d`: 656 BVHs, 35,270 rest records, 34,974 seats and 5,028 placements. All 30 prepared geometry transport files are identical.
- Rendered doorway captures retain the far galleries. Keyboard arrow selection and Escape close were exercised in the actual game UI. Normal public-preview persistence and walking are recorded in the final validation artifact.

Runtime-only building uses the separately documented [freshness backport](2026-11-03-runtime-freshness-backport.md), preserving artifact `51f2878d0e5da865c38f7622ed48f5ec07f3f373f358d39701fe9638612a18d7`. No main merge, public deployment, lounge artwork or exterior artwork change is included.

Further substantial savings will need broader precomputed LOD coverage and fewer remaining submissions; these results do not establish a 60 FPS target or physical-phone performance.
