# Deck 4 shared lever panel

The existing panel and combination are unchanged. Leo live now owns its five lever positions, opening progress and one visitor reservation. All walk and server source variants use the same rules. The room contents and map are unchanged.

The retained panel face is at X -175.2, floor Y -27.7, centred on Z 0. It spans 7.88 m and is 3.66 m high. Lever centres are spaced 0.4 m apart. Interactions require a position on this floor within 1.8 m of the front, and the requested lever must be the nearest one.

After the panel sinks, the first reported approach within 1.4 m of the face reserves entry. Waiting visitors have a collision gate 0.8 m in front of the face, within lever reach and clear of the moving panel. Only the reserved visitor can enter. Once they are inside and the doorway is clear, the panel rises in 0.35 s and resets its levers, retaining the reservation. No visible clue or new room content is added.

The inside release opens an exit regardless of ownership. Exit, leaving the floor or disconnect releases the room. A reservation abandoned before entry expires after 20 s. An admitted visitor's valid inside poses renew a five-minute recovery deadline; a stale owner eventually releases without requiring a restart. Positions silent for five minutes also stop holding the doorway open. The 20 s open-door timer cannot close the panel on a recent reported body. Local doorway clearance covers the interval before the next pose reaches the server. The clearance interval is X -175.85 to -174.75, with |Z| below 2.45 m on this floor.

With a live URL configured, the exterior puzzle waits for the shared server state and does not solve locally during an outage. A visitor already inside can still open the local exit. Reconnecting receives the current snapshot. With no live URL configured, the existing solo puzzle remains available. Like other movement aboard, client poses are trusted: this is a puzzle, not an access-security mechanism.

This needs a matching client build and manual Leo live server update. The protocol identity includes the panel rules and authority module, so an earlier server is rejected. No hosting or server administration is performed by this change. No new dependency or stored data is required; restarting the server resets the puzzle.

Run `node scripts/check-lever-panel.mjs` for focused authority and client-collider checks. `npm run check:live` also runs this check, then its existing live suites. The spatial suite includes two guest connections solving, observing the same levers and door, racing admission, clearing the doorway, using the exit, joining an occupied room and releasing on disconnect. That suite requires a generated v2 layout. Browser and full walk validation still use the built ship.
