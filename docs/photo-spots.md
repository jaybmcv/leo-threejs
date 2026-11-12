# Scenic photo spots

Three photo spots on the layout 2 walk, from tester feedback. Each spot has a floor marker (a navy disc in an orange ring with a camera and PHOTO SPOT) and a small orange camera badge 2.6 m above it. Standing within 1.6 m of the marker's centre shows the prompt **E · Take a photo · *spot name***. E opens the spot's sheet with **Start 5-second countdown** focused, so Enter (or a click) starts it. The countdown, capture, Mars Cats Voyage frame, name tags and photo sheet are the crown lounge selfie camera's own (`src/walk/selfie.js` `frame()`, `takePhoto()` in each `src/walk/main*.js`). The spot's name goes under the photo, and the file is saved as `leo-<spot id>-<time>.jpg`. Escape closes the photo sheet and hands the walk back.

The spots are defined in `src/walk/photo-spots.js` in their room's frame (`src/plan/rooms.js` `toWorld`). Each camera is the visitor's own: there's no shared countdown and no server message. The crown lounge's group-photo booth, its backdrops, its camera angles and its shared countdown are unchanged. While a spot counts down, every other visitor in range is drawn, as for the booth (`remotes.update(..., {photo})`). Their name tags go into the photo through the booth's path.

The markers and badges are drawn only. They have no colliders and are hidden while a photo is drawn. The positions were checked on the live plan (`output/leo-interior-v02/layout.json`, c1f0cca) by sampling the walk's colliders: each marker has clear floor at least 0.8 m round its centre, and the line from the lens to the cat is unobstructed.

Ship metres: x forward, y up, z starboard. Walk yaw 0 faces +Z and 90 faces +X. A negative pitch looks down.

| Spot (id) | Deck · room | Landmark | Marker centre (feet) | Camera (lens) | Camera aims at | Lens yaw / pitch |
|---|---|---|---|---|---|---|
| Crown lounge windows (`crown-windows`) | Fin crown · `crown` | The nose's forward panoramic windows, with Mars and stars beyond | -198, 120.3, 0 | -203.8, 121.45, 0 | -196, 121.75, 0 | 90° / +2.2° |
| The Great Cat Tree (`cat-tree`) | Deck 6 · `circulation-6` (Toybox Park on the atrium nose floor) | The Great Cat Tree's trunk, ramp, platforms and island, from its approach path from the lift tower | 171, -19.7, -2.2 | 165.6, -18.4, -0.4 | 176, -16.6, -1.5 | 96° / +9.8° |
| Hydro-Nip aquarium (`aquarium`) | Deck 17 · `commons-1` (Hydro-Nip Lounge) | The aquarium's front glass: rock pillars, reef, the octopus and the treasure chest | -103.5, 24.3, -30 | -103.4, 25.85, -35.4 | -103.5, 25.65, -28 | 359.2° / -1.5° |

Clearances:

- **Crown lounge windows.** The marker is on the clear floor of the nose, 5.7 m from the nearest furniture and 5.8 m aft of the nose glass. The lens is between the two forward seating groups (x -204, z ±5.4). The aisle along the centreline, the lift, the bar and the window promenades stay open.
- **The Great Cat Tree.** The marker is on the port edge of the felt path from the lift tower to the tree's ring, forward of the Toybox Park sign. It is 4.2 m from the nearest solid and off the island, the boardwalk and the den entrance. The lens is past the park sign, so the sign stays out of the photo.
- **Hydro-Nip aquarium.** The marker is 2 m in front of the aquarium glass. It is clear of the hammock dome and the jaguar throat aft of it, and 2 m aft of the end of the Munchies Converger's counter, so the counter stays clear. The arcade, the Haze Maze and the dome's way in are untouched.

Walk links (open on the walk page; the first stands on the marker facing the camera, the second stands at the lens facing the marker):

- Crown lounge windows: `walk.html?at=-198,120.3,0&yaw=270&pitch=0` · `walk.html?at=-203.8,120.3,0&yaw=90&pitch=-10`
- The Great Cat Tree: `walk.html?at=171,-19.7,-2.2&yaw=288&pitch=0` · `walk.html?at=165.6,-19.7,-0.4&yaw=108&pitch=-5`
- Hydro-Nip aquarium: `walk.html?at=-103.5,24.3,-30&yaw=179&pitch=0` · `walk.html?at=-103.4,24.3,-35.4&yaw=359&pitch=-8`

The original booth is still the crown lounge's group-photo camera at x -263.5 (`walk.html?at=-261.75,120.3,0&yaw=270`).
