# Cosmo's figure, from Voyager's Reach

These files are Voyager's Reach's own Cosmo animation (packages/client/src/play, commit a2f0a8eb): the DL Cat figure
solver with its authored Ecctrl walk and jog, the reference sprint, jump, landing, turning lean, tail spring, idle,
crouch, slide, emotes and seated poses. They are copied unchanged except:

- `@reach/world-core` imports point at `worldCore.ts` (the three speeds and gravity the figure reads);
- the art-style imports point at `style.ts` (Leo has only the plain style);
- `cosmoEmotes.ts` fetches its clips from `globalThis.LEO_COSMO_EMOTES` when set;
- the two loaders at the end of `dlCatFigure.ts` (which fetch Voyager's Reach's own copy of the rig) are left out: Leo
  builds the figure from the Cosmo bundle (`../avatar.js`).

`dlCatFigure.ts` also carries Voyager's Reach's later tail fix (commit 959ac8ff, 2026-10-22): the reference run keeps
the tail's upright resting curl and the spring adds sway and inertia after it, and in the air the tail trails the body's
vertical travel. It no longer skips `neutral_bone` when an emote finds the floor (the pockets moved off it: see
`../../vendor/cosmo/README.md`).

Refresh them by copying the same files again and reapplying those edits. The clips are CC0, from the Quaternius
Universal Animation Library.
