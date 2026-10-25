# Mudwater Arena

A card-game hall on Deck 16 for Mudwater: Swamp Origins, the trading card game by Bored Ape Yacht Club. It replaces the learning center (the room was `d16-classroom-1`, now `d16-arena-1`), and the learning center is not moved anywhere else. Jay chose the direction on 2026-10-25 from three concepts (a swamp card shack, this tournament hall, and an indoor bayou), took the defaults for the setup questions and approved the blockout before detail.

## What's in it

- **Stage:** 16 × 14 m and 0.45 m high in the middle of the room, black lacquer with a brass fascia and a warm kick light, and a step at each end. Brass rings on the floor around it are ripples on dark water.
- **Board:** a 3 × 3 grid about 11.4 m across, dark felt in a brass frame with stepped corners. Gold rays fan out from the centre square, as on the game's own board.
- **Holograms:** five cards stand on the board over brass emitters, each with four number pips like the game's cards. In the walk they turn slowly and bob.
- **Podiums:** one at each end of the board, with a slanted console and a stool behind it.
- **Spectator tiers:** along both long walls, a bench on the floor and on 0.35 m and 0.7 m tiers, with a walkway behind the top row. You step up at the tier ends.
- **Match tables:** ten black tables with a felt 3 × 3 board, two cream chairs facing across, a green rug and a brass pendant. Eight are in the entry half either side of the 4 m main aisle, two by the end wall.
- **Pack counter:** by the door. Its face has brass rays and the name MUDWATER, with packs and sealed boxes on top. Behind it on the wall is a vault: a round brass door between lit shelves of boxes.
- **Match screen:** on the end wall, under the room's name. It shows a board with cards between a teal and an orange score.
- **Card gallery:** 72 framed cards in two rows on the end wall and on the long walls behind the tables, each with a caption strip. The top row has picture lights.
- **Room:** charcoal walls, a dark floor and ceiling, brass crown and skirting bands, and brass pilasters.

The card art and box graphics are **stand-in colour**. The ape-skull logo and real card art stay out until BAYC supplies files and approves their use. "MUDWATER" appears only as plain text.

## In the walk

| Where | E does |
|---|---|
| Match screen, or on the board in front of either podium | **Play Mudwater** opens `https://mudwater.bayc.com/game/` in a new tab |
| Pack counter | **Booster packs** shows the giveaway card: packs will be given away here, details coming soon, with a link to the Mudwater site |
| Any bench, table chair or podium stool | Sit down |

The giveaway card is a placeholder until the real mechanism (codes, wallet claim or a form) is decided.

## As built

| Piece | Where | What |
|---|---|---|
| Room | `src/mudwater-arena.js` | Builds the fittings and turns the shell dark, called from the `arena` case in `src/areas.js`. Exports the layout (stage, tables, podiums, counter) and the walk's trigger points |
| Ship areas | `src/areas.js`, `src/area-finish.js` | Deck 16's first room is now `['arena','Mudwater Arena']` with its description. Its finish is `games`: brass lines on every `Mudwater_grid` |
| Walk | `src/walk/mudwater.js`, `src/walk/main.js`, `src/walk/walk.html` | The holograms leave the room for their own group before the merge, so they can turn. Adds the triggers, the use actions and the `#mudwater-sheet` card |
| Signs and places | `src/walk/signs.js`, `src/walk/places.js` | A cards icon on the corridor signs, and Mudwater Arena in Go to |
| Checks | `scripts/check-mudwater.mjs` (in `npm run check`), `scripts/check-areas.mjs` | See below |

The `scripts/check-mudwater.mjs` check covers:

- the pieces are all there, inside the room and under the ceiling;
- every rise is within the 0.4 m step;
- there are 130 seats, all facing away from their backs, with the tiers facing the stage;
- each trigger stands clear of the walk's collision triangles;
- the triangle budget holds.

## Budget

The room is 42.9k triangles including the shell and finishing passes, against 36.9k for the learning center: about +6k, inside the agreed +20k.

## Lighting note

Walk mode lights rooms with a bright environment. Glossy dark surfaces wash out to grey there, and the polish pass (`interior-polish.js`) resets the roughness of materials named for linings and stone. So the arena's darks are matte and named to stay out of that pass.
