# Cosmo's figure, from Voyager's Reach

These files are Voyager's Reach's own Cosmo animation (packages/client/src/play, commit a2f0a8eb): the DL Cat figure
solver with its authored Ecctrl walk and jog, the reference sprint, jump, landing, turning lean, tail spring, idle,
crouch, slide, emotes and seated poses. They are copied unchanged except:

- `@reach/world-core` imports point at `worldCore.ts` (the three speeds and gravity the figure reads);
- the art-style imports point at `style.ts` (Leo has only the plain style);
- `cosmoEmotes.ts` fetches its clips from `globalThis.LEO_COSMO_EMOTES` when set;
- the two loaders at the end of `dlCatFigure.ts` (which fetch Voyager's Reach's own copy of the rig) are left out: Leo
  builds the figure from the Cosmo bundle (`../avatar.js`);
- `ecctrlLocomotion.ts` `apply` returns before posing the donor when its weight is zero (standing, crouched, in the
  air): nothing reads that pose, and the flight it gave was multiplied by the zero weight. Every other visitor standing
  in view solved it (`scripts/check-visitor-bones.mjs` drives the real rig through it);
- a solve does less of the same arithmetic (about a quarter less time, bit for bit the same pose; each edit is marked
  `(Leo)` in the file):
  - `dlCatFigure.ts` `apply` no longer remakes the whole tree after putting the bones back to rest: `lazyWorld.ts`
    `invalidate()` lets each read remake its own path. Before the probes it refreshes the bones only
    (`lazyWorld.ts` `refresh`), not the meshes. It no longer rebuilds the bone textures there or after the foot lift;
    the refresh at the end still does.
  - Its per-bone loops index arrays made once (`boneList`, `restList`, `prevList`, `animList`) instead of hashing names.
  - `lazyWorld.ts` keeps its times on the objects, valid per epoch, instead of in maps it cleared on every settle.
  - `ecctrlLocomotion.ts` reads the donor's feet from the matrices it has just refreshed, and `retarget` reuses
    scratch quaternions.

`dlCatFigure.ts` also carries Voyager's Reach's later tail fix (commit 959ac8ff, 2026-10-22): the reference run keeps
the tail's upright resting curl and the spring adds sway and inertia after it, and in the air the tail trails the body's
vertical travel. It no longer skips `neutral_bone` when an emote finds the floor (the pockets moved off it: see
`../../vendor/cosmo/README.md`).

Refresh them by copying the same files again and reapplying those edits. The clips are CC0, from the Quaternius
Universal Animation Library.
