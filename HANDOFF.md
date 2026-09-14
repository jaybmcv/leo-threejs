# LEO Three.js source handoff

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
- `src/special-areas.js`: Captain's bridge geometry and other specialized rooms.
- `src/command-deck.js`: Deck 20 finishes, labels and workstation details.
- `src/areas.js`: area definitions and layout.
- `src/exterior-finish.js`, `src/passenger-windows.js`, `src/glazing-finish.js`: exterior finishes and glazing.
- `src/space-backdrop.js`, `src/thruster-effects.js`: star field, motion streaks and thruster effects.
- `scripts/build-all.mjs`: authoritative main build sequence.
- `src/reference-shuttle/`: separate reference/form study, not the main fitted ship viewer.

Three.js is pinned to 0.185.1 in the lockfile. Native canvas is used by the Node export pipeline; esbuild bundles the browser viewer.

## Preserve the design

Keep the accepted exterior silhouette, deck alignment, room layout and circulation. Ship coordinates use +X toward the nose, Y up and Z across the ship. Deck 20's floor is at Y=36.3. The model is an architectural concept, not an engineering-certified vehicle. Display graphics are concept graphics, not live ship telemetry.

For bridge-only changes, rebuild these in sequence:

```sh
node scripts/build-areas.mjs
node scripts/build-interior.mjs
node scripts/build-assembly.mjs
node scripts/check-command-deck.mjs
node scripts/validate-glb.mjs
```

Run the full build first on a fresh clone. `npm run check` runs the broader project checks. Inspect both eye-level and overview views after changes.

## Export or represent in another tool

The build writes GLB files into `output/leo-interior-v01/`. `leo-full-ship.glb` is the combined model; `leo-service-areas.glb` contains the fitted rooms. The combined export is large. Importers must support `EXT_mesh_gpu_instancing` to preserve instanced content correctly. Importing only a GLB will not recreate the viewer's HTML controls or JavaScript effects; use the source for those.

For a static web distribution, run `npm run build:public` after the main build. This creates `dist/` with compressed model parts and the matching browser loader. Serve that entire directory over HTTP; do not open its HTML as a file URL.

The `.openai/hosting.json` file identifies the existing Sites deployment. Another tool should build locally and should not deploy to that project or change its access unless the owner explicitly requests it.

Suggested instruction to another tool: “Read HANDOFF.md, install and build the project, then inspect the Captain's bridge in the actual Three.js viewer. Preserve the existing ship geometry and layout; improve its presentation using the real source and assets rather than replacing it with a mockup.”
