# Emergency Drill

One solo practice flight is available at the helm of Deck 4 escape shuttle
`d4-escape-s-9` (starboard, forward bank). Use the red **Emergency Drill** button
from the aisle with E / the touch Use button, then choose **Start drill**.
The two-second separation animation is drawn in the game overlay; it does not
move the actual ship or its passengers.

Steer with WASD, arrow keys or the four on-screen buttons. Meteors approach from
the planet, getting faster and more frequent over the 60-second flight. Each
meteor removes 10 of the initial 100 hull points. Ten hits explode the craft and
show Mission Failed. Reaching the atmosphere at 60 seconds completes the run.
Pause with P or Pause; changing tabs also pauses. Esc or Return to Leo closes the
drill and restores walking at the same helm. Abandoned and failed runs do not
save a landing score.

Iron scores 25, titanium 150 and platinum 500. The final landing score is metals
plus **100 points per remaining hull percent** (up to 10,000 hull points).
The personal best uses `leo-emergency-drill-best-v1` in localStorage. It stays in
this browser; blocked storage falls back to a best for the current visit.
No server, new dependency, shared scores, badges, shields or multipliers are
part of this first drill. Metals are score pickups only.

The four non-colliding stand/button/sign parts are in
`src/plan/room-fitout-overrides-v2.json`, in the craft's local frame. The mount is
0.13 × 0.86 × 0.82 m; the red button is 0.42 m across and 0.16 m deep. It stands
alongside the helm without moving seats or narrowing an aisle. Craft overrides
allow added non-seat fittings only; ordinary room overrides retain their behavior.
The interaction reads that same fitting descriptor and rotates it with the craft.
All four main walk variants include the entry point and suspend walk controls
while the overlay is open.

Run `node scripts/check-emergency-drill.mjs` for focused rules and fitting checks.
The full geometry/public build, walk flood and in-ship browser review remain
separate validation steps. The ownership inventory also registers the existing
Arrival lighting and conservatory factory boundaries so it can regenerate cleanly.
