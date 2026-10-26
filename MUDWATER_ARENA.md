# Mudwater Arena

A card-game hall on Deck 16 for Mudwater: Swamp Origins, the trading card game by Bored Ape Yacht Club. It replaces the learning center (the room was `d16-classroom-1`, now `d16-arena-1`), and the learning center is not moved anywhere else. Jay chose the direction on 2026-10-25 from three concepts (a swamp card shack, this tournament hall, and an indoor bayou), took the defaults for the setup questions and approved the blockout before detail.

## What's in it

- **Stage:** 16 × 14 m and 0.45 m high in the middle of the room, black lacquer with a brass fascia and a warm kick light, and a step at each end. Brass rings on the floor around it are ripples on dark water.
- **Board:** a 3 × 3 grid about 11.4 m across, dark felt in a brass frame with stepped corners. Gold rays fan out from the centre square, as on the game's own board.
- **Holograms:** five cards stand on the board over brass emitters, each with four number pips like the game's cards. In the walk they turn slowly and bob.
- **Podiums:** one at each end of the board, with a slanted console and a stool behind it.
- **Spectator tiers:** along both long walls, a bench on the floor and on 0.35 m and 0.7 m tiers, with a walkway behind the top row. You step up at the tier ends.
- **Match tables:** ten black tables with a felt 3 × 3 board, two cream chairs facing across, a rug and a brass pendant. Eight are in the entry half either side of the 4 m main aisle, two by the end wall.
- **Pack counter:** by the door. Its face has brass rays and the name MUDWATER, with packs and sealed boxes on top. Behind it on the wall is a vault: a round brass door between lit shelves of boxes.
- **Match screen:** on the end wall, under the room's name. It shows a board with cards between a teal and an orange score.
- **Card gallery:** 72 framed cards in two rows on the end wall and on the long walls behind the tables, each with a caption strip. The top row has picture lights.
- **Pack standees:** two life-size packs on plinths, either side of the aisle just inside the door.
- **Entrance (walk only):**
  - a brass surround on the door's corridor side;
  - the badge wordmark on the arena's outer wall under its window;
  - a third pack standee facing the door from across the side corridor.
- **Signs:** the Deck 16 lift landings' plaques name **Mudwater Arena** in gold in place of the deck's theme. The Deck 16 stair signs add it beside the deck number, and the lift's buttons read "Deck 16 · Education & recreation · Mudwater Arena" (`signs.js` `FEATURED`).
- **Room:** Bayou walls, an olive-black floor and ceiling, Champagne crown and skirting bands, and Swamp Brass pilasters.

## Brand palette

On 2026-10-25 the room was recoloured from the Mudwater Community Brand Kit, Jay's shared Figma file. Its swatches are in the table below.

| Swatch | Hex | Used for |
|---|---|---|
| Bog | `#000000` | Lacquered black (stage, tiers, tables, counter, vault, podiums), near Bog at `#080806` so it still shades; the board felt |
| Bayou | `#1B1804` | Walls; the floor and ceiling are darker and lighter olive-blacks beside it |
| Champagne | `#AEA35D` | Metal: trim, frames, inlays, the grid lines, the vault door |
| Swamp Brass | gradient | Its deep end (`#6F6630`) on pilasters and stools; its light end as the lit bands on packs and the screen's board |
| Mist | `#DCD7B7` | Seats and cushions, caption strips, and the warm lights |
| Fog | `#6E6C5C` | Darkened (`#3B392F`) for the rugs under the tables |

## Brand art

Also on 2026-10-25, the kit's art was added to the walk. It was captured from the Figma file's public view, since Figma needs an account to export. Jay chose this and also chose to keep the files in this public repository: the same logo, skull and pack art are already public on mudwater.bayc.com, though each kit frame is marked "Confidential and proprietary".

The files are in `src/walk/art/mudwater-*`. Gold-on-black art was cut out with its brightness as transparency; the medallion and coin are masked to circles.

| Art | Where it goes in the walk |
|---|---|
| Badge wordmark (embossed gold) | The end wall over the match screen, replacing the room's name in letters |
| Base wordmark | The pack counter's face, replacing its lettering; and the top of the giveaway card |
| Skull medallion | The vault door, replacing its handle; and glowing in every hologram card |
| Primary skull | Both long faces of each podium |
| Pack | Both faces of each standee, and every pack fanned on the counter |
| Gold coin | In the floor inside the door (upright to someone walking in), and either side of the match screen |
| Rope frame | Round every gallery card |

The ship viewer can't load images, so it shows the room without this art. It does show the standees as black boards.

The card art and box graphics are still **stand-in colour**, because the kit has no card art.

## In the walk

| Where | E does |
|---|---|
| Match screen, or on the board in front of either podium | **Play Mudwater** opens `https://mudwater.bayc.com/game/` in a new tab |
| Pack counter | **Booster packs** shows the giveaway card: packs will be given away here, details coming soon, with a link to the Mudwater site |
| Any bench, table chair or podium stool | Sit down |

