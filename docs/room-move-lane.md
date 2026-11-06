# Moving or resizing one room without the whole build

Step 3 of the per-section rebuild. Audited and planned 2026-11-05/06. **The room-move lane isn't built.** The audit shows that the narrow version (re-solve one room, keep its neighbours in place) is unsafe without more ownership work, and it would have caught neither of the two real edits it is meant for. This change makes the layout stage read only its inputs, and records what the next slice has to be.

## What a one-room change drives today

### 1. The layout solve (`src/plan/layout-v2.js`)

- Rooms are packed in order. `place()` tests each room against `blocked(deck)`: the deck's openings, the rooms already placed, shuttles, bridges and towers. So a room that grows or moves can move every room placed after it on that deck.
- `addDoor()` derives each door's approach corridor, the deck's reservation strips and a circulation node from the door.
- The navigation grid numbers its nodes with a running counter.

**Measured:** moving the theatre door by 1 m (the kind of edit in #314) changes 1,739 values in `LAYOUT_V2`:
- the room's door;
- its own door-approach corridor;
- the neighbouring `d16-new-1` door-approach corridor;
- four deck-16 reservation strips and the door node;
- about 1,700 navigation-grid edges, renumbered by the counter shift. Their positions don't move.

### 2. Hull, windows, cabins and ceilings

- `bindHullLayout` binds outer rooms' frontages to the hull. Cabin windows and the 2,420 hull interfaces come from the same pass.
- The exterior stage is keyed on the whole `exterior-layout.json`, so any layout byte change re-runs it and its window cuts.
- The ceilings stage is keyed on the whole serialized layout.

### 3. Room records have many readers

53 source modules in `src/plan`, `src/v2` and `src/walk` read `layout.rooms` (not counting their variant files). Corridors feed:
- the per-deck corridor floor unions;
- the baked sign atlas;
- cabin footprints;
- the finish kit, the Phase 4 community fit-out and wayfinding;
- the launch B and D geometry, the legacy corridors and the hex floor.

Room features such as the theatre and concession place themselves from their room's frame.

### 4. Models stage (864 s warm in the last deploy build)

- This stage builds the whole ship in Node from `layout.json`.
- `walk-plan.json` comes out of it. That file holds the rails, the void guards, navigation, and every room's shell outline and door. `walk-map.png` comes out of it too.
- Neither has a per-room producer.

### 5. Prepared authoring and lane B

- Lane B can author one older room's source and shell in Node against `layout.json`, and swap its owned spans.
- It refuses a changed room frame.
- It excludes 20 rooms with later world or activity passes (the theatre is one), and any room that owns hull interfaces.

### The two real edits

| Edit | What it touched | Narrow lane? |
|---|---|---|
| #314 theatre entrance | Door moved along the wall (`DOOR_ALONG`); two door-approach corridors, deck reservations and the nav grid changed; theatre and concession features; fit-out override | No: the theatre is excluded from lane B, and a corridor neighbour changed |
| #327 Hydro-Nip lounge | Door, galleries, links, maze tubes and pieces of `commons-1`, a hull-bound garden room; `room-shell.js`; garden guards (rails); Go-to; arcade, vault and jaguar features | No: the hull, the rails and shared producers changed |

A lane that only takes a change confined to one room's own layout record catches **0 of 2**.

## Why the narrow lane isn't safe yet

Here is what the narrow lane would do:
1. Re-solve the layout and accept the edit only if the diff stays inside `rooms[X]`.
2. Splice that record into the baseline layout.
3. Rebuild room X through lane B.

What it would need to check is still missing. Equal layout records outside X don't prove that the built geometry outside X is unchanged. Dozens of readers take every room's polygon, for example the corridor floor unions, the guards and rails, the map, and features that sit in X. Today only the models stage can prove which outputs changed, and it is the whole-ship cost this lane is meant to avoid. A wrong guess here loses collision or leaves a stale wall in a corridor. That is the one failure Jay ruled out.

## The next slices, in order

1. **Stable navigation-grid ids.** Key the grid nodes by deck and cell instead of a running counter. A door move then changes only the edges it actually reroutes. This changes `layout.json` for every deck once, so it lands just before a nightly.
2. **Door approaches belong to the room's section.**
   - Build each door-approach corridor's floor and walls as a span tagged with its room, cut out of the deck's corridor floor union, which stays one owned span per deck.
   - A door move then rebuilds the room, its own approach, and any neighbour approach the layout diff names.
   - Signs on the approach stay wide until the sign atlas is split per owner (as in lane B).
3. **The layout diff becomes the lane's classifier.**
   - With 1 and 2 in place, the lane accepts a re-solve whose diff touches only `rooms[X]`, X's approach corridors and their reservation strips.
   - It widens on any other room, the hull, windows, cabins, shuttles, bay access, the rails or void guards (`walk-plan.json` `railProbes`, as in lane D), or a feature placed from X's frame that isn't a qualified `feature()`.
4. **Per-room walk-plan rows.** The lane rewrites X's shell row and re-runs only the guard and rail planner cells that X's old and new outlines touch. If the planner can't be cut to cells, the lane widens.

Each slice needs the same proof as the earlier lanes: lane time, plus equality by content with a **forced** full build (`LEO_PREPARED_FORCE=1`) outside the changed section.

Hull-bound rooms (the #327 kind) need step 2 of the section rebuild (hull panels per room) first.

## Input-purity fix (this change)

The layout stage now depends only on its sources and the v1 hull:

- **Ceilings fit the layout stage's own output** (`exterior-layout.json`). They no longer read the `layout.json` that an earlier ceilings run had already fitted.
  - Measured against the live deploy's files: byte-identical output (`0947d828…`), and the ceilings cache still hits.
  - The old code was a fixpoint on today's files, so this removes a latent self-read; no live bytes change.
- **The hull-source cache returns the file it wrote.** A cold run used to return the in-memory scene, and a warm run parsed the saved GLB. The export keeps only visible objects, so the two could differ. Both now parse the same bytes.
- **The unused `--normalize` mode is removed.** It read `layout.json` and `walk-plan.json` back and rewrote both. Nothing called it.

**Cost:** these scripts are geometry producers, so the first build after this merge takes the wider route once, and it re-runs the layout and ceilings stages. The nightly already does a full build.
