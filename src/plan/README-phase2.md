# Phase 2 selected walk world

The default is still layout 1. In PowerShell:

    $env:LEO_LAYOUT='2'
    npm run build
    npm run build:public
    npm run check:walk
    npm run check
    node scripts/serve-v2.mjs

Review http://127.0.0.1:4182/ and walk.html locally. Remove the LEO_LAYOUT environment variable to return to v1. Selection is a build input; URL parameters cannot select the other world. Models are in output/leo-interior-v02 and public assets in dist-v2. Nothing is deployed.

## Isolation and frames

The v1 model and walk source are untouched. scripts/v2-plugin.mjs supplies the selected layout as a virtual import and applies explicit opt-in adapters while bundling the v2 Node/browser world. Its registry adapter installs production frames in a separate selectedFrames map before any feature module evaluates. Temporary debug adjustments compose over that plan; clearing them cannot restore v1. The immutable v1 frames still decode legacy links and facing. The observation lounge explicitly supplies a fittingFrame at its accepted entry X170 while its plan centre remains X190, preventing the contents and overhead promenade sign from shifting into the ramp. Resized legacy links are clamped into their target room; lv=2 positions are already current. Retained aft rooms receive explicit unchanged v2 slots.

src/v2/model.js builds the v2 slabs, room shells, structural circulation and placeholders. Original room authoring edits run before frame resolution and shell replacement. Wall-mounted art, lighting, signs and projections stay with their source room. The new Hydro-Nip floors/galleries receive the original glossy neon material, and regenerated lounge guards retain orange neon caps and foot strips. The gallery stair schedule stores the finished tread elevation in center.y; the builder converts that into the box centre. Cabin templates are grouped by type and door side, with one matrix per registry frame. Collision instances and 10,000 berth rest spots use those same matrices.

src/plan/structure-v2.js adds the physical openings needed above the lounge ramp and wing return flights before navigation and programme coverage. Wing flights stay within their lower reservations, with a 1.5 m half landing, 1.2 m clear flights, and a return opening in the deck above. Their lateral arrangement avoids the preceding flight under a tapering hull. N1's replacement stair/links move 2.2 m into the free end bay to keep the accepted arcade/treadmill anchored. The cold room retains an additional opening on its original fitting aisle. Corridor finishes subtract structural holes.

## Shared verification

scripts/v2-world.mjs uses prepareWalkWorld for the browser-equivalent feature edits, colliders and rest spots. The plan and map come from those built meshes. Source room partitions are replaced by the selected shell geometry; walk-plan.json also inventories the shells. Generated guards are glass and exclude stair arrivals/cabin interiors. The walk-only wing clipping removes intrusions inside the pressure lining; the four copied exterior GLBs are unchanged.

The full v2 flood keeps the 2 m by 0.7 m capsule, tests every cabin, room and lift landing, requires all 10,000 berths, and rejects exterior falls. It also checks individual stair steps and the original seat availability threshold. Reports are in the v02 output folder. No acceptance threshold is reduced. The historical Phase 2 flood reached 6,124,097 positions. Phase 3 requires all 5,028 cabins, 285 rooms, 100 lift stops, 10,000 berths and 5,084 cabin chairs without falling, and every available rest spot. See the current walk-report.json for counts and all height/origin fall diagnostics.

## Rendering and review

Full interiors keep narrow deck-band culling. A merged facade keeps all cabin fronts, balconies, wing/terrace slabs, bridges, upper fronts and the atrium roof visible. Haze uses the same actual slab holes. Frozen authoring meshes remain inspectable through ship.root, detached from the render scene after baking; remaining live meshes retain their world transforms in small draw groups. This avoids traversing roughly 260,000 hidden source objects every frame.

Public walk bundles strip debug hooks. A separate local verifier page is written under output/leo-interior-v02/review and served at /review/walk.html by serve-v2.mjs. measure-v2.mjs measures four specified cameras in headless Chrome using the PC GPU, after compileAsync and a warm-up; its report distinguishes frame intervals, CPU submission and GPU timers when available. No software GPU result is labelled hardware performance.

Phase 3 below supplies cabin furnishing. Curated large nose-room contents, fitted new rooms, shuttle models, exterior aperture cutting and atrium dressing remain later phases. The source ownership inventory and final report identify replacements and deferred items. This is an unpublished review build for Claude and Jay.

