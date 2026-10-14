// Cosmo's emotes. The clips are CC0, from the Quaternius Universal Animation
// Library (scripts/extract-cosmo-emotes.py), and play through the same donor
// skeleton and retarget as Cosmo's walk (ecctrlLocomotion.ts). An emote is an
// optional run-in played once, then a loop — or, with no loop, the last frame
// of its run-in held, as a body playing dead stays down.
//
// Only this list is offered on the wheel, and only these names are relayed by
// the authority (world-core POSE_EMOTES must match it, which a test checks).

import type { EmoteAnimationData } from "./ecctrlLocomotion.js";

export interface EmoteSpec {
  intro?: readonly string[];
  loop?: readonly string[];
}

export const COSMO_EMOTES: Readonly<Record<string, EmoteSpec>> = {
  dance: { loop: ["Dance_Loop"] },
  talk: { loop: ["Idle_Talking_Loop"] },
  spell: { intro: ["Spell_Simple_Enter"], loop: ["Spell_Simple_Idle_Loop", "Spell_Simple_Shoot"] },
  slash: { loop: ["Sword_Attack"] },
  box: { intro: ["Punch_Enter"], loop: ["Punch_Jab", "Punch_Cross"] },
  push: { loop: ["Push_Loop"] },
  fix: { loop: ["Fixing_Kneeling"] },
  pick_up: { loop: ["PickUp_Table"] },
  interact: { loop: ["Interact"] },
  play_dead: { intro: ["Death01"] },
};

// clips joined end to end blend across this long; a clip following itself
// is a seamless loop and does not
export const EMOTE_CROSSFADE_S = 0.15;

export interface EmotePart {
  clip: string;
  time: number;
  weight: number;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

// Which clips an emote is showing `t` seconds in, and how much of each: one
// clip, or two across a join, their weights summing to one. Empty if a clip
// has no length (not loaded).
export function emoteParts(spec: EmoteSpec, duration: (clip: string) => number, t: number): EmotePart[] {
  const intro = spec.intro ?? [];
  const loop = spec.loop ?? [];
  const all = [...intro, ...loop];
  if (!all.length || all.some((clip) => !(duration(clip) > 0))) return [];
  const at = (i: number) => (i < intro.length ? intro[i]! : loop[(i - intro.length) % loop.length]!);
  const introLength = intro.reduce((sum, clip) => sum + duration(clip), 0);
  if (t >= introLength && !loop.length) {
    const last = intro[intro.length - 1]!;
    return [{ clip: last, time: duration(last), weight: 1 }];
  }
  let start = 0;
  let i = 0;
  if (t >= introLength) {
    // whole turns of the loop at once, however long the emote has run
    const cycle = loop.reduce((sum, clip) => sum + duration(clip), 0);
    const turns = Math.floor((t - introLength) / cycle);
    start = introLength + turns * cycle;
    i = intro.length + turns * loop.length;
  }
  while (t >= start + duration(at(i))) start += duration(at(i++));
  const clip = at(i);
  const local = t - start;
  const previous = i > 0 ? at(i - 1) : null;
  if (!previous || previous === clip || local >= EMOTE_CROSSFADE_S) return [{ clip, time: local, weight: 1 }];
  const k = smooth(local / EMOTE_CROSSFADE_S);
  return [
    { clip: previous, time: duration(previous), weight: 1 - k },
    { clip, time: local, weight: k },
  ];
}

// Fetched the first time anyone near emotes, once for every figure.
let data: Promise<EmoteAnimationData | null> | undefined;
export function loadCosmoEmoteData(): Promise<EmoteAnimationData | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return (data ??= fetch((globalThis as {LEO_COSMO_EMOTES?:string}).LEO_COSMO_EMOTES ?? "/animations/cosmo-emotes.json")
    .then((r) => {
      if (!r.ok) throw new Error(`emote clips: HTTP ${r.status}`);
      return r.json() as Promise<EmoteAnimationData>;
    })
    .catch((error) => {
      // An emote is cosmetic: without its clips the body just stands.
      console.warn("Cosmo emote clips unavailable; emotes will not play.", error);
      return null;
    }));
}
