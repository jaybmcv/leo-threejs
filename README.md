# LEO — Life aboard, interior study 01

The next residential redesign is documented in [Residential hierarchy proposal](RESIDENTIAL_HIERARCHY.md): ten accommodation tiers, 5,214 rooms and 10,000 residents. This is a proposal; the current model retains its existing 5,000 twin cabins.

![Current LEO website perspective render](src/reference-shuttle/assets/full-reference.png)

The image above is the current V35 perspective export from the live viewer, captured 2026-09-14. It replaces the older reference image that was previously easy to mistake for the current ship. The earlier concept is preserved as `src/reference-shuttle/assets/full-reference-concept.png`.

The accepted V31 exterior is retained as the source baseline. The active V36 exterior adds refined hull finishes, projected markings and seams, engine service panels and the glazed panoramic fin lounge. The current interior includes all ten furnished residential decks (5,000 twin cabins / 10,000 berths), ten fitted garden commons, 68 fitted ship areas across eight decks, and the shared observation lounge. Aft pass 03 now adds machinery, reservoirs, pod interiors, wing maintenance routes and fin structure and the panoramic crown to the combined ship GLB. The source `leo-exterior.glb` remains byte-identical; the viewer and combined GLB use the same refined V36 exterior. The machinery hall, tank bay and pod interiors now have removable enclosures, open portals and route lighting. Equipment remains a concept arrangement.

## Complete polish and directional glazing — V36

All 68 named rooms, nine service/command corridor groups, residential corridors, lifts, stairs, five aft sections, 5,000 cabins, ten gardens and both observation lounges share the second polish pass. It adds softened joinery, tailored upholstery seams, instrument bezels, satin hardware, stair edge markers and calibrated material finishes without moving established floors or routes.

The original curved white fin-cap underside is retained below the panoramic lounge, with a clear lift opening. The same underside is present in the exterior, full ship and standalone aft lounge. The small underfloor rim joins it to the lounge floor.

All 1,382 passenger windows and the bridge, observation and fin-crown glazing use opposed single-sided surfaces: exterior opacity 0.88 and interior opacity 0.12. This is an art-directed visualization treatment, not a physically reciprocal optical coating. The dual surfaces survive GLB export and remain tinted after changing viewer modes. Forward observation bands now have actual apertures through their previously opaque shell and seal backing. Existing window floor alignment is preserved; enclosed cabins away from the hull do not gain private exterior views.

`node scripts/check-polish.mjs` audits the saved complete ship, including every named area, both glazing faces, clear bow sightlines and the retained lower cap against the accepted source. Historical sections and renders below describe their labeled earlier passes.

## Engine maintenance windows — V35

Added 52 glazed exterior openings: 16 beside the central thruster hall and 36 across the side engine pods (nine on each inner and outer face). Matching apertures and framed glazing now pass through the interior acoustic walls. The central sills sit 1.25 m above the -11.7 m maintenance floor; pod sills sit 1.25 m above the -19.7 m floor. Openings avoid the main equipment support stations. Exhaust outlets remain unchanged.

There are now 1,382 small exterior windows, excluding the large bridge and crown panorama glazing. Interior glazing layers are not counted as extra exterior windows. Use **Engine windows** to inspect the new exterior details. Aft systems inspection views show the matching interior windows.

Saved-model checks pass for pod apertures, 13,744 retained pod surface samples, inner wall apertures and 3,324 unchanged exhaust vertices. Main hull and fin checks, 68,587 aft containment samples, aft access checks, full assembly checks and all nine GLBs pass. The refined exterior is 49.16 MiB, the aft component 12.01 MiB and complete ship 157.45 MiB.

Current V35 renders: [engine windows](renders/exterior-refined-enginewindows.png), [concept](renders/exterior-refined-concept.png), [pod interior](renders/interior-aft-pods-inside.png), [central interior](renders/interior-aft-drive-inside.png). Other renders retain their prior revision labels.

## Upper and aft windows — V34

This pass adds 282 glazed openings: 74 on Deck 20, 140 around aft access levels, 20 along the upper aft service gallery, and 48 beside fin inspection platforms. There are now 1,330 small windows, in addition to the existing bridge and crown panorama glazing. Exhaust housings remain unchanged. Fin windows avoid registry marks, access hatches and the part of the fin embedded in the main hull.

Window heights derive from the deck/platform schedule. The original passenger rows begin 1.25 m above the structural deck datum (about 0.95 m above its 0.3 m raised finished floor); new aft and fin sills are 1.25 m above their actual platform floors. These are perimeter openings, not a guarantee of a private view from every enclosed interior room.