The location HUD resolves roomAt once per update; the inherited find callback had scanned all registry entries for each candidate area. This was the dominant remaining periodic CPU stall after scene isolation. The final camera report and PNGs use 1280 by 720 pixels at ratio 1. WebGL disjoint timer queries are unavailable in this Chrome configuration, so frame intervals and CPU submission are reported; no GPU-only milliseconds are inferred.

Local review prerequisites are the existing accepted v1 exterior exports and built Cosmo/brand cache in dist. V2 reads these and writes only its own output folders. This worktree has them; a clean-cache bootstrap is not supplied by this phase.

Evidence: output/leo-interior-v02/check-report.json, walk-report.json, stair-report.json, browser-report.json, overview-report.json, ownership-report.json and render-report.json. output/phase2 contains command logs, camera PNGs, the CPU profile, GPU identification and the v1 artifact hashes. The ownership audit covers all 244 named inventory rows, including source-only helpers and optional cinematic viewer items. It identifies tour-only omissions, seasonal retirement, deferred nose fit-outs and structural replacements individually; it does not equate a source-name match with visual approval.

The local GPU harness expects a dedicated Chrome debugging session on port 9333 (headless=new, no-sandbox, disable-gpu-sandbox, use-angle=d3d11, a workspace-owned user-data-dir). With serve-v2 running, use node scripts/v2-browser.mjs --reload, then node scripts/v2-smoke.mjs, node scripts/v2-ownership.mjs and node scripts/measure-v2.mjs sequentially. Keep other build/check processes idle during measurement. No external service is contacted.

## Adapter cutover checklist

Every operation checks its source anchor; preflight accumulates every mismatch. Removed-target regressions cover all 59 adapters. Fold each line into selected source at cutover:

