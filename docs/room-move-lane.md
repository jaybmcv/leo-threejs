# Moving or resizing one room without the whole build

Step 3 of the per-section rebuild. Audited and planned 2026-11-05/06. **The room-move lane isn't built.** The audit shows that the narrow version (re-solve one room, keep its neighbours in place) is unsafe without more ownership work, and it would have caught neither of the two real edits it is meant for. This change makes the layout stage read only its inputs, and records what the next slice has to be.

## What a one-room change drives today

### 1. The layout solve (`src/plan/layout-v2.js`)

- Rooms are packed in order. `place()` tests each room against `blocked(deck)`: the deck's openings, the rooms already placed that overlap the deck vertically (so rooms on neighbouring decks count too), shuttles, bridges and towers. So a room that grows or moves can move every room placed after it.
- `addDoor()` only sets the door. The navigation and programme passes then derive the door's approach corridor, door node, landing edge and the deck's reservation and landing strips from it.
- Navigation grid ids are stable: deck plus grid-cell index.

**Measured:** moving the theatre door by 1 m (the kind of edit in #314) changes:
- the room's door;
- its own door-approach corridor;
- the neighbouring `d16-new-1` door-approach corridor;
- four deck-16 reservation and landing strips, the door node and one landing edge.

No grid node or grid-to-grid edge changes. (A first, index-by-index diff reported about 1,700 edge changes. They were only array-order churn.)

### 2. Hull, windows, cabins and ceilings

- `bindHullLayout` binds outer rooms' frontages to the hull. Cabin windows and the 2,420 hull interfaces come from the same pass.
- The exterior stage is keyed on the whole `exterior-layout.json`, so any layout byte change re-runs it and its window cuts.
- The ceilings stage is keyed on the whole serialized layout.

### 3. Room records have many readers

53 source modules in `src/plan`, `src/v2` and `src/walk` read `layout.rooms` (not counting their variant files). Corridor floors subtract room outlines, so a room edit can change a corridor floor even when every corridor record stays the same; decks 1–2 also merge them into one floor union. The rail planner reads the rasterized decks, the actual ground and the layout directly. Corridors feed:
- the corridor floors;
- the baked sign atlas;
- cabin footprints;
- the finish kit, the Phase 4 community fit-out and wayfinding;
- the launch B and D geometry, the legacy corridors and the hex floor.

Room features such as the theatre and concession place themselves from their room's frame.

### 4. Models stage (864 s warm in the last deploy build)

- This stage builds the whole ship in Node from `layout.json`.
- `walk-plan.json` comes out of it. That file holds the rails, the guard evidence, and every room's shell outline and door; the layout's navigation graph isn't in it. `walk-map.png` comes out of it too.
- Neither has a per-room producer.

### 5. Prepared authoring and lane B

- Lane B can author one older room's source and shell in Node against `layout.json`, and swap its owned spans.
- It refuses a changed room frame.
- It excludes 20 rooms with later world or activity passes (the theatre is one). A room that owns hull interfaces can't have its shell replaced; a source-only edit to it is still allowed.

### The two real edits

| Edit | What it touched | Narrow lane? |
|---|---|---|
| #314 theatre entrance | Door moved along the wall (`DOOR_ALONG`); two door-approach corridors (one a neighbour's), deck strips, the door node and a landing edge changed; theatre and concession features; fit-out override | No: the theatre is excluded from lane B, and a corridor neighbour changed |
| #327 Hydro-Nip lounge | Door, galleries, links, maze tubes and pieces of `commons-1`, a hull-bound garden room; `room-shell.js`; garden guards (rails); Go-to; arcade, vault and jaguar features | No: the hull, the rails and shared producers changed |

A lane that only takes a change confined to one room's own layout record catches **0 of 2**.

## Why the narrow lane isn't safe yet

Here is what the narrow lane would do:
1. Re-solve the layout and accept the edit only if the diff stays inside `rooms[X]`.
2. Splice that record into the baseline layout.
3. Rebuild room X through lane B.

What it would need to check is still missing. Equal layout records outside X don't prove that the built geometry outside X is unchanged. Dozens of readers take every room's polygon. Corridor floors subtract room outlines, the rail planner reads the rasterized decks and ground, and features in X and the map read the room too. Lane D's recorded rail-probe cells can't prove those inputs unchanged once a room moves. Today only the models stage can prove which outputs changed, and it is the whole-ship cost this lane is meant to avoid. A wrong guess here loses collision or leaves a stale wall in a corridor. That is the one failure Jay ruled out.

## The next slices, in order

1. **Semantic layout diff, diagnostic only.**
   - Compare layout records by id, not array index, so order churn disappears.
   - Report every changed record: rooms, door nodes, landing edges, regions, approach corridors, reservation and landing strips, hull, windows, cabins, shuttles and bay access.
   - At first it only records a precise widen reason in `plan.json`; it never routes a deploy.
2. **Room-owned floors and approaches.**
   - Corridor floors and the decks 1–2 union lose their dependence on room outlines, or the floor pieces a room outline touches become spans tagged with that room.
   - A room's own door approach becomes part of its section.
   - Signs on the approach stay wide until the sign atlas is split per owner (as in lane B).
3. **Per-room walk-plan and map updates, with rail invariance.**
   - The lane rewrites X's shell row and map pixels.
   - It must also prove the rail and guard planner's output unchanged where X's old and new outlines and ground touch, or recompute exactly those cells. If the planner can't be cut that way, the lane widens.
4. **Enable the classifier.**
   - The lane accepts a re-solve whose diff touches only `rooms[X]`, X's own approach, door node, landing edge and strips.
   - It widens on any change to a neighbour, including a neighbour's approach; the hull; windows; cabins; shuttles; bay access; rails or guards; or a feature placed from X's frame that isn't a qualified `feature()`.

**Proof for each slice:**
- The reference is a forced full build of the same edit with `LEO_PREPARED_FORCE=1` and `LEO_FULL_REBUILD=1`, plus `LEO_BUILD_COLD=1` when proving independence from the geometry caches.
- The lane's output must equal it by content, render and collision, both outside the changed section and inside it.
- Every existing release gate stays.

Hull-bound rooms (the #327 kind) need step 2 of the section rebuild (hull panels per room) first.

## Input-purity fix (this change)

The layout stage now depends only on its sources and the v1 hull:

- **Ceilings fit the layout stage's own output** (`exterior-layout.json`). They no longer read the `layout.json` that an earlier ceilings run had already fitted.
  - Measured against the live deploy's files: byte-identical output (`0947d828…`), and the ceilings cache still hits.
  - The old code was a fixpoint on today's files, so this removes a latent self-read; no live bytes change.
  - This proves the ceilings stage only. Cold hull binding against the new hull-source return is not measured; that needs a cold source run compared with a bound layout.
- **The hull-source cache returns the file it wrote.** A cold run used to return the in-memory scene, and a warm run parsed the saved GLB. The export keeps only visible objects, so the two could differ. Both now parse the same bytes, which standardizes on what every warm build already used.
- **The unused `--normalize` mode is removed.** It read `layout.json` and `walk-plan.json` back and rewrote both. Nothing in the repository called it. Passing the flag is now an error rather than a silent fresh solve.

**Cost:** these scripts are geometry producers, so the first build after this merge takes the wider route once, and it re-runs the layout, exterior and ceilings stages (the exterior imports the hull-source script; the cold ceilings fit measured 92 s). The nightly already does a full build.