Checks confirm 3,205 sampled main-hull aperture positions and 120 fin aperture positions are open through the shell, plus 26,660 retained hull positions and 9,921 retained fin positions. Hull and fin bounds are retained. The fitted assembly and all nine GLBs pass. The refined exterior is 48.66 MiB and the complete ship is 157.45 MiB.

Use **Aft windows** for the new close-up. Updated V34 renders show [aft windows](renders/exterior-refined-aftwindows.png), [concept](renders/exterior-refined-concept.png) and [side](renders/exterior-refined-side.png). Other renders retain their prior revision labels.

## Passenger windows and mission emblem — V33

Both sides now carry 524 small passenger windows each (1,048 total), aligned to Decks 6–19. The 3.1 × 0.95 m apertures start 1.25 m above each deck floor, with transparent blue glazing, thin frames and reveals. Apertures cut through the retained hull and overlapping lower thermal panels. Rows leave space for the main identity fields, upper glazing and access hatches. These are perimeter windows; this does not give every internal cabin a private exterior view.

The supplied transparent Mars Cats Voyage PNG is preserved in `assets/mars-cats-voyage-original.png`. Its alpha contours, including the helmet, antenna, cat, whiskers and star, are reproduced as conforming navy geometry on both sides. The old approximation is removed. Use **Windows & logo** for the new close-up camera.

V33 checks sample 2,620 positions across paired apertures, verify 17,599 hull positions outside the openings, retain hull bounds, and compare 80,828 wing/pod/fin vertices with zero movement. The full assembly and all nine GLBs pass their existing checks. Updated V33 renders cover concept, top, side and the window/logo close-up; other exterior images retain their V32 labels.

## Explore

Run `npm start`, then open http://127.0.0.1:4173/.

- **Exterior:** inspect eleven cameras with the studio backdrop and full surface details enabled by default. Shape only isolates the approved form. Save exterior PNG exports a clean 3200 × 2000 image.
- **Neighborhood:** choose any of the ten neighborhoods, then inspect its cabin or upper garden. Enter this space opens an eye-level view. Show walls & ceilings controls the enclosure. Observation opens the shared lounge; Walkthrough follows the established six-stop Neighborhood 10 route or the new eleven-stop residential / engineering / fin crown journey.
- **Ship areas:** choose a cargo, transfer, cultivation, life-support, medical or recreation room. Switch between Room overview and Eye-level view. Locate on deck shows its connected deck plan.
- **Deck layout:** residential decks contain furnished cabin instances. The six original service decks have eight principal rooms connected by an eight-metre central corridor and seven-metre branches. Command and engineering have additional fitted corridors. Decks 17–19 show the ten garden commons.
- **Connections:** choose the forward or aft core and any served deck. Inspect a three-deck overview, lift lobby or stair landing. The forward pair of lifts and stairs serves Decks 1–20; the aft pair serves Decks 1–19. Upper promenades link all ten gardens on three levels.
- **Aft systems:** inspect the combined cutaway, central machinery hall, lower tank bay, paired engine pods, service access fin structure or the panoramic crown and bar. Section overview shows the retained exterior as a translucent context shell; Inspection view moves inside. Open `?aft=overview&view=overview` for the full aft cutaway.
- Save interior PNG exports the current room or neighborhood. Hide panels clears the overlays. Room, neighborhood and deck links retain their selected view when reopened.

Example: http://127.0.0.1:4173/?district=3&space=garden&eye=1

The new journey is available in **Walkthrough → Choose a journey → Residential / engineering / fin crown**, or directly at `?walk=1&tour=aft&stop=0`. Play, pause, next, previous and individual stop buttons are available. Eleven guided stops use scene cuts for deck and lift transfers; this is not continuous simulated walking. `aft-journey.json` records the route.

## Modeled spaces

Each neighborhood has 500 cabins with two beds, a desk, shelves, storage and a compact ensuite, arranged along five residential corridors. Cabin geometry is instanced across all 5,000 locations. The upper gardens contain planting, seating, café tables, shared kitchen and laundry facilities, parcel lockers, reading areas, two gallery levels with three-sided walkways and stairs. Gardens 3 and 4 sit 2.5 m closer to the centerline to clear a local narrowing in the pressure envelope.