- `src/hydro-nip-lounge.js` — prepend anchor: `import * as T from 'three';`.
- `src/hydro-nip-lounge.js` — replace: `MAZE={x0:114,x1:120.5,z0:19,z1:33,top:35.2}`.
- `src/hydro-nip-lounge.js` — replace: `CELLS={x0:114.1,z0:19.1`.
- `src/hydro-nip-lounge.js` — replace: `TUBES=[{x:119.4,level:LEVELS[0],from:MAZE.z0,to:12},{x:118,level:LEVELS[1],from:MAZE.z1,to:42}]`.
- `src/hydro-nip-lounge.js` — replace: `[[118.1,23.6,3.4,4.4,LEVELS[0]],[117.4,29.9,4.6,4.4,LEVELS[1]]])`.
- `src/hydro-nip-lounge.js` — replace: `[[117,23.2,LEVELS[0]],[117,25.4,LEVELS[0]],[116.2,31.2,LEVELS[1]],[119.4,31.6,LEVELS[1]]].forEach`.
- `src/hydro-nip-lounge.js` — replace: `at:[116.6,FLOOR+3.15,z0-.1]`.
- `src/walk/collision.js` — replace: `function bvhOf(positions){`.
- `src/walk/railings.js` — replace: `return rows.filter(r=>r[3]-r[2]>=.5);`.
- `src/plan/rooms.js` — prepend anchor: `import * as T from 'three';`.
- `src/plan/rooms.js` — replace: `LAYOUT_VERSION=1`.
- `src/plan/rooms.js` — replace: `export function instanceRoom(o,i){`.
- `src/plan/rooms.js` — replace: `export function baselineMatrix(o,i=null){`.
- `src/plan/rooms.js` — replace: `const entries=new Map(),overrides=new Map()`.
- `src/plan/rooms.js` — replace: `o=overrides.get(owner);`.
- `src/plan/rooms.js` — replace: `const a=v1Frame(id);if(a.fixed)`.
- `src/plan/rooms.js` — replace: `()=>overrides.size>0`.
- `src/plan/rooms.js` — replace: `id=>overrides.has(motionOwner(id))`.
- `src/plan/rooms.js` — replace: `export const registry=`.
- `src/plan/rooms.js` — replace: `[w,h,d]=a.size,lo=a.bounds?.[0]`.
- `src/plan/rooms.js` — replace: `hi=a.bounds?.[1]`.
- `src/model.js` — prepend anchor: `import * as T from 'three';`.
- `src/model.js` — replace: `  return ship;`.
- `src/walk/main.js` — prepend anchor: `import '../plan/debug.js';`.
- `src/walk/main.js` — replace: `shapeInterior(ship.exterior,ship.inside);`.
- `src/walk/main.js` — replace: `corridorTrim(lifts.signs,{inside:ship.inside,partitions:walkPlan.walls});`.
- `src/walk/main.js` — replace: `stairSigns(lifts.signs,colliders);corridorSigns(lifts.signs);floorGuides(lifts.signs);`.
- `src/walk/main.js` — replace: `halloween=createHalloween(ship,`.
- `src/walk/main.js` — replace: `haze.add(createHaze(ship));`.
- `src/walk/main.js` — replace: `q.name==='Remaining_499_furnished_cabins'`.
- `src/walk/main.js` — replace: `q.name==='Repeated_cabin_walls'`.
- `src/walk/main.js` — replace: `||o.count!==499`.
- `src/walk/main.js` — replace: `}\nlet imagingScans=null;\nlet baked=null`.
- `src/walk/main.js` — replace: `o.count=order.length;o.instanceMatrix.needsUpdate=true;`.
- `src/walk/main.js` — replace: `const [low,high]=span(p,now);`.
- `src/walk/main.js` — replace: `  if(t.kind==='call')`.
- `src/walk/main.js` — replace: ` const b=booth.near(p)||comics.near(p)||chinampa?.near(p);`.
- `src/walk/main.js` — replace: `globalThis.__walk={registry,restSpots,`.
- `src/walk/link.js` — prepend anchor: `// A link to a spot on the walk: walk.html?at=x,y,z&yaw=90&pitch=-10&view=first (ship metres, degrees). The page drops`.
- `src/walk/link.js` — replace: `const room=spot.room||roomAt(spot.at,{legacy:true});`.
- `src/walk/link.js` — replace: `LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw`.
- `src/walk/link.js` — replace: `at:room?anchoredPoint(room,spot.at):spot.at`.
- `src/walk/link.js` — append anchor: `// A link to a spot on the walk: walk.html?at=x,y,z&yaw=90&pitch=-10&view=first (ship metres, degrees). The page drops`.
- `src/walk/places.js` — prepend anchor: `import * as T from 'three';`.
- `src/walk/places.js` — replace: `const y=hit.point.y;seg.start.set`.
- `src/walk/places.js` — replace: `const room=anyFrameOverrides()?SHIP_AREAS.find(a=>a.id===roomAt(p.toArray()))`.
- `src/walk/places.js` — prepend anchor: `import * as T from 'three';`.
- `src/walk/places.js` — replace: `export const PLACES=`.
- `src/walk/places.js` — append anchor: `import * as T from 'three';`.
- `src/walk/hex-floor.js` — prepend anchor: `import * as T from 'three';`.
- `src/walk/hex-floor.js` — splice start: `function hallways(){`.
- `src/walk/hex-floor.js` — splice end: `export function createHexFloor`.
- `src/walk/lounge-floor.js` — prepend anchor: `import * as T from 'three';`.
- `src/walk/lounge-floor.js` — splice start: `// The promenade in front of the lounge, laid just over its own floor.`.
- `src/walk/lounge-floor.js` — splice end: ` return {material,floors:found.length};`.
- `src/walk/lounge-floor.js` — replace: `const FLOORS=/^(`.
- `src/walk/lounge-floor.js` — replaceAll: `objectRoom(o)==='commons-1'`.
- `src/walk/commons-hall.js` — replace: `export function openCommonsHall(ship){`.
- `src/walk/windows.js` — replace: `/export function openWindows\(([^)]*)\)\{/`.

## Phase 3 cabin slice

Cabins now use the v1 oak, navy felt, warm linen, brass, softened fixtures, seams and bezel style. Furniture is merged per template/material before instancing; collisions and rest spots use the unmerged authoring template through the same registry transforms. Twin/single, door side and space/atrium view select the template. The clear finished faces are 3.18 by 7.4 m. The 1.2 m split-glass entry opens automatically on approach; a 12 cm manifestation strip is centred at 1.25 m. Party walls are shared across the 3.3 m pitch. Space windows retain their 2.2 by 1.3 m aperture markers; hull cutting remains Phase 5. Atrium cabins have full-height glass and a glass Juliet guard.

From inside the entry zone, use the normal E prompt to frost or clear that cabin. The overlay exists only in this viewer and does not enter multiplayer state. Reading/rest interactions retain priority elsewhere in the room. Door oak trim and light coves are part of the same yawed instance template. The distant atrium facade is unchanged.

The layout carries cabinIdMap and each cabin carries legacyIds. Nearest unused equivalents are preferred within the same deck and side; 80 legacy IDs share a target because four upper neighborhoods now contain fewer cabins. This is a link/feature remap, not an occupancy allocation. No individually cabin-owned feature appears in the current ownership inventory. Generic cabin fittings are rebuilt in the retained house style.

