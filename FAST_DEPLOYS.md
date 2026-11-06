# Fast Leo deploys

The deployment checkout runs `node scripts/build-fast-v2.mjs`, then the public build and the fast release checks. The automation entry is `node automation/deploy-leo.mjs start` in feedback-inbox. `start --full` retains the full build, walk check and every existing `check-all` gate. The 04:04 routine should call `automation/deploy-leo-nightly.mjs`.

The external 04:04 routine has not been reconfigured here. The historical source pins are maintained explicitly for changed rows; a passing pin check is separate from a passing whole nightly run. A missing or incompatible warm baseline triggers full geometry authoring, so the recorded fast timings require an existing verified baseline.

No deploy command is needed when developing. `npm run build:public` accepts a UI-only edit without invalidating prepared geometry. Geometry provenance follows the actual model/authoring dependency graph. Package changes and shared geometry changes still require a wider rebuild.

## Room furniture and interior panels

Edit `src/plan/room-fitout-overrides-v2.json` to change individual rooms without rebuilding the ship. It is initially empty. The same descriptors feed the full build and the patch builder. For example:

```json
{
  "d01-new-2": {
    "replace": [
      {"match": {"part": "workbench"}, "set": {"size": [3.4, 0.9, 1]}}
    ],
    "add": [
      {"part": "interior_wall", "size": [2, 2.5, 0.12], "at": [0, 1.25, 4], "mat": "cream"}
    ]
  }
}
```

Added parts use the room's fitting frame in metres. `replace` matches the existing descriptor fields exactly; dimensions/material changes preserve its existing placement. `remove` takes a list of matching field objects. These change real render meshes and their collision. A wall or panel must remain clear of doors and walking routes; the author still tests the edit.

Explicit `at`/`yaw` values in `replace.set` use the existing descriptor's world coordinates. For a new placement in room-local coordinates, remove the matched part and add its replacement through `add`.

Moving, resizing, adding or removing seat cushions or mattresses also requires a complete `rests` array for that room. Anchors use the same local frame (`kind: "sit"` or `"lie"`, `point`, and direction vectors `facing`/`head`). A lying anchor requires a nonzero `head`; supplied directions must contain three finite numbers and have nonzero length. Directions rotate with the room but are never translated. Use `rests: []` when removing every seat. This prevents invisible old seat anchors from surviving a furniture edit; changing only a seat's material does not require new anchors.

The classifier also diffs the output of the existing Phase 4/6 and pure launch-D fitout programme sources. It discovers the affected rooms and decks from the changed descriptors. Mixed instance batches lose only the affected owners, and unchanged prepared chunks, vertex pools and collision groups are reused. Patches are assembled from the last clean base, using cached per-room geometry, collision and raw-model additions. Unchanged rooms are not authored or encoded again as the day's changed-room set grows. Subsequent UI edits reuse the integrity-verified active patch. Its changed-room browser targets remain on retries, so a failed room smoke test cannot be skipped by an A retry. The full nightly rebuild compacts everything again.

## Legacy room source and wall edits

The classifier evaluates the output of these existing source modules: `src/special-areas.js`, `areas.js`, `area-finish.js`, `command-deck.js`, `neighborhood-services.js`, `lower-aft.js`, `lower-bow.js`, `upper-aft.js` and `voyage-forum.js`. Edit their actual generators. A change restricted to a supported room replaces its custom meshes, baked render triangles, static collision, rest anchors and model nodes. Source and shell ownership are separate, so a custom-mesh edit preserves the room's existing hull and shell.

`src/v2/room-shell.js` is the shared room-wall producer used by normal authoring and fast patches. Targeted wall edits in rooms without shared hull interfaces use the same path. The current registry supports 47 legacy source rooms and 14 room shells. The full list and exclusions are in the `legacy` baseline of `scripts/fast-owner-migration.json`; a subsequent clean build captures its own current list.

**One clean authoring run is required before legacy removal/replacement works on the supplied prepared ship.** That old artifact has no static-collision owner spans. The fast writer refuses to guess which triangles belong to a room. Outside the sandbox, run:

```powershell
$env:LEO_LAYOUT='2'
$env:LEO_PREPARED_FORCE='1'
node scripts/build-all.mjs
Remove-Item Env:LEO_PREPARED_FORCE
```

The exact, output-neutral implementation migration keeps existing UI and Phase 4 patches usable before that refresh. It does not invent ownership for the old prepared artifact.

Current wider boundaries are room/frame/layout changes, hull-owned shell changes, legacy rooms with later activity/world modifications, escape-craft assemblies, baked sign-atlas changes, and shared producers outside the isolated kit. These take the wider geometry route. The ordinary wider route reuses unchanged layout, exterior, ceiling and raw-model outputs after checking their dependencies and file hashes. `LEO_FULL_REBUILD=1` explicitly bypasses those stage/model caches. Nightly still runs its prepared authoring and all existing checks.