The original 48 service rooms cover cargo and provisions; passenger arrival, screening, baggage and airlock preparation; hydroponics and food preparation; air, water, thermal, recycling and power distribution; medical care and emergency shelter; learning, library, exercise, recreation, theater, childcare, dining and community work. Medical wards now have 24 modeled beds each, and the airlock rooms contain enclosed chambers with stowed pressure-door leaves. These are concept arrangements, not capacity-rated ship systems.

The command deck now includes a bridge aligned with the upper bow windows, navigation, mission control, communications, crew facilities, briefing, data processing, a captain’s office and security operations. Five aft engineering areas contain concept power modules, drive-feed pumps, control stations, workshops and an engine-service gallery. The forward shuttle bay contains four transfer shuttles and raised boarding platforms. Five lower decks each carry twenty modeled 100-seat lifeboats, for 100 craft and 10,000 physical seat positions. Seat layouts preserve central and cross boarding aisles; endurance and evacuation rates are not rated.

The observation lounge retains 72 upholstered chairs, reading benches, tables and lamps, timber ceiling ribs, planting and a viewing scope. Its 24 m approach ramp rises 2 m from the garden level. The Mars backdrop is procedural illustration. Artificial gravity is assumed.

The aft blockout includes three central drive trains aligned with the three rear panels over Deck 8, four reservoirs over Deck 4, four drive chambers across the two engine pods, structural frames and basic supply connections. A dedicated service lift and switchback stair connect Decks 4–17. Stepped wing galleries descend from Deck 9 to the pod maintenance aisles. The fin contains spars, diagonal webs and seven inspection platforms served by a new passenger lift from the upper service gallery to the crown. The crown sits at 132.3 m, following the original cap footprint, with 66 panoramic window panels, a central island bar, eight bar stools and eight curved banquette groups. The roof lifts out in the section overview. Timber ceiling ribs, an oval pendant, low bar lighting and a sheltered lift lobby refine the arrival and gathering spaces. Equipment is fitted to the saved hull geometry; operating machinery and lift travel are not simulated.

## Model files

All models use ship coordinates and metres.

- `leo-residential-decks.glb`: all 5,000 furnished cabins and their residential corridors, across ten decks.
- `leo-garden-commons.glb`: ten furnished gardens with galleries and shared facilities.
- `leo-service-areas.glb`: all 68 fitted areas, including command, engineering, the four-shuttle bay and 100 lifeboats, plus horizontal corridor networks.
- `leo-neighborhood.glb`: the original integrated Neighborhood 10 study, including the same forward lift/stair geometry used in the whole ship, garden, ramp and observation lounge.
- `leo-full-ship.glb`: 157.45 MiB combined assembly: retained exterior, twenty cut structural decks, cabins, gardens, ship areas, observation lounge and the new aft blockout. Four main lift shafts and stair towers, one aft service lift and stair, and one crown passenger lift make six lifts and five stair towers. Coarse reservation boxes are excluded.
- `leo-aft-systems.glb`: 12.01 MiB aft model, including the five existing engineering rooms and their Deck 7 corridor.
- `aft-areas.json`, `aft-fit-report.json`, `aft-integration-report.json`: inspection views, shell containment checks and maintenance-route checks.
- `leo-transit.glb`: four lift shafts, four stair towers, landings and upper promenade connections.
- `assembly-manifest.json`, `assembly-roundtrip.json`, `transit-fit-report.json`, `transit-network.json`: assembly counts, integration checks and connection graph.
- `leo-exterior.glb`: unchanged accepted V31 source exterior.
- `leo-exterior-refined.glb`: 31.53 MiB active V35 exterior, including the panoramic crown; shared by the viewer and full assembly.
- `exterior-refinement-report.json`, `exterior-finish-check.json`, `EXTERIOR_REFINEMENT.md`: surface projection, retained-shape checks and visual review record.
- `ship-areas.json`, `cabin-schedule.csv`, `design-data.json`: area, cabin and deck schedules.
- `area-fit-report.json`, `special-area-fit-report.json`, `area-roundtrip.json`, `residential-fit-report.json`, `garden-fit-report.json`, `interior-fit-report.json`, `glb-validation.json`: validation evidence and scope.

Residential GLBs use `EXT_mesh_gpu_instancing`; import them with an application that supports that extension. The viewer uses the same detailed geometry.

## Integration and verification

Structural floors have openings for the lift shafts, stair flights and half-landings, the double-height hangar, garden atriums and observation lounge. Bow floor edges are clipped inside the finished exterior. The two aft Deck 16 rooms have recessed corners around the stair lobbies. Transit finishes sit 6 mm below adjoining corridor finishes where they overlap, avoiding coplanar flicker.

