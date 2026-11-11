# Graffiti wall acceptance record (Deck 19 fin root casing)

Verification of the existing wall from #220 (casing from #138). No feature, geometry, authentication or hosting change. Live observations and isolated tests are kept apart, and a check with no evidence is outstanding, not passed. Source inspection is not acceptance.

## Revisions and environments

| Item | Value |
| --- | --- |
| Source inspected | `main` at de3ee1de; the files below are unchanged since e3b7dbb6 (client `src/walk/graffiti.js`, `src/walk/graffiti-wall.js`, `src/walk/fin-casing.js`; server `server/graffiti.mjs`) |
| Feature commits | 29a7af4b (wall), a93a6a9d (bar fit, no text selection) |
| Live client / server revision | Not observed in this pass: no live visit was made. Record it (page build and `/health` layout identity) when the live checks below are run. |
| Isolated server | `server/leo-live.mjs` on a loopback port, `LEO_LAYOUT=2`, every state file (wall, clear trigger, scores, chat, TV…) in a temp folder, passes signed by a throwaway local key. Never the live server or its wall. |

## Retained feature in the current layout 2 plan (source inspection only)

- `src/walk/fin-casing.js` builds `Walk_fin_root_casing` on Deck 19 (Y 32.3–36.05, forward face at x -130.75, 1.8 m wide, flat, own 0–1 UVs, lit by a wash strip). It says the exterior is untouched. It exports `userData.paintFace`.
- Every walk entry (`main.js`, `.public.js`, `.prepared.js`, `.authoring.js`) creates the wall from that face (`createGraffiti`) and drives E and the spray bar. The tracked `goto` is `graffiti` ("Graffiti wall", Deck 19, `[-129.5, deck y, 0]`, `src/v2/goto-features.js`).
- Not confirmed here: how the casing looks and that circulation and silhouette are unchanged. These need the built walk (`npm run check:walk`) and a visit to the tester's view, `walk.html?at=-130.25,32.30,1.70&yaw=632&pitch=-10`.

## Checks

Status: PASS = evidence recorded; OUTSTANDING = no evidence yet.

| # | Behaviour | Environment | Status |
| --- | --- | --- | --- |
| 1 | Casing has a flat, lit painting face; circulation kept; exterior silhouette and viewer unchanged | Built walk | OUTSTANDING (build, `check:walk`, screenshots run separately) |
| 2 | Two real Discord-verified sessions on the live version: colour selection, aimed spraying, overlapping paint, immediate shared updates | Live | OUTSTANDING (needs two real verified visitors) |
| 3 | Guests can view but not paint, and are told to sign in | Live | OUTSTANDING (live). Server refusal is covered by `scripts/check-graffiti-live.mjs` (isolated) |
| 4 | Server refuses guest strokes, ignores malformed strokes, rate-limits floods | Isolated | Script written; not yet run, see Isolated run |
| 5 | Painters attributed in server logs without personal identifiers in this record | Isolated | Same script; ids shown only as `<id>` |
| 6 | Paint survives reconnects and later visits | Live and isolated | Isolated restart covered by the script. Live reconnect/later-visit: OUTSTANDING |
| 7 | Restart persistence; authenticated admin clear (trigger file) | Isolated only | Same script. Never clear the live wall |
| 8 | Bounded storage in the existing file store; no automatic wiping | Isolated | Same script (file size constant, 120 × 224 grid). No code path wipes except the admin clear |

## Isolated run

Command: `node scripts/check-graffiti-live.mjs` (Node v26.11.1, Windows). It starts its own server (`server/leo-live.mjs`, `LEO_LAYOUT=2`) and needs the built ship layout (`output/leo-interior-v02/layout.json`).

Attempt 1 (feature worktree at de3ee1de, 2026-11-11): **not executed.** The worktree holds no built layout 2 ship (`output/leo-interior-v02` is empty), so the server exits at start-up with `ENOENT … layout.json`. No check ran; nothing here is a pass or a product failure. The geometry build that produces the ship runs in a separate copy outside this change. The script now says so up front (exit code 2) and prints the server revision beside the layout identity.

To complete: in a checkout holding the built ship, run the command, then paste here the PASS lines, the `server layout 2 identity … revision …` line and the client commit. Isolated results stay in this section; live observations go in their own section.

Live observations: none made. No two verified live sessions were available to this pass; no authentication was bypassed and no simulated identity stands in for them.

## Remaining gaps

- Checks 4, 5, 7, 8 and the isolated halves of 3 and 6: the script has not yet been executed; it needs a built ship (above).
- Checks 1, 2, 3 (live), 6 (live) and the real-finger touch case from #220 need a built ship, two real Discord-verified visitors and the live version. Until then, acceptance is not claimed for either stage.
- Two painters on the same cells in the same tenth of a second can briefly differ until each reloads the wall (known, from #220).