Moving or resizing a room, or moving its door, always takes the wider route. [docs/room-move-lane.md](docs/room-move-lane.md) covers what such an edit reaches and the ownership work a per-room lane needs first.

## Shared kit edits

`src/v2/phase4-mesh-kit.js` owns the Phase 4 mesh shapes and materials. Its actual per-owner mesh output is compared with the clean baseline; only changed owners are patched. A material unused by a room does not invalidate that room. Supported atrium owners receive a nearby room/deck browser smoke target; this is a page-load check, not a clearance test. Escape-craft or sign-atlas changes still widen.

Cached room records include prepared arrays, render graphs, collision and a GLB addition, keyed by room output, clean baseline and patch-writer version. A changed room does not force previously edited rooms to be built again. Final assembly and public packaging still process the resulting whole artifact.

## Room feature edits

Each feature `prepare.js` and `prepare.authoring.js` create (the concession, the sword case, the jaguar gate, …) is wrapped in `feature()` (`src/v2/feature-owner.js`). That tags what it returns as its own and records, in the prepared manifest, whether the call left the rest of the ship untouched. An edit to one of these modules takes the dressing lane (`scripts/fast-dressing-v2.mjs`). The feature is rebuilt in Node against the baseline's own decoded ship, then its templates, collision spans and model nodes are swapped. Measured on a concession and sword-case edit: 36 s, against 30.5 min for the wider build, and the result equal by content to that full build.

A feature qualifies only if:
- its call takes nothing but the ship and the page's still and anisotropy;
- the authoring page only draws, guards and updates what it returns, under the names it binds from `prepared`.

Each prepare file's own import says which variant it runs. A module with a single file (pinball, the ward trolley, atmosphere, baggage) is all four: the public walk builds it from code, and only its collision and model are baked.

A strip or bed helper that prepare also imports from the module (`stripAtmosphere`, `prepareBlossomBed`, …) runs in the fit-out and is baked with its room. The lane takes the module only when that helper is unchanged. The check covers the helper's own code, the top-level code it reaches by name, the module's imports and anything at top level that declares nothing, compared with the hashes saved with the clean baseline. An edit inside the create function passes; an edit to the strip, or to a constant the strip uses, widens.

A module only the feature's own files import, such as `layered-conservatory.js` under the blossom garden, counts as part of that feature.

Out of the lane, for now:
- the theatre, kittens and mudwater (their calls take the Cosmo kit or art urls);
- the maze (its hold goes to the maze game);
- the arcade (its treadmill feeds Paws Off);
- the vault (its door adds collision);
- the chinampa (the authoring page imports its info panel).

The lane widens when:
- a rebuild touches anything already in the ship;
- old or new collision reaches a cell that the rail or void-guard planner asked about (`walk-plan.json` `railProbes`, recorded by `src/v2/rail-probes.js`);
- templates appear on one side only.

Removing an old in-place change from a feature isn't detected: it stays live until the nightly. Proofs: `node scripts/check-fast-dressing-v2.mjs --patch` and `--full=DIR`.

## Room dressing edits

The gaming lounge and the surgical suite each have two parts:
- a dress pass (`dressGamingLounge`, `dressSurgery`) that the fit-out runs before collision and the bake, so its furniture and walls are baked with the room;
- a create (`createGamingLounge`, `createSurgeryArms`) that only the authoring page calls. Its group is drawn and updated, never solid and in no model, so its one prepared output is its geometry templates. The public walk replays them.

An edit to the create takes the dressing lane as `room:gaming-lounge` or `room:surgery`. The create is rebuilt in Node against the baseline's decoded ship and its templates are swapped. The public browser check visits the room. An edit to `capsule-bubbles.js` widens: its module code runs before the world is built.