The combined GLB was reloaded and checked for 5,000 actual cabin floors, ten gardens, 68 area roots, four shuttles, 100 lifeboats, 10,000 lifeboat-seat instances and a single shared lounge. Checks cover 476,040 structural slab vertices, 1,850 main stair headroom positions, 294 landing/garden passage segments and 5,922 supporting floor samples. New aft checks cover 66,243 geometry samples against the saved hull, wing, pod and fin envelopes; 4,144 headroom and supporting-floor positions; and 18 horizontal clearance probes at the pod junctions. All nine GLBs report zero validator errors and warnings; instancing is additionally checked after loading because the validator does not support that extension.

The preceding V32 exterior check compared 544,384 primary hull, wing, pod and existing fin vertices against the retained baseline with zero movement. All 175,348 projected detail vertices resolve onto the hull. Eight exterior views were reviewed and exported: concept, perspective, top, side, front, aft, bow and engine.

This is a furnished main-ship **concept model** with aft machinery and a fin crown lounge, with artificial gravity assumed. System sizing, propulsion, life-support endurance, structural loads and evacuation flow are further engineering work. Lift cars are shown parked, and the guided camera route remains illustrative rather than a collision-navigation simulation.

## Rebuild

The complete interior refinement pass covers all 68 scheduled areas, nine service
and command corridor groups, the main lift/stair network and all five aft
engineering sections. Treatments include clinical furnishings and patient services,
cultivation rack details, cargo and storage identification, fitted workstations,
public-room upholstery, command displays, shuttle and lifeboat fittings, machinery
instruments, pipe bands, deck signage and stair grip strips. These are concept
details, not simulated operating controls. The earlier cabin, garden and lounge
finishes are retained. `refinement-coverage.json` audits the saved full-ship model.

Both observation lounges now share warmer upholstery, stone tables and refined
furniture details. The forward lounge has open reading shelves, layered planting
and timber wall lining. The fin crown retains its panoramic glazing and central
bar, adding oak battens, backed stools, table lamps and fitted service equipment.
The accepted room outlines, window geometry and main circulation remain in place.

Garden commons now share a refined finish template: layered foliage in the two
existing planted beds, cushioned oak benches, stone cafe tables and worktops,
coffee equipment, open reading shelves, warm pendants and under-gallery lighting.
All ten gardens retain their accepted footprints, galleries and routes.

The current residential finish pass adds rounded furniture, sage upholstered headboards,
oak storage, reading lights, desk lighting, ensuite accessories and corridor guides.
It repeats through all 5,000 cabins without changing their footprints or berths.
The aft dorsal sensor pad and its antenna move 49.24 m toward the nose, onto the
short crown. The accepted hull remains unchanged.

The public viewer is built with `npm run build:public` after the model build.
`dist/` contains the complete viewer and losslessly compressed model downloads;
each transport part is at most 16 MiB. The browser restores the original GLBs.
Local overlay/comparison tools are excluded from the public page. Public access
is managed by the project in `.openai/hosting.json`.

```sh
npm ci
npm run build
npm run check
npm start
```

The crown geometry is derived from the projected cap outline. Only the solid cap, top marker and fin tip above the new floor are changed in the active exterior. Main hull, wings and engine pods retain the accepted shape.

The build retains `output/leo-interior-v01/leo-exterior.glb` and verifies its accepted SHA-256 before and after assembly. It first builds the refined exterior, then all fitted components, the assembly and the viewer. The legacy `scripts/build.mjs` is an exterior/planning generator and is not used by this workflow. Geometry uses +X forward, +Y up and +Z starboard. The exterior mapping is `physicalX = 0.94 * logicalX - 18`. V31 sources are preserved in `archive/v31-source`. Three.js is MIT licensed; its license is included in the output.


## Residential nose commons — Decks 6–15

Ten fitted social spaces occupy the bow ahead of the residential decks. Each uses a hull-limited footprint at ceiling height, a 6 m central promenade and a 4 m approach from the forward core. No sleeping capacity was added.

| Deck | Commons | Defining activity |
|---|---|---|
| 6 | The Daily Grind | Cafe counter, conversation groups and small tables |
| 7 | The Reading Room | Book aisles and reading desks |
| 8 | The Colour Works | Shared studio benches and easels |
| 9 | Little Orbits | Soft play and child-height craft tables |
| 10 | The Listening Room | Piano, mixing desks and listening salons |
| 11 | The Games Club | Chess, board games and table tennis |
| 12 | The Slow Room | Stretching, meditation and tea |
| 13 | The Tinker Room | Electronics, printers and repair benches |
| 14 | The Long Table | Teaching kitchen islands and shared dining |
| 15 | The Quiet Grove | Low planting, seating circles and botanical study |

