# Phase 2 selected walk world

The default is still layout 1. In PowerShell:

    $env:LEO_LAYOUT='2'
    npm run build
    npm run build:public
    npm run check
    npm run check:walk
    node scripts/serve-v2.mjs

Review http://127.0.0.1:4182/ and walk.html locally. Remove the LEO_LAYOUT environment variable to return to v1. Selection is a build input; URL parameters cannot select the other world. Models are in output/leo-interior-v02 and public assets in dist-v2. Nothing is deployed.

## Isolation and frames

The v1 model and walk source are untouched. scripts/v2-plugin.mjs supplies the selected layout as a virtual import and applies explicit opt-in adapters while bundling the v2 Node/browser world. Its registry adapter installs production frames in a separate selectedFrames map before any feature module evaluates. Temporary debug adjustments compose over that plan; clearing them cannot restore v1. The immutable v1 frames still decode legacy links and facing. The observation lounge explicitly supplies a fittingFrame at its accepted entry X170 while its plan centre remains X190, preventing the contents and overhead promenade sign from shifting into the ramp. Resized legacy links are clamped into their target room; lv=2 positions are already current. Retained aft rooms receive explicit unchanged v2 slots.

src/v2/model.js builds the v2 slabs, room shells, structural circulation and placeholders. Original room authoring edits run before frame resolution and shell replacement. Wall-mounted art, lighting, signs and projections stay with their source room. The new Hydro-Nip floors/galleries receive the original glossy neon material, and regenerated lounge guards retain orange neon caps and foot strips. The gallery stair schedule stores the finished tread elevation in center.y; the builder converts that into the box centre. Cabin templates are grouped by type and door side, with one matrix per registry frame. Collision instances and 10,000 berth rest spots use those same matrices.

src/plan/structure-v2.js adds the physical openings needed above the lounge ramp and wing return flights before navigation and programme coverage. Wing flights stay within their lower reservations, with a 1.5 m half landing, 1.2 m clear flights, and a return opening in the deck above. Their lateral arrangement avoids the preceding flight under a tapering hull. N1's replacement stair/links move 2.2 m into the free end bay to keep the accepted arcade/treadmill anchored. The cold room retains an additional opening on its original fitting aisle. Corridor finishes subtract structural holes.

## Shared verification

scripts/v2-world.mjs uses prepareWalkWorld for the browser-equivalent feature edits, colliders and rest spots. The plan and map come from those built meshes. Source room partitions are replaced by the selected shell geometry; walk-plan.json also inventories the shells. Generated guards are glass and exclude stair arrivals/cabin interiors. The walk-only wing clipping removes intrusions inside the pressure lining; the four copied exterior GLBs are unchanged.

The full v2 flood keeps the 2 m by 0.7 m capsule, tests every cabin, room and lift landing, requires all 10,000 berths, and rejects exterior falls. It also checks individual stair steps and the original seat availability threshold. Reports are in the v02 output folder. No acceptance threshold is reduced. The final flood reaches 6,124,097 positions, 285 rooms, 5,028 cabins, 100 lift stops, every berth and all 12,010 available rest spots, with no exterior falls.

## Rendering and review

Full interiors keep narrow deck-band culling. A merged facade keeps all cabin fronts, balconies, wing/terrace slabs, bridges, upper fronts and the atrium roof visible. Haze uses the same actual slab holes. Frozen authoring meshes remain inspectable through ship.root, detached from the render scene after baking; remaining live meshes retain their world transforms in small draw groups. This avoids traversing roughly 260,000 hidden source objects every frame.

Public walk bundles strip debug hooks. A separate local verifier page is written under output/leo-interior-v02/review and served at /review/walk.html by serve-v2.mjs. measure-v2.mjs measures four specified cameras in headless Chrome using the PC GPU, after compileAsync and a warm-up; its report distinguishes frame intervals, CPU submission and GPU timers when available. No software GPU result is labelled hardware performance.

Cabin final furnishing, curated large nose-room contents, fitted new rooms, shuttle models, exterior aperture cutting and atrium dressing remain later phases. The source ownership inventory and final report identify replacements and deferred items. This is an unpublished review build for Claude and Jay.

The location HUD resolves roomAt once per update; the inherited find callback had scanned all registry entries for each candidate area. This was the dominant remaining periodic CPU stall after scene isolation. The final camera report and PNGs use 1280 by 720 pixels at ratio 1. WebGL disjoint timer queries are unavailable in this Chrome configuration, so frame intervals and CPU submission are reported; no GPU-only milliseconds are inferred.

Local review prerequisites are the existing accepted v1 exterior exports and built Cosmo/brand cache in dist. V2 reads these and writes only its own output folders. This worktree has them; a clean-cache bootstrap is not supplied by this phase.

Evidence: output/leo-interior-v02/check-report.json, walk-report.json, stair-report.json, browser-report.json, overview-report.json, ownership-report.json and render-report.json. output/phase2 contains command logs, camera PNGs, the CPU profile, GPU identification and the v1 artifact hashes. The ownership audit covers all 244 named inventory rows, including source-only helpers and optional cinematic viewer items. It identifies tour-only omissions, seasonal retirement, deferred nose fit-outs and structural replacements individually; it does not equate a source-name match with visual approval.

The local GPU harness expects a dedicated Chrome debugging session on port 9333 (headless=new, no-sandbox, disable-gpu-sandbox, use-angle=d3d11, a workspace-owned user-data-dir). With serve-v2 running, use node scripts/v2-browser.mjs --reload, then node scripts/v2-smoke.mjs, node scripts/v2-ownership.mjs and node scripts/measure-v2.mjs sequentially. Keep other build/check processes idle during measurement. No external service is contacted.
