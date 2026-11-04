# Deck 17 ball bounce

The existing ridden player ball gently rebounds from firm side impacts on Deck 17. Other decks and visitors on foot keep their existing wall slide. This adds no second ball or shared parked object.

`src/walk/ball-bounce.js` holds the tuning: 35% of the incoming normal speed is reflected, total rebound speed is capped at 2.4 m/s, and steering resumes after a 0.18 s recoil with exponential damping at 6 per second. Contacts below 0.8 m/s slide without recoil. Ground and ramp corrections add no bounce, and there is no upward kick. The existing 2.2 m visible diameter, 0.8 m collision radius, 8/12 m/s travel and single low hop remain unchanged.

Dismount stops all motion and checks a short, supported path clear of the parked shell. If there is no clear way off, Cosmo stays at the current position and the ball returns to its garden home. Go to and Respawn still leave ball mode. Lift and action-button priority stays the same.

The two controller copies and four walk entry points use the same opt-in policy. Geometry, dependencies, multiplayer messages and the live layout identity inputs are unchanged; this requires no protocol migration.

Run `node scripts/check-ball-bounce.mjs` for the focused native collision and dismount checks. The full build, public-room browser checks, stairs/lift ride verification and visual judgement of the bounce remain part of the separate combined validation.