Open `?district=1&space=nose` or use Neighborhood → Nose commons. The selector preserves nose focus across all ten decks; Enter this space restores the lining at eye level. Both `leo-residential-decks.glb` and `leo-full-ship.glb` include all ten commons; the Neighborhood 10 download includes its grove. The existing upper garden commons remain separate. Geometry and route checks are in `scripts/check-nose-commons.mjs`. These are fitted concept interiors, not an occupancy or engineering certification.


## Aft neighborhood services — Decks 14–15

Four fitted rooms occupy x = −261 to −181 m, with 4 m doorways onto an 8 m central passage. The passage meets the existing aft landing at x = −174 m, leaving the service lift and stairs clear. Deck 14 contains laundry/linen exchange and parcel collection/returns. Deck 15 contains a repair studio and a shared-equipment/storage library. These are included in Ship areas, Deck layout, the service-areas download and complete fitted ship. Select an area for an eye-level view or locate it on its deck. The upper engineering gallery and fin access retain their existing geometry.


## Upper aft commons — Decks 16–17

Deck 16 adds Voyage training & briefing on the port side; Deck 17 adds the Fin lift arrival lounge on starboard. Both have 48 × 16 m footprints at x = −233 to −185 m and 4 m entries. Deck 16 has a new connection to the aft landing. Deck 17 reuses the existing upper gallery, with a single opening in its starboard railing leading through a protected connector to the lounge. The fin lift remains at its existing location. The rooms are available through Ship areas, Deck layout, Aft systems, and the service, aft and full-ship downloads.


## Lower bow facilities — Decks 1, 4 and 5

The lower nose now contains expedition stores/outfitting on Deck 1, fresh-food cultivation and preparation on Deck 4, and rehabilitation/movement on Deck 5. Each 64 × 60 m room lies at x = 164–228 m with a 6 m main room aisle. A 4 m approach connects it to the forward core; enclosing walls begin at x = 148 m beyond the stair towers. Decks 2–3 retain the double-height shuttle bay. The three areas appear in Ship areas, Deck layout and the service/full-ship downloads. Layout and equipment are concepts; throughput and clinical provision are not certified.


## Forward voyage forum — Deck 16

A 52 × 48 m forum at x = 154–206 m adds 120 modeled audience seats in two banks, four open mobility-device spaces, a rear foyer, side gathering tables and a 0.25 m stage. The stage ramp has a 5 m run and 2 m clear width. The room owns its 4 m approach from the forward core; walls begin beyond the stair towers at x = 148 m. The forum is available in Ship areas and Deck layout and is included in the service and complete-ship downloads. Modeled seating is not a certified event capacity.

## Lower aft services — Decks 1–3

Three rooms step back progressively beneath the rising tail: Deck 1 spares and bulk stores (44 × 30 m), Deck 2 maintenance workshop (60 × 36 m), and Deck 3 engineering support and inspection (71 × 38 m). Their forward entries at x = −154 m connect to the existing service spine at x = −148 m through 6 m wide approaches. Central and transverse aisles remain clear of racks, benches and inspection equipment. All three appear in Ship areas, Deck layout and the service/full-ship downloads. The lower tail beyond these rooms remains structural space where the hull does not permit full-height rooms. Geometry and saved circulation checks are in `scripts/check-lower-aft.mjs`.

## Deck 20 command finish

Deck 20 now has 11 fitted rooms: the nine existing command spaces and bridge, plus an aft mission-planning studio and crew-recovery lounge. The new 52 x 20 m rooms occupy x = -116 to -64 m, beside an 8 m spine that meets the existing corridor at x = -52 m. Full-height spaces stop before the roof drops below usable height farther aft. Fit checks use the final sculpted roof, rather than the earlier conservative upper hull profile.

Slate floors, blue upholstery, warm joinery, instrument details, planning-table surfaces and room signs carry through the command rooms. The main corridor has continuous inset guidance strips. The existing crew ready-room counter is moved aside to clear its entry. The accepted exterior and 10,000 modeled berths are retained. `scripts/check-command-deck.mjs` checks all Deck 20 finishes, roof containment, the connecting spine and room entries in the saved model.
