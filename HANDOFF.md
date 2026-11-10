# LEO Three.js source handoff

## Layout 2 — the live ship

Layout 2 is what leo.marscatsvoyage.com serves (checked 2026-11-09: the site's `build.json` named 034a0c7c, and `vercel.json` publishes `dist-v2`). It has been the default build since the switchover merged on 2026-11-02 (#197): with `LEO_LAYOUT` unset, the build, public build and checks select layout 2 and write `output/leo-interior-v02` and `dist-v2`. `LEO_LAYOUT=1` selects the pinned rollback under `legacy/v1`, which writes `output/leo-interior-v01` and `dist`. Selection is a build input; URL parameters cannot switch worlds. The sections under "Layout 1 reference and history" below describe the earlier ship.

The accepted source of truth is [the v2 plan](src/plan/README-v2.md), [the selected walk](src/plan/README-phase2.md) and [recorded decisions](src/plan/decisions-v2.json).

For v2 work, read the selected plan first. Coordinates are ship metres: X forward, Y up, Z starboard. **Walk yaw 0 faces +Z and 90 degrees faces +X**. The v2 adapters were folded into the source at the switchover (9e348c22), so layout 1 now lives only in `legacy/v1`, a pinned snapshot whose ship geometry is not to be edited ([legacy/README.md](legacy/README.md)). The 283 existing v2 stair/lift signs keep their planned placement in `src/plan/signs-v2.js`.

The v2 Go-to catalog covers every nonaggregate selected room, retained fixed room, escape shuttle and named activity approach. It groups twenty decks plus fin/crown, searches current names, uses real floor points, and omits the Deck 20 crew gallery as a public destination. Runtime code must use the trimmed layout shape: per-deck corridor lists are absent; use `layout.circulation.corridors`.

`node scripts/check-goto-v2.mjs` uses this checkout’s prepared walk by default; `--prepared=<directory>` selects a frozen prepared-walk folder for targeted review. `node scripts/check-live.mjs` runs the v2 live checks by default; with `LEO_LAYOUT=1` it runs the retained v1 test body through `scripts/run-legacy.mjs`. The focused v2 pose smoke checks floor support and network pose delivery; it does not substitute for the full feature/server interaction suite.

The Go-to review's PowerShell commands and browser set-up were written to `output/phase7/REPORT-goto.md`. `output/` is ignored and the report was never committed, so a fresh clone does not have it. Deploys are described in [FAST_DEPLOYS.md](FAST_DEPLOYS.md).

## Layout 1 reference and history

This is the complete procedural source for the LEO interactive ship study, including the latest five Captain's bridge refinement passes (September 12, 2026). Start here; the main README also contains historical build notes.

The canonical visual reference is `src/reference-shuttle/assets/full-reference.png`, updated from the current V35 website perspective export on 2026-09-14. The older concept is retained at `src/reference-shuttle/assets/full-reference-concept.png` for comparison only.

## Run locally

Use a current Node.js LTS runtime (Node 22 or newer) and npm:

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4173/?area=d20-bridge-9&view=inside` for the bridge, or `/` for the ship viewer. The full build exports large models and can take several minutes and substantial memory. Generated output and dependencies are intentionally excluded from Git.

`npm run build` restores the accepted exterior from the committed compressed chunks in `src/assets/accepted-exterior/`, verifies its SHA-256, and builds the exterior finishes, interiors, residences, gardens, ship areas, aft systems and assembled ship. No local files from the original author's machine are needed for the main build. The original logo asset is included under `output/leo-interior-v01/assets/`.

## Where to work

- `src/viewer.js` and `src/viewer.html`: interactive Three.js scene, cameras and browser controls.
- `src/explode.js`: the exterior's Explode dial: which parts move where, the exploded camera frame, call-outs and detail culling.
- `src/special-areas.js`: Captain's bridge geometry and other specialized rooms.
- `src/command-deck.js`: Deck 20 finishes, labels and workstation details.
- `src/areas.js`: area definitions and layout.
- `src/exterior-finish.js`, `src/passenger-windows.js`, `src/glazing-finish.js`: exterior finishes and glazing.
- `src/space-backdrop.js`, `src/thruster-effects.js`: star field, motion streaks and thruster effects.
- `scripts/build-all.mjs`: authoritative main build sequence.
- `src/reference-shuttle/`: separate reference/form study, not the main fitted ship viewer.

Three.js is pinned to 0.185.1 in the lockfile. Native canvas is used by the Node export pipeline; esbuild bundles the browser viewer.

## Visitor view and studio mode

The viewer opens in the Mars Cats Voyage visitor theme, matched to marscatsvoyage.com (second `<style>` block in `src/viewer.html`). The logo and the website's three typefaces live in `src/brand/` (fonts under SIL OFL 1.1), and `scripts/brand-assets.mjs` copies them next to `index.html` in both builds. Add `?studio=1` to any view to bring back the build tools: GLB downloads, render exports, the Notes link, V35 labels and the engineering notes.

## Cosmo, the crew cat

Every cat figure in the viewer is Cosmo (`src/vendor/cosmo/`, from the Cosmo-ThreeJS package). `src/cosmo.js` poses the T-pose rig with relaxed arms and bakes it into four shared static meshes; `scripts/build-cosmo.mjs` bundles it and `scripts/viewer-page.mjs` writes it as a content-hashed `cosmo.<hash>.js` (see Load speed), which the viewer loads after the exterior is up and uses to replace the `Mars_cat_1.75m` and `Resident_scale_1_75m` blockout figures. The exported GLBs still contain the blockout figures.

## Preserve the design

Keep the accepted exterior silhouette, deck alignment, room layout and circulation. Ship coordinates use +X toward the nose, Y up and Z across the ship. Deck 20's floor is at Y=36.3. The model is an architectural concept, not an engineering-certified vehicle. Display graphics are concept graphics, not live ship telemetry.

For bridge-only changes, rebuild these in sequence:

```sh
node scripts/build-areas.mjs
node scripts/build-interior.mjs
node scripts/build-assembly.mjs
```

Run the full build first on a fresh clone. `npm run check` runs the broader project checks. Inspect both eye-level and overview views after changes.

## Export or represent in another tool

The build writes GLB files into `output/leo-interior-v01/`. `leo-full-ship.glb` is the combined model; `leo-service-areas.glb` contains the fitted rooms. The combined export is large. Importers must support `EXT_mesh_gpu_instancing` to preserve instanced content correctly. Importing only a GLB will not recreate the viewer's HTML controls or JavaScript effects; use the source for those.

For a static web distribution, run `npm run build:public` after the main build. This creates `dist/` with compressed model parts and the matching browser loader. Serve that entire directory over HTTP; do not open its HTML as a file URL.

The live site is leo.marscatsvoyage.com. Its Vercel project now serves layout 2 from `dist-v2/` (`vercel.json`); `dist/` is the layout 1 output. Another tool should build locally and should not deploy to it or change its access unless the owner explicitly requests it.

Suggested instruction to another tool: “Read HANDOFF.md, install and build the project, then inspect the Captain's bridge in the actual Three.js viewer. Preserve the existing ship geometry and layout; improve its presentation using the real source and assets rather than replacing it with a mockup.”

## Load speed

- The build writes `index.html` with the viewer and Cosmo as content-hashed files (`viewer.<hash>.js`, `cosmo.<hash>.js`, see `scripts/viewer-page.mjs`), so hosts can cache them for a year: a change always gets a new name. The Vercel project for leo.marscatsvoyage.com sets `Cache-Control: public, max-age=31536000, immutable` for them in its `vercel.json`.
- Fonts ship as WOFF2 built from the OFL sources in `src/fonts-src` by `python scripts/build-fonts.py` (all weights kept; Archivo's unused width axis pinned at 100 %; subset to Latin, Greek, punctuation, arrows, maths and shapes).
- Reflection lighting is baked into `src/brand/environment-cube.png` (RGBE cube faces per mip level; `src/environment.js`). After changing the environment or upgrading three, open the viewer with `?studio=1&bake=environment` and save the download over that file. If the file is missing the viewer prefilters it at startup, as before.
- Cosmo's textures and geometry literals are compacted by `python scripts/shrink-cosmo-textures.py` (see `src/vendor/cosmo/README.md`).
- The tour artwork loads on the first walk; the first frame's shaders compile in parallel behind the loading screen, and each tab's shaders warm while idle (`warmViews` in `src/viewer.js`).
