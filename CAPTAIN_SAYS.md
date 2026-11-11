# Captain Says

Simon Says for everyone aboard, on Leo live. The captain calls a move and the players copy it, but only when the call starts "Captain says". It is ship-wide: anyone aboard can join from wherever they stand, and a crowd sees each other's moves at once (the server relays a change of stance, emote or jump to every page straight away).

## How it plays

- **Joining:** open the Aboard list (the aboard count in the top bar; on a phone it is under More) and press **Play Captain Says**. The same button, or **Leave** on the game's panel, leaves. A player stays joined from one game to the next until they leave.
- **The countdown:** once two have joined, a 10 s countdown opens, and everyone joined when it ends plays. If fewer than two are left when it ends, it waits for a second player again.
- **The calls:** each round the captain calls a stance (**Crouch**, **Lie flat**, **Stand up**), **Jump**, or an emote (**Dance**, **Box**, **Cast a spell**, **Play dead**). Most calls start "Captain says". One round in each four is a trick without it, never the first round of a game. "Stand up!" only follows the captain saying crouch or lie flat, and then comes half the time; the same move is never called twice running.
- **Doing it:** the move's own key (shown beside the call: C, X, Space, or the emote's number as set in Controls), or press the call itself, which does the move for you. On a phone, tapping the call is the quick way, as prone and the emotes have no button of their own.
- **The time:** a bar runs down the time to do it: 4 s in round 1, a quarter of a second less each round, and 1.5 s from round 11 on. There are 2 s between calls. A stance carries over between calls: there is no need to stand up again in between.
- **Out:**
  - On a "Captain says" call, a player is out if they are not doing the move when it is judged. A stance or emote they are already in counts as done. For a jump, they must have jumped since the call.
  - On a trick, a player is out if they made any move since the call: a change of stance (even a moment's crouch), a new emote, or a jump. An emote ending because they walked on is not a move.
- **Winning:** the last one in wins. If everyone left goes out in the same round, they share the win; after 40 rounds, those still in share it.
- **Watching:** players who are out, and anyone who joins once a game has started, watch it to its end on the same panel. The result shows for 10 s, then the next game's countdown opens if two are still joined.
- **Leaving the ship** (closing the tab, or the link dropping) leaves the game. A page whose link comes back joins again, for the next game.

## As built

| Piece | Where | What |
|---|---|---|
| Rules and games | `server/captain-says.mjs` | The pure rules, exported for the checks: `stateOf` (what a pose counts as), `note` (a pose since the call), `judge(call, before, now)`, `pickCall` (the calls and the tricks) and `callMs`. The game itself: who has joined, the countdown, the rounds, the judging, the result. In memory only |
| Server | `server/live-core.mjs`, and its `.authoring`, `.prepared` and `.public` copies | The `cs` message (rate-limited: one a second, four at once), every pose of a joined visitor passed to the game from `readPose`, and leaving the ship leaving the game. `LEO_LIVE_CS_WAIT_S` (10) sets the countdown and the result's time |
| Link | `src/walk/net/live.js` | `live.cs('join' \| 'leave')`, and `on.cs` for the game's messages. Pages and servers without the game ignore its messages |
| Panel | `src/walk/captain-says.js` | The Play/Leave Captain Says button in the Aboard sheet; the panel at the top of the view: the countdown, the call in large letters with its key, a bar running down its time, round and players left, "You're out" with why, the winners. The call is a button that does the move; it never keeps focus, so Space still jumps. If a server never answers a join, the panel says the game isn't on it yet and closes |
| Walk | `src/walk/main.js`, and its `.authoring`, `.prepared` and `.public` copies | The panel wired to Leo live; `captainMove` (the call's button does the move as its key would) and `captainKey` (the key shown beside the call; none on a touch screen) |
| Help | `src/walk/help.js`, `src/walk/help.authoring.js` | A row under "With others aboard" |
| Checks | `scripts/check-captain-says-rules.mjs` (in `npm run check`), `scripts/check-captain-says.mjs` (`npm run check:captain-says`) | The rules alone: every kind of call judged, the calls over 2,000 games, whole games on a stand-in clock (the slack, the grace, a trick, leaving, a shared win, 40 rounds, a thousand players), and the wiring in every copy. Then a real local server, in a temporary folder, with bots sending poses ten times a second through whole games |

## Messages

From a page: `{m: 'cs', e: 'join'}` and `{m: 'cs', e: 'leave'}`.

To joined visitors only, `{m: 'cs', s, ...}`:

| `s` | Fields | When |
|---|---|---|
| `idle` | `n` joined | Waiting for a second player |
| `lobby` | `ms` to the first call, `n` joined | The countdown |
| `call` | round `r`, move `mv`, `cs` (true: "Captain says"; false: a trick), `ms` to do it in, `n` still in of `of`, `you` | Each call |
| `judged` | round `r`, `n` still in, `o` out this round, `you` | Each round judged, unless it ended the game |
| `over` | rounds `r`, `wn` winners, `w` (the first 8 winners' names), `you`, `ms` to the next countdown | The result |

`you` is `in`, `out` or `watch` (joined after the game began), and in `over` it is `won`, `lost` or `watch`. Each message comes in at most three forms, one for each `you`, so a game of a thousand costs the server three strings per message, not a thousand. While waiting, a new count reaches everyone at most once a second; the visitor who joined hears where things stand at once. Moves are `stand`, `crouch`, `prone`, `jump`, `dance`, `box`, `spell` and `play_dead`.

## Timing and fairness

- **Judged from poses.** Pages send a changed pose within a tenth of a second. The server judges each player `JUDGE_SLACK_MS` (400 ms) after the call's time runs out, from the poses it has had, so a pose that left the page in time and was slow on the way still counts.
- **The grace before a call.** A pose arriving within `CALL_GRACE_MS` (250 ms) of the call left its page before the call could have reached it, so it counts as where the player was at the call. Nobody can see a call and react inside that.
- **Poses are trusted**, as everywhere aboard. There is no prize and no leaderboard, so a scripted player wins nothing but a game.

## Left out, for now

- Visitors who have not joined hear nothing of a game (its messages go only to those joined); the Aboard sheet's button is the way in.
- No sound for the calls, and no leaderboard.
