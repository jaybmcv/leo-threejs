# LEO — whole-ship build plan

Goal: build every ship area as an explorable 3D concept, retaining the accepted V31 exterior and 5,000 twin cabins / 10,000 berths. Engineering certification is outside this concept-art/modeling task; a furnished room is not evidence that its equipment can sustain 10,000 people.

## Main-room build gates

- [x] Decks 1–2: cargo, logistics, passenger transfer, airlocks, shuttle handling and lifeboat embarkation.
- [x] Deck 3: hydroponics, nursery, harvest handling, food preparation and stores.
- [x] Deck 4: air, water, thermal control, recycling, electrical distribution and maintenance.
- [x] Deck 5: wards, surgery, isolation, clinic, pharmacy, imaging, counseling and shelter.
- [x] Decks 6–15: all ten furnished neighborhoods, 500 cabins each, corridors and vertical connections.
- [x] Deck 16: classrooms, library, exercise, recreation, theater, childcare, dining and community facilities.
- [x] Decks 17–19: all ten fitted garden commons, galleries and linked promenades.
- [x] Deck 20: bridge, navigation, mission control, communications and crew operations.
- [x] Five original aft engineering rooms: engine access, power plant, controls and workshop fittings. This gate did not cover the full tail volume.
- [x] Observation lounge and connecting approach retained and integrated with the complete interior.
- [x] Every area has an overview, human-scale view and clear deck/location information.
- [x] Full assembled GLB contains fitted areas, without duplicate reservation boxes occupying furnished rooms.
- [x] Geometry checks cover all areas, all neighborhoods and occupied upper/lower boundaries; verify representative renders for every room type.
- [x] Verify the saved exterior is unchanged, regenerate documentation and package the full result.

## Current evidence

V35 adds 52 engine-maintenance windows through both outer skins and inner acoustic walls. Exhaust outlets are retained. The complete ship is 157.45 MiB; all relevant aperture, containment and integration checks pass.

V34 adds 282 upper-deck, aft-access, aft-gallery and fin-platform windows, for 1,330 small glazed openings. Hull/fin surface and aperture checks pass. The complete model is 156.47 MiB.

V33 adds 1,048 deck-aligned passenger windows, cut through the shell and overlapping thermal panels, and replaces both mission badges with contours from the supplied logo. The new Windows & logo camera shows the result. Aperture and retained-surface checks pass; the combined model is 154.34 MiB.

Exterior V32 is complete: satin ceramic and thermal finishes, conforming markings and seams, separated glazing frames, engine service panels and crown trim. The active viewer and assembly share `leo-exterior-refined.glb`. Eight exterior cameras were reviewed and exported. The retained-shape check compares 544,384 primary vertices with zero movement; 175,348 detail vertices project successfully. The earlier authorized crown replacement remains.

Aft pass 03 encloses the central hall, tank bay and both pods with removable walls and ceilings, open entry portals, route markings and lighting. The crown now includes eight curved banquettes, ceiling ribs, pendant lighting and a lift lobby. An eleven-stop guided journey links housing, engineering and the crown, with scene cuts for deck transfers. All eleven stops were visually reviewed in the live viewer; next, replay, pause and route switching were exercised.


Aft pass 02 adds three parallel central thruster rows at z = -16, 0 and 16 m, twin service aisles, and the fin crown panorama with a central bar. A sixth lift serves the fin platforms and crown; the maintenance ladders are replaced by lift access. The active exterior has a glazed replacement cap and a locally lowered fin tip. The V31 source GLB is retained unchanged. Crown area and furnishings are additional to the original 68-room program.


The furnished main ship and aft structural pass 01 are assembled in `leo-full-ship.glb` (139.3 MiB). Reloading the export counted 5,000 furnished cabin floors, ten garden commons, 68 fitted ship areas, four transfer shuttles, 100 lifeboats with 10,000 physical seat instances, twenty structural decks and one shared observation lounge. There are no coarse room, cabin, garden or lift reservation boxes in the assembly.

Four lift shafts and four switchback stair towers connect the occupied decks. The forward pair serves Decks 1–20 and the aft pair Decks 1–19. Promenades and entry bridges link all ten gardens on Decks 17–19. The two aft Deck 16 rooms have recessed corners for the stair lobbies. Neighborhood 10 uses the same forward transit source, and the observation approach retains its 1:12 ramp.

Integration checks passed for 156 shaft/stair/special-volume openings, 476,040 structural slab vertices below the finished roof, 1,850 stair headroom positions against the assembled geometry, 294 clear landing and garden passage segments, and 5,922 supporting-floor samples. Separate checks passed for 1,240,160 residential geometry corners, all ten garden ceilings and fittings, 48 standard room envelopes, 20 special areas and the observation lounge. All nine GLBs have zero validator errors and warnings; the unsupported instancing extension is additionally checked through GLB round trips.

All 51 ship-area types have saved, reviewed overview renders. Changed classroom and theater views were regenerated after stair integration. Forward garden connections, aft transit, lift lobbies and stair-level views were reviewed in the live viewer. Every directory area and neighborhood has overview and eye-level views, with explicit deck information. The viewer also offers the Connections mode and the six-stop Neighborhood 10 guided route.

The accepted source exterior remains byte-identical (the active model includes the crown revision): SHA-256 `8971e14e0e72951880811b8a7e4f3e57310a733a9d990ba3a2ae2eec4ebabfee`. The fitted assembly and component files, viewer, schedules, renders, documentation and reports are included in the refreshed output package. `npm run build` now preserves this exterior and builds the fitted sources; `npm run check` runs the component and assembly checks.

The main room program is furnished. Aft structural pass 01 adds the central drive hall, four reservoirs, both pod interiors, wing galleries, a service lift and stair, and fin spars with seven inspection platforms. There are now six lift shafts and five stair towers, including the new service core. Aft pass 03 has since added the enclosures and initial equipment detailing described above. This pass establishes its basic arrangement; it does not mean every remaining volume or system is finished. Aft checks passed for 66,243 containment samples, 4,144 floor/headroom positions and 18 pod-junction clearance probes. Artificial gravity is assumed; system capacities, structural loads, propulsion, endurance, evacuation flow and collision-based navigation remain separate engineering or simulation work.

