# Healing capsules in the Surgical suite: acceptance record

Project-local record for the existing capsules in the Deck 5 Surgical suite (`src/walk/surgery.js` and its `.authoring`, `.prepared` and `.public` copies, which differ only in how geometry is replayed; `src/walk/capsule-bubbles.js`; the entry, leave and float code in `src/walk/main.js`; the blue view in `src/walk/walk.html`). History: step 1 from tester feedback (PR #229) built the capsules; the later report (#210, PR #299) added bubbles, the shared floating pose, wall monitors and hazard bins. Nothing was built, moved or repaired in this step: no capsule rebuild, no roaming robot medic, beds, robot arms, layout and circulation untouched.

Tested build: source at main `33ed54f3`. This checkout has no built layout 2 (`output/leo-interior-v02/layout.json` is absent) and no browser pass was run, so **nothing below was exercised on screen**. "Verified" here means read from the source and the earlier step's recorded results. Every row marked "untested" needs a walk on a layout 2 build. No screenshots are attached for that reason; the original tester shot and reference picture were not available to this step and were not imported or copied.

## Where it is

Room `d05-surgery-2`, "Surgical suite", Deck 5, 52 m by 34 m. In the room frame there are six bays at x -15, 0, 15 and z -9, +9 (bed along z, partitions at x -21, -6, 9). The historical view `walk.html?at=-62.46,-23.70,-42.43&yaw=156&pitch=-28` is a layout 1 coordinate (a link without `lv=2` is read as layout 1 and remapped by `src/walk/link.js`). In the layout 1 frame, where the room's centre is (-45, -23.7, -38), it is room-frame (-17.46, -4.43): in the suite, about 4.7 m from the capsule of the (-15, -9) bay. Its layout 2 world position is read from the built plan, which was not available here, so these coordinates do not identify the room in layout 2 and should not be used as one.

The six capsules (room frame, from `CAPSULES`: x-3.3 of each bay, facing the middle aisle):

| Bay | Capsule x, z | Faces | Readings unit x | Readings seed (screen heading) |
| --- | --- | --- | --- | --- |
| 1 | -18.3, -9 | +z | -19.75 | PATIENT 01 |
| 2 | -18.3, +9 | -z | -19.75 | PATIENT 02 |
| 3 | -3.3, -9 | +z | -4.75 | PATIENT 03 |
| 4 | -3.3, +9 | -z | -4.75 | PATIENT 04 |
| 5 | 11.7, -9 | +z | 10.25 | PATIENT 05 |
| 6 | 11.7, +9 | -z | 10.25 | PATIENT 06 |

(Bay order follows `BAYS`: x then z.) All six are built by one function, so any requirement below applies to every bay unless a row says otherwise.

## Requirement results

| # | Requirement | Result | Basis |
| --- | --- | --- | --- |
| 1 | A capsule in each cubicle | Satisfied in source; untested on layout 2 build | `capsule()` runs for all six `CAPSULES`; PR #229 check:walk case: six capsule spots, each 0.24 m up and reachable |
| 2 | Enter the capsule (E or Use) | Satisfied in source and the PR #229 headless run; untested on layout 2 | `rest.js` makes a `stand` spot from `Healing_capsule_floor`; prompt "Enter the healing capsule" within 1.5 m, floor level 0.24 m |
| 3 | Stay inside until Leave | Satisfied in source and the PR #229 headless run; untested on layout 2 | The walk's "move to stand up" branch excludes `resting.stand`; only E or the button (`standUp`) leaves; prompt becomes "Leave the capsule" |
| 4 | Camera switching (V) | Satisfied in source; untested on layout 2 | First/third toggles while resting; glass, fluid, crown and hoses are `noCollide`, so the camera follows inside; Cosmo is hidden only in first person (`holder.visible`) |
| 5 | Cosmo appears inside with hoses attached | Outstanding: attachment not confirmed | Cosmo floats 0.20 to 0.25 m up (`restPose`, shared `float` pose, also shown to others as `healing_capsule`); five crown hoses end 1.0 to 1.25 m above the capsule floor, 0.2 m off the axis. Whether the tips meet the floating body is visual and untested |
| 6 | Nearby medical equipment has connected hoses | Capsule unit satisfied; wall monitor and hazard bin outstanding | Each readings unit has three hoses: two into the pedestal, one up to the crown. The wall `medical_monitor_unit`s and `medical_hazard_bin`s (`room-fitout-overrides-v2.json`, `d05-surgery-2`, all six bays) have no hoses; the bed's own console, side screen and floating panel are not piped either |
| 7 | Varied simulated body readouts | Partly satisfied | Each capsule unit shows its own seeded heart, oxygen, temperature and healing figures (static, not animated). The floating vitals panel (one shared canvas for all six beds) and the six-times-repeated wall monitors (three bars each) are identical everywhere and do not change |
| 8 | Leave returns to a supported, unobstructed floor with normal controls and camera | Satisfied in source; untested | Leave eases back and `controller.place`s the walker at the position they entered from (a floor spot that was outside the 0.8 m solid pedestal), `resting` clears, input returns, the follow camera resumes. PR #229's headless run saw the prompt cycle and no page errors. Not tested: leaving after entering mid-jump, leaving with a remote visitor's capsule occupied, and a walk-off from the landing spot |
| 9 | Later bubbles, floating pose, equipment details: no regression | Untested | Source is intact: 16 bubbles per capsule always rise (`capsule-bubbles.js`); red/green lights pulse and three rings rise only while someone (local or remote) stands within 0.46 m of the axis; the shared float pose is used for remote visitors too. A layout 2 screenshot pass is needed |
| 10 | First-person blue tint or size distortion | Source reading below; untested on screen | See next section |

## First-person tint and size

By source, both effects are deliberate and exist only in the capsule (`body.capsule-view`, set by `capsuleView()` every frame):

- Blue tint: a radial blue gradient laid over the viewport, opacity 0.28 to 0.75 at the edges, fading in and out over 0.6 s.
- Apparent size: the canvas is scaled between 1.03 by 1.06 and 1.07 by 1.03 in a 5 s loop (a waver); with reduced motion it holds still at 1.04. That is a 3 to 7 percent stretch and the likely "distorted" cause.
- The class is set only while resting in a capsule, fully in, in first person. Third person, leaving, or any other place gives off. So neither should persist after leaving. At worst the tint fades over 0.6 s. If the animation loop returned early (the Builder's Hub open over the walk) the class would not clear until the loop runs again; this was not tested.

Neither this record nor the brief changes the effect. If the tester's "distorted and all blue" meant first person outside a capsule, it is not explained by this code and needs the tester's build and spot.

## Concrete missing requirements per cubicle

The same for all six bays, from the table above:

1. Cosmo-to-hose attachment: not confirmed on screen; may need hose ends moved to the floating body's height.
2. The wall medical monitor and hazard bin at each bay have no hose connections.
3. Their readings are identical in every bay and static; the floating vitals panel is shared by all six beds.
4. The capsule readings are static textures (varied per bay, but nothing moves).
5. Layout 2 screenshots of each capsule (outside, inside in third and first person) and a leave test are not on record.

## Remaining medic scope (separate, not started)

A walking robot medic that visits bays was deferred in step 1 and is not built. The ceiling robot arms (existing) are the only automated medic hardware. Hose connections to the wall equipment and live readouts, if wanted, are a separate small step from the robot medic. Rebuilding capsules is not asked for.

## Verdict

Outstanding. The capsule is present, enterable, held until Leave and returned to the floor in source and in the earlier step's headless run, and the blue tint and size waver are limited to the capsule by source. That is not yet enough to mark the capsule portion satisfied: nothing was run on a layout 2 build, hose attachment on the floating body is unconfirmed, and the wall equipment and floating panel lack hoses and varied readouts. The report stays open. This step is the first: the record. What would follow is the layout 2 walk and screenshot pass for each bay, then the small equipment fixes (hoses, varied readouts), then the robot medic if Jay wants it.
