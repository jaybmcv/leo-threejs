# Hydro-Nip Lounge (feedback-inbox #58)

A catnip lounge in Neighborhood 1's garden commons (Deck 17, the port commons of the pair nearest the fin). Concept by Tochtli (Discord tochtli_13), from a render by their designer. The render is a reference for layout and mood only: no artwork, sign lettering or characters are copied from it.

## Decisions (Jay, 2026-10-23)

- **Theme:** catnip, not cannabis. No smoking, bongs or "hotbox". The mist in the maze is catnip mist. Names kept: the Hydro-Nip Lounge, the Terpene Tasting Deck (catnip's nepetalactone is a terpene), the Haze Maze, the Cosmic Munchies Converger, the Anti-Gravity Geodesic Hammock Dome.
- **Place:** one commons only, Neighborhood 1 (`createGardenCommons(1)`). The other nine stay gardens.
- **Built into the model:** shows in the viewer, the walk and the downloads.
- **Style:** Leo's stylised low-poly. Neon is glowing materials plus glow sprites; no real lights (the walk has no bloom or point lights).
- **Kept:** galleries, stairs, columns, the shared-services strip (laundry, lockers, kitchen island, reading shelves), and the room's walls and circulation.
- **Replaced:** the garden middle (planters, trees, café counter and tables) and the commons' cat figures. The render's characters are not modelled.
- **Phase 1** is decoration only. The dome and maze are sealed glass you can see into. Seats use the existing sit action. Phase 2 makes the maze and dome walkable; phase 3 adds doors that slide open as you approach and lying in the hammocks.
- **Budget:** at most +60k triangles and about 25 draw calls, drawn only near the room.
- **Credit:** a plaque by the entrance ("Hydro-Nip Lounge concept by Tochtli") and a README line.
- **Gate:** plan and blockout approved before any detail.

## Coordinates

The lounge is built in the commons template's own frame (the Neighborhood 10 commons: x 109.5–154.5, z 8–46, floor 24.3, ceiling 35.65, galleries at 28.3 and 32.3). `createGardenCommons` moves it to Neighborhood 1: world x = template x − 224, world z = −(template z), which mirrors it across the ship's centreline. Text is flipped back locally so it reads correctly.

Open floor for the lounge: x 113.5–148, z 12–42. The entrance side is z ≈ 8–12, facing the ship's centre.

## Layout (blockout)

| Zone | Template position |
|---|---|
| Haze Maze tower (glass, three storeys) | x 114–120.5, z 19–33, y 24.3–35.2 |
| Terpene Tasting Deck (bar along z) | counter x 122.6–123.6, z 21–30 |
| Anti-Gravity Geodesic Hammock Dome | centre (134, 25), radius 6.5 |
| Cosmic Munchies Converger | counter around (144.5, 25); machine hung from the ceiling above |
| Hydro-Nip sign | on the dome's crown, facing the entrance, y 30.9–33.1 (hung at the dome's front it blocked the upper gallery's view) |
| Lounge rugs and beanbags | x 122–146, z 12.5–17.5 |
| Credit plaque | (117.5, 12.6), facing the entrance |