The lane takes the module only when:
- the dress pass in every variant matches the hash saved with the clean baseline (the same check as a feature's strip). Any top-level constant counts as the dress pass's, so an edit to one widens;
- the page's call, wrapped in `feature()`, left the ship untouched in the baseline ledger. The Node rebuild must leave the decoded ship, its module's top-level values, three's exports and the globals untouched. The dress pass's materials are module values shared with what it baked;
- the code only the create reaches names the ship, the room, the page's lights, the layout or a global only in the lines it was qualified with (`reads` in `fast-dressing-v2.mjs`). The decoded ship lacks the room's baked meshes, so this is what keeps a create from changing one unseen;
- the create neither records a dress-pass label nor calls a function that does. Templates are told apart by recording site: the dress pass's labels stay the baseline's, and every other label of the module belongs to the create.

Any other use of the group on the authoring page widens. The imaging room is out for now: its create takes the Cosmo kit, which isn't rebuilt in Node. The Hydro-Nip aquarium (`lounge-aquarium.js`) is out too: `lounge.js`, `partitions.js` and the live server identity read it.


## Prepared walk in sections (`LEO_PREPARED_SECTIONS=1`)

With `LEO_PREPARED_SECTIONS=1`, `npm run build:public` publishes the prepared walk in sections instead of one whole-ship transport (`scripts/prepared-sections-v2.mjs`; the format and reader are in `src/v2/prepared-sections.js`). It is off by default.

The verified artifact in `output/leo-interior-v02/prepared-walk` stays the whole-ship format. Builds, fast patches, the phone pack and every check read it as before. Packaging splits it into these sections:
- `render:<deck>`: the render bands whose lowest deck it is.
- `collision:<deck>`: the static and ground collision bands for that deck.
- `tpl:<module>`: one feature's or dressing's geometry templates.
- `core`: the source graph, finishes, rests, privacy, collision groups and movers.
- `images`: the core's images.
- `shared:<type>:<sha256>`: one file per array that more than one section uses (the vertex pools and position dictionaries) or that is a tuple dictionary.

A section carries the artifact's own encoded array bytes, unchanged. Vertex pools, index values and BVHs are the artifact's, so the atrium geometry pack's guards and LOD indices still bind.

Files are named by content: `prepared-walk/sections/s-<sha>.bin`, with `sections.json` in `prepared-walk/<artifact>/`. They are cached in `output/leo-interior-v02/prepared-sections-cache` by their uncompressed bytes. An unchanged section keeps its name and bytes across releases, so it isn't uploaded again and browsers can reuse it. A fast patch still writes the whole-format artifact; packaging then compresses only the sections whose bytes changed. A lane D patch rewrites its `tpl:` section and the collision decks it touched, never render or core.

Before compressing a new section, packaging checks it against the artifact. It is mapped back to the artifact's ids, and every geometry, graph, collision record and placement must match JSON for JSON, with every array record the same except its address and every array decoding to its checksum.

`check-fast-release-v2` and `startup-public-identity-v2` verify a sectioned publish file by file against what the local artifact sections into. The release check also runs the changed-room collision probes through the published sections. `node scripts/check-prepared-sections-v2.mjs` is the by-content proof. It compares `canonicalPrepared` of both (about 25 minutes), then decodes both with the public reader and compares every band, template, graph, shared buffer and collision record, plus the collider digest.

Still on the whole-ship transport, until they read sections:
- the phone pack (`prepared-walk-phone`; phones could later load the sections near the player);
- the retired switchover check (`check-switchover-artifacts --include-public`).

The phone pack and the atrium pack are keyed on the whole artifact, so every patch still rebuilds them.

## Local measurement, without publishing

From feedback-inbox:

```powershell
node automation/deploy-leo.mjs work --dry-run --dir=C:\Users\henri\code\leo-redesign-plan --tag=local
```

This reads the working tree without fetching or checking out code, runs local stages, and stops before Vercel, GitHub comments, deployment state, or live changes. Timings and evidence go to `output/fast-deploy/`. `--full` measures the complete lane. `--skip-browser` and `--health-file=<fixture>` are diagnostic dry-run options only; they cannot pass a real release.

The fast gates are prepared/public integrity, existing asset references, 250,000,000 bytes across the public output, 750,000 actual phone-hull triangles, changed-room encoded collision probes, the live server's layout identity, and a local public-browser visit at arrival and every changed room. Collision probes decode the saved BVHs and exercise transforms and spatial lookup; full clearance remains nightly. Browser tests override live multiplayer with localhost; they do not join the real ship.

The dependency trace includes baked image bytes and verifies the four immutable v1 hull inputs against their existing SHA pins. Missing v1 assets select the wider restoration build. An existing asset with the wrong pinned bytes stops before release.

The server protocol identity follows the data and rules consumed by multiplayer. Cosmetic furniture/room labels retain the current live token. Shared-rule text hashes normalize CRLF/LF for consistent checkouts on both PCs. Changed activity coordinates or gameplay rules produce a different token and an explicit server-update-required message. Server updates remain manual; this pipeline does not administer the other PC.

Implementation evidence and limitations: [output/fast-deploy/REPORT.md](output/fast-deploy/REPORT.md).

## Wider-stage diagnostics

These local commands stop before browser authoring and publishing:

```powershell
$env:LEO_LAYOUT='2'
node scripts/build-v2.mjs --stages-only
node scripts/build-v2.mjs --skip-prepared
```

The first measures layout/exterior/ceiling preparation; the second also builds the raw models. Neither produces a complete new prepared ship. `LEO_FAST_NO_AUTHORING=1` makes a diagnostic fast build stop if classification needs wider authoring, instead of launching it.

Round 2 measurements and remaining verification: [output/fast-deploy/REPORT-2.md](output/fast-deploy/REPORT-2.md). The source-edit measurement harness is `node scripts/measure-fast-local-v2.mjs`; it runs serial dry runs with `--skip-browser`, uses a labelled local health fixture, and restores its temporary edits.
