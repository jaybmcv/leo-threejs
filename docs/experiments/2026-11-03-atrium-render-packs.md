# Precomputed atrium render packs

The public producer now builds render-only batching/LOD packs once and reuses them on later public builds. It reads the immutable prepared world through `readPreparedWorld`, preserving band keys, direct child order, parent transforms, materials and shared geometry. It does not change the prepared artifact or its source provenance, and does not run the ship/model producers.

`scripts/public-v2.mjs` adds the result under `asset-manifest.json["atrium-geometry"]` after publishing the prepared walk. The entry has a flat `parts` array compatible with the existing public size checks and review-page URL remapping. Desktop and constrained variants retain the 128 MiB and 48 MiB geometry budgets respectively.

Owned attribute and index arrays are deduplicated across variants, encoded losslessly with meshoptimizer, then packed into individually hashed gzip chunks. Index sequence encoding preserves index order; vertex encoding preserves the original bytes and only adds removable alignment padding. No position quantization is applied. Constrained arrays are placed first so constrained visitors fetch two pool chunks instead of downloading the desktop pool. All public parts remain below 16 MiB, and the producer separately caps the packs at 32 MiB compressed.

The runtime transport helper accepts verified inflated chunks as `{offset: part.poolOffset, bytes}` and reconstructs the original packed binary. It validates ranges and codec dimensions, yields between arrays, and uses only `MeshoptDecoder`. The caller verifies the resulting whole-binary SHA before the asynchronous pack hydrator validates source bindings and prepares the render meshes. Preparation yields on an 8 ms work budget, including checkpoints every 32,768 index values. Originals remain intact throughout preparation; one final source check precedes atomic installation. Runtime loading does not invoke the simplifier.

Cache identity includes the prepared artifact SHA, the actual transitive builder/optimizer/codec/runtime-helper import graph including npm source, package pins, variant budgets, chunk format and native build/compression toolchain. A hit verifies every compressed chunk, gzip payload, lossless decoded binary and whole-binary SHA. Corruption or partial writes cause a cache miss. A dependency edit during generation rejects publication instead of assigning the result to an obsolete cache key.

Measured on the canonical prepared artifact `51f2878d0e5da865c38f7622ed48f5ec07f3f373f358d39701fe9638612a18d7`:

| Measurement | Desktop | Constrained |
|---|---:|---:|
| Network bytes for chosen variant | 18,370,026 | 8,451,967 |
| Decoded pack binary bytes | 120,312,344 | 44,688,460 |
| Retained geometry bytes reported by optimizer | 134,216,894 | 50,331,146 |
| Bound original meshes | 2,128 | 1,691 |
| Canonical Node synchronous validation | 267.1 ms | 71.3 ms |

Both variants together occupy **18,645,996 unique public bytes** across seven hashed files. Cold generation in the final public build took 39.5 seconds; verified warm publication took 2.1 seconds. Those Node timings preceded the asynchronous hydration refactor and measure the entire synchronous offline validation, not the runtime's maximum work slice. Final browser measurements must check the asynchronous work slices and final atomic installation separately. The final public folder still requires the existing 250,000,000-byte gate.

Validation completed:

- 21 transport/cache fixture checks: dependency closure changes, newly imported dependencies, artifact/budget keys, shared chunks, multi-chunk round trip, padded vertex strides, missing/overlapping spans, memory bound, corruption and partial-cache rejection.
- Canonical export → hydrate → disable → enable → dispose for both variants, with no missing binding bounds.
- 23 pack fixtures passed after the asynchronous refactor, including yielding while originals remain visible, source changes during preparation, interrupted scheduling and queued browser-style task execution. The small fixture reached 27 checkpoints, with a 0.097 ms maximum measured slice and 0.081 ms installation; those figures do not represent the full scene.
- Warm-cache decode verified every original binary byte via its SHA.
- All 31 runtime freshness/migration checks passed with the original prepared identity intact.

Commands:

```powershell
node scripts/check-atrium-geometry-pack-cache.mjs
node --max-old-space-size=11000 scripts/build-atrium-geometry-pack.mjs .qa/atrium-geometry-pack-output
```

The standalone command publishes only render-pack test output and warms the pack cache. The normal public build invokes the same producer automatically. No full public build was run as part of this isolated producer verification.

## Automatic detail and startup

New visitors default to Auto. Device memory at or below 4 GB, four or fewer CPU threads, coarse pointers or save-data preference start Performance; other devices start Balanced. A previous automatic Performance result is remembered separately. Existing saved manual choices remain fixed. Auto evaluates median frame intervals over six-second foreground windows after four seconds of warmup, with a 12-second change cooldown and two good windows before increasing detail. Hidden/unfocused pages, the graphics dialog and stalls above 250 ms do not provide adaptation samples. This is a conservative heuristic, not GPU identification or a promised frame-rate target.

All four walk entry points create a cheap runtime controller before the first draw. That controller starts the selected pack only after the existing first playable frame has marked the page ready. Constrained device hints choose the 48 MiB variant; other devices use 128 MiB even when Auto or the user selects Performance. The larger pack has more batching/LOD coverage, so lowering visual detail must not inadvertently remove optimizations on a capable PC. A later manual/automatic quality change reuses its loaded variant. Original geometry remains complete while fetching/decoding/preparing, or if the pack is unavailable. There is no client simplifier fallback. Geometry download and attachment still have costs; they do not gate first-playable readiness.

The menu shows Auto plus the effective current level and preserves High, Balanced and Performance overrides. The lab refuses geometry benchmarks until the pack is ready. Runtime startup sequencing/lifecycle has six focused checks; automatic/manual policy has twelve. Browser and public-build evidence follows.

## Browser verification

The public build completed in 129.1 seconds, reused the exact prepared artifact, and passed public/startup-asset and size checks at 234.0 MB (250 MB limit). The compiled walk bundle excludes the mesh simplifier. Auto, the effective current-level label, prior saved manual choice, persistence after reload, Escape/focus return, More-menu access, and 1280×720 / 390×844 layouts were exercised in the actual walkthrough. Auto changed from Balanced to Performance during the local run.

Both real transport variants hydrated successfully in the comparison lab, without warnings or missing bindings, and began loading only after first-playable readiness. These are individual local observations, not portable loading/FPS guarantees:

| Browser observation | Desktop | Constrained |
|---|---:|---:|
| Background download/decode/prepare elapsed | 5,346.4 ms | 3,634.4 ms |
| Hydration elapsed (including yields) | 498.1 ms | 266.1 ms |
| Hydration CPU work | 158.1 ms | 81.7 ms |
| Yield count | 20 | 10 |
| Largest hydration work slice | 9.0 ms | 8.0 ms |
| Atomic final installation | 5.2 ms | 2.2 ms |

The complete atrium was visually checked from the neighborhood entrance with the desktop Balanced pack. The compact pack was also exercised with Performance there. It retains less optimization coverage to respect its memory cap; this motivated choosing pack size from device hints independently of the visual preset. The final policy is covered by the runtime lifecycle fixtures. The 5.6-second visitor-side simplification from the earlier experiment is superseded; no new universal frame-time saving is claimed. GPU upload/first-use costs and background bandwidth remain.

Actual screenshots and raw diagnostics are saved in the task outputs: leo-auto-detail-settings.png, leo-auto-detail-compact.png, leo-auto-detail-atrium.png, and the desktop/constrained diagnostic JSON files. Capture bundle: walk.e50f5208b6.js; subsequent runtime changes only correct diagnostic timing labels and the device-based pack choice.