## The giveaway

The counter's card claims through Leo live (`server/arena.mjs`, `src/walk/mudwater-giveaway.js`). It is **off until switched on**, and it is switched on by one file on the Leo live server's computer: `leo-live-giveaway.json` beside the checkout (`C:/Users/Rigs/leo-live-giveaway.json` on the Reach PC), or wherever `LEO_LIVE_GIVEAWAY` points. The server reads it again within a couple of seconds of any change, so it needs no restart.

```json
{"open": true, "mode": "codes", "title": "Booster pack giveaway", "note": "One pack per Voyager while they last.",
 "limit": 100, "codes": ["CODE-0001", "CODE-0002"], "formUrl": "https://..."}
```

| Mode | A claim | What the visitor sees |
|---|---|---|
| `codes` | Hands out the next unused code | Their code (with Copy), every time they come back |
| `wallet` | Records one of the wallets The Creamery has verified for them (they pick, if several) | Where their pack will go |
| `list` | Records their name | That they're on the list |
| `form` | Nothing here | A button to `formUrl` (must be https) |

- **Who can claim:** one claim per Discord-verified visitor. Anyone else is offered Connect Discord.
- **Running out:** `limit` caps the claims, and codes also run out with their list. After that the card says all the packs have been claimed.
- **Misconfigured or missing file:** the card stays on "details coming soon".
- **Stopping:** set `"open": false`.
- **The claims file:** claims go to `leo-live-giveaway-claims.json` beside it, with Discord id, name, time, and code or wallet. That's personal data and stays on that computer.

## Counts for BAYC

Leo live counts, per day (UTC), how many times walkers came into the arena (`visits`), how many different visitors that was (`visitors`), Play Mudwater opens (`plays`), giveaway card opens (`cards`) and `claims`. They're kept in `leo-live-arena-stats.json` and served, totals only, at `https://leo-live.marscatsvoyage.com/arena`. Nothing there names or identifies anyone. Visitors are told apart in memory only, so a server restart mid-day can count someone twice.

## As built

| Piece | Where | What |
|---|---|---|
| Room | `src/mudwater-arena.js` | Builds the fittings and turns the shell dark, called from the `arena` case in `src/areas.js`. Exports the layout (stage, tables, podiums, counter) and the walk's trigger points |
| Ship areas | `src/areas.js`, `src/area-finish.js` | Deck 16's first room is now `['arena','Mudwater Arena']` with its description. Its finish is `games`: brass lines on every `Mudwater_grid` |
| Walk | `src/walk/mudwater.js`, `src/walk/main.js`, `src/walk/walk.html` | The holograms leave the room for their own group before the merge, so they can turn. Adds the brand art panels (loaded within 45 m), the triggers, the use actions and the `#mudwater-sheet` card |
| Page build | `scripts/walk-page.mjs` | Hashes `MUDWATER_ART` with the paintings and comics, keeping each file's own extension (PNG for transparency) |
| Signs and places | `src/walk/signs.js`, `src/walk/lift-ride.js`, `src/walk/places.js` | A cards icon on the corridor signs; Mudwater Arena on the Deck 16 plaques, stair signs and lift buttons; and in Go to |
| Giveaway and counts | `server/arena.mjs`, `server/leo-live.mjs`, `src/walk/net/live.js`, `src/walk/mudwater-giveaway.js` | The `giveaway`, `claim` and `arena` messages (no protocol change: an older server just never answers, and the card stays on "coming soon"), and `GET /arena` |
| Checks | `scripts/check-mudwater.mjs` and `scripts/check-giveaway.mjs` (both in `npm run check`), `scripts/check-areas.mjs` | See below; the giveaway check runs every mode, refusal and limit on temporary files |

The `scripts/check-mudwater.mjs` check covers:

- the pieces are all there, inside the room and under the ceiling;
- every rise is within the 0.4 m step;
- there are 130 seats, all facing away from their backs, with the tiers facing the stage;
- each trigger stands clear of the walk's collision triangles;
- every brand art file exists and is under 400 kB, and the pack standees are clear of the aisle;
- the triangle budget holds.

## Budget

The room is 43.0k triangles including the shell and finishing passes (the brand art adds a few hundred more in the walk), against 36.9k for the learning center: about +6k, inside the agreed +20k.

## Lighting note

Walk mode lights rooms with a bright environment. Glossy dark surfaces wash out to grey there, and the polish pass (`interior-polish.js`) resets the roughness of materials named for linings and stone. So the arena's darks are matte and named to stay out of that pass. For the same reason the coins are fully matte: the floor coin turned silver while it was glossy.

## Art depth note

The walk's bake (`render-bake.js`) steps parts whose faces coincide a few millimetres apart, one layer each, to stop flicker. The gallery's ten merged card-art colours all overlap, so some card art ends up well in front of its nominal face. The rope frames therefore sit 7 cm out; at 4 cm, half of them were hidden.
