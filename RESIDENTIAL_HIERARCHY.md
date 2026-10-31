# Residential hierarchy proposal

## Layout 2 — takes effect at cutover

Until cutover, the canonical live site and the historical build notes below describe layout 1. Layout 2 is selected with `LEO_LAYOUT=2` at build time and writes only `output/leo-interior-v02` and `dist-v2`; URL parameters cannot switch worlds. These v2 sections take precedence for the redesigned ship after cutover. This work does not deploy or approve a release.

The accepted v2 physical allocation below supersedes the September proposal for 5,214 rooms. The proposal is retained as history; it is not the current v2 capacity target. Labels, individual assignments and legacy-link joins must use the v2 plan and its `cabinIdMap`, without deriving cabin identity from list order.

| Deck | Neighborhood | Twin cabins | Single cabins | Total cabins | Berths |
|---|---:|---:|---:|---:|---:|
| 6 | 1 | 534 | 0 | 534 | 1068 |
| 7 | 2 | 521 | 0 | 521 | 1042 |
| 8 | 3 | 521 | 0 | 521 | 1042 |
| 9 | 4 | 515 | 0 | 515 | 1030 |
| 10 | 5 | 512 | 0 | 512 | 1024 |
| 11 | 6 | 505 | 0 | 505 | 1010 |
| 12 | 7 | 484 | 0 | 484 | 968 |
| 13 | 8 | 486 | 0 | 486 | 972 |
| 14 | 9 | 477 | 0 | 477 | 954 |
| 15 | 10 | 417 | 56 | 473 | 890 |
| **Total** | | **4,972** | **56** | **5,028** | **10,000** |

The accepted source of truth is [the v2 plan](src/plan/README-v2.md), [the selected walk](src/plan/README-phase2.md) and [recorded decisions](src/plan/decisions-v2.json).

All singles are on Deck 15. This schedule preserves exactly 10,000 modeled berths and all 5,000 legacy cabin ids through the explicit mapping. It is a spatial design concept and does not certify engineering or occupancy.

## Layout 1 reference and history

Design proposal dated 2026-09-23. These room counts are not yet implemented in the Three.js model. The current model still has 500 twin cabins on each of Decks 6–15.

The proposed allocation places cats 3,334–10,000 on Decks 6–10 and cats 1–3,333 on Decks 11–15, with progressively better accommodations on higher decks. Maximum occupancy is two cats per room. Tier names are working design labels, not established lore. Individual assignment within each group remains undecided.

| Deck | Working tier | Twin rooms | Single rooms | Total rooms | Residents |
|---|---|---:|---:|---:|---:|
| 6 | Standard | 700 | 0 | 700 | 1,400 |
| 7 | Standard Plus | 690 | 0 | 690 | 1,380 |
| 8 | Comfort | 675 | 0 | 675 | 1,350 |
| 9 | Comfort Plus | 660 | 0 | 660 | 1,320 |
| 10 | Premium Standard | 608 | 1 | 609 | 1,217 |
| **Lower group** | | **3,333** | **1** | **3,334** | **6,667** |
| 11 | Superior | 480 | 0 | 480 | 960 |
| 12 | Superior Plus | 440 | 0 | 440 | 880 |
| 13 | Prestige | 300 | 80 | 380 | 680 |
| 14 | Grand | 200 | 130 | 330 | 530 |
| 15 | Crown | 33 | 217 | 250 | 283 |
| **Upper group** | | **1,453** | **427** | **1,880** | **3,333** |
| **Total** | | **4,786** | **428** | **5,214** | **10,000** |

## Design direction

- Establish a clear quality step between Decks 10 and 11 through sleeping separation, seating, bathrooms and finishes.
- Progress from compact twins to shared suites, private studios and large private apartments.
- Make the 33 twin apartments on Deck 15 its largest accommodations.
- Improve window frontage where the hull and room placement allow it; perimeter glazing does not guarantee every room a private view.
- Retain the distinctive nose commons, circulation and accepted exterior shape when testing layouts.

## Fit work still required

The existing cabins provide 24 square metres of clear interior area each. Distributing the same 12,000-square-metre cabin allocation across 700 rooms would yield about 17.1 square metres per room, before revisiting walls, circulation and bathrooms. Large upper-deck apartments may need additional residential floor area.

First prototype Decks 6, 11 and 15 to establish the densest layout, the class boundary and the most spacious tier. Validate hull fit, corridors, entries, room dimensions and population totals before implementing intermediate decks. These counts are a design target, not a validated capacity or engineering certification.
