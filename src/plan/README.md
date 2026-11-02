# Phase 0 room anchors

The v1 data in v1.js is the immutable reference for accepted geometry and saved links. rooms.js supplies current frames and point/facing conversions. Existing builders keep their accepted authoring geometry: anchorObject composes currentFrame * inverse(v1Frame) at the room boundary. The identity path deliberately leaves every Three.js transform untouched. New fittings should use roomObject(ship,id).matrixWorld or toWorld(id,localPoint).

Arrival hall and Hydroponic garden A belong to arrival-assembly. Overriding either child redirects to that assembly. commons-1 through commons-10 include their galleries and stairs; negative-z commons retain the template mirror. CABINS ids own individual cabin instances. Fixed core volumes take precedence over nearby room approaches in saved-link ownership; the broad lifeboat descriptors have lowest priority.

The walk builds/cuts the accepted v1 authoring geometry with frame resolution deferred, then prepareWalkWorld resolves the registered roots before collecting collisions, rest points and detached fittings. Rest points are sampled in their original authoring frame and carried into the current frame, preserving curved-seat sampling and facing. Node uses the same room edits and proxy colliders. Map artwork is captured at its original pre-replacement stage so Phase 0 preserves the accepted map; reachability uses the fully prepared world. Its kitten figures are placeholders; their explicit collider boxes are identical. The reachability checker holds the automatically opening lounge doors open via their normal update function.

Renderer work, lift UI/sign canvases, Cosmo loading/dressing, theatre video, interactive game/board/comic DOM, sound and runtime mood/render effects remain in main.js and their existing modules. They consume the same anchored rooms. No network is needed for these checks.

With __WALK_DEBUG__ true, use ?anchorTest=d16-theater-5:7,-3,37 or ?anchorTest=commons-1:0,0,0,m. Translation, yaw in degrees, and local-z reflection can be tested independently. The override runs before world construction. __walk.registry() returns current frames, __walk.restSpots is the original findRestSpots output in world coordinates, and __walk.interactionTargets returns world points, owners and facing where applicable for lifts, rest spots, arcade/Paws Off, telescope, theatre, pool, Mudwater, boards, comics, paintings, hologram and Go to places. Existing debug fields remain available.

check-anchors checks documented room boundaries, inventories authoring sites and compares normalized source fingerprints. It is a conservative ownership gate, not a JavaScript AST proof. Assign a new feature to a registry id before regenerating ownership.json with node scripts/check-anchors.mjs --write. Fixed spaces and non-ship/helper coordinate systems are documented individually in anchor-allow-list.json. The old holo placement fixture must fail the boundary check.

Additional checks: check-anchor-movement.mjs tests the six specified assemblies, unaffected library geometry, individual cabin instances, rest facing and automatic door collider orientation. check-anchor-preparation.mjs checks shared feature availability and rest-filter parity. check-anchor-bundle.mjs bundles both variants and checks public debug stripping; its workspace-only resolver avoids native esbuild's ancestor-directory access failure in this managed sandbox.

Full frozen-time browser hashes, generated-plan comparison and the 63 reference captures remain the verifier's acceptance gate. No publication or deployment is implied.

## Phase 8 source ownership

The active source tree is layout 2. `legacy/v1` pins the rollback implementation. Mode variants inherit the original module room boundary; `src/v2/source-modes.json` records their exact membership. Edit the needed mode explicitly and keep shared behavior in ordinary imports. `check-anchors` runs the frozen v1 boundary and frame round trips, then verifies the active v2 ownership fingerprints and delegated boundaries. Regenerate `ownership.json` only after reviewing those boundaries.

Phase 8 scope: ownership.json and check-anchors retain the root feature-builder and src/walk boundary audit, now including their explicit mode variants. Procedural src/v2 shells/fitout keep their existing per-object ownership through src/v2/ownership.js and the v2 geometry/clearance gates. The source-modes entry records the corresponding original module for every mode variant. The fold does not replace those two ownership mechanisms with a new one.