Export-only exact geometry/material sharing and GPU instancing of repeated v2 boxes reduce the full-ship payload. Native walk culling still uses deck bands and nearest cabin instances. The public overview can load the furnished Deck 15 GLB, including its GPU instances. `v2-cabin-check.mjs` checks actual cushion support, full capsule aisles and wet-pod approaches, clear sight lanes and mapping completeness. Phase 3 evidence and the final report are under output/phase3.

The current guard planner retains quarter-metre corner segments and requires a barrier at guard height before suppressing a pane. Wing-core reservations do not cut their own deck; only incoming return flights do. Fixed stair edges, the fin shaft and fin terrace ends are glazed too. V2 collision BVHs discard zero-area triangles, which otherwise act as invisible point obstacles. The full 2 m by 0.7 m flood keeps all thresholds and requires every cabin, berth and chair. The exact committed Phase 2 landing breakdown is pinned in phase2-walk-baseline.json; the new no-fall-first audit also inventories all step-off transitions.


## Round 2 safety and report contracts

The walk report is versioned and binds SHA-256 hashes of layout.json, walk-plan.json, all 11 GLBs, procedural plan/walk/v2 sources and the checker policy. Check rejects missing, old-format and other-build reports with an explicit instruction to run `LEO_LAYOUT=2 npm run check:walk`. Run build, build:public, check:walk, then check. `scripts/check-v2-round2.mjs` injects cabin/corridor/stair overlaps, stale reports and forbidden room falls and proves they are rejected. Cabin clear footprints must not overlap any cabin, corridor or stair; every door must meet its planned corridor threshold. All 5,000 v1 cabin links use cabinIdMap and land on the target cabin centre aisle, including the 80 shared targets.

Room-feature falls over 1 m fail unless they match a named, measured support and land on that same room floor. No gallery, slab, guard, terrace or stair exception exists. Allow-list (unchanged v1 furniture only):

- `observation-lounge / Soft_back`: at most 1.15 m drop and 1.2 m above that room floor; rounded chair backs in `src/lounge.js`, climbed via their cushions.
- `commons-10 / Garden_bench_back`: at most 1.10 m drop and 1.1 m above that room floor; unchanged cherry-blossom bench back in `src/walk/blossom.js`.
- `d16-childcare-6 / Kitten_step_tower_pad`: at most 1.10 m drop and 1.15 m above that room floor; the Young explorers kitten step towers in `src/walk/kittens.js` (main 06605a9), climbable on purpose in 0.35 m steps to a 1.05 m top pad.

The broad garden holes retain glass guards around the actual union of gallery, link and landing floors, with side glass at each stair tread height. Old automatic guard rows inside gardens are replaced, preventing stair access to incorrectly crossing cap tops. Static view bands follow the camera rays again; cabin interiors keep their own narrow deck band and nearest-cabin ranking. The distant haze pass includes the atrium roof, so the main camera far plane does not expose stars. Wing labels are Port/Starboard Aster, Birch, Cedar, Dogwood and Elm, in aft-to-forward order.

Round 2 also recesses the enclosed wet pod 0.4 m behind the glass entry, with an opaque bedroom-side automatic hinged door. The checker walks each of the 5,028 entry paths on the actual 0.35 m flood grid, with the unchanged capsule. Retained Haze Maze platforms/tube floors join the gallery guard union so community seating approaches stay clear. Safe go-to placement rejects exterior hull and guard caps, choosing actual interior floors instead. Native walk yaw 0 faces +Z; N05-124 is entered looking -Z at yaw 180 degrees.

The retained Haze Maze now uses its scheduled rigid fitting position (0.25 m aft and 7 m inboard from its old v1 placement); the complete cell grid, shelf stairs, platforms, rugs, cushions, glass, mist, doors and sign move together. Its two tube floors end on the scheduled front/rear galleries. Source dimensions and community credit remain intact; the new checked source adapters derive the position/endpoints from the selected layout. This removes the old upper platform from the sloping pressure glazing and restores both upper cushion approaches.

The v1 neon promenade finish is also re-anchored to the selected garden front and clipped against the actual slab holes. It is a visual finish, never a replacement floor/collider across the atrium. Three checker rays prove it remains on the promenade, stops at the room and leaves the atrium opening empty. The reported soft white stripe itself is a specular reflection in the unchanged acrylic material; the frozen baseline and final floor rays both show no corridor overlay at that location.
