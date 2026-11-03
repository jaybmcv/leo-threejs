# Fast Leo deploys

The deployment checkout runs `node scripts/build-fast-v2.mjs`, then the public build and the fast release checks. The automation entry is `node automation/deploy-leo.mjs start` in feedback-inbox. `start --full` retains the full build, walk check and every existing `check-all` gate. The 04:04 routine should call `automation/deploy-leo-nightly.mjs`.

The external 04:04 routine has not been reconfigured here. The full lane currently fails its historical source-fold pin after these source changes; resolve the pin policy before relying on nightly success. A missing or incompatible warm baseline triggers full geometry authoring, so the recorded fast timings require an existing verified baseline.

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

The classifier also diffs the output of the existing Phase 4/6 and pure launch-D fitout programme sources. It discovers the affected rooms and decks from the changed descriptors. Mixed instance batches lose only the affected owners, and unchanged prepared chunks, vertex pools and collision groups are reused. Patches are rebuilt from the last clean base, so edits do not accumulate obsolete geometry. Subsequent UI edits reuse the integrity-verified active patch. Its changed-room browser targets remain on retries, so a failed room smoke test cannot be skipped by an A retry. The full nightly rebuild compacts everything again.

Current boundaries: synthetic/circulation owners, changed baked text signs, escape-craft assemblies, hull/layout changes, or custom legacy room generator modules use the wider geometry build. The fast lane does not run the full test suite for those changes. Existing structural shell walls are not edited by the fitout override; use an interior panel or the normal layout producer as appropriate.

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
