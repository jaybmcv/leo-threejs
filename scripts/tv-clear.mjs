// node scripts/tv-clear.mjs ["why"]: takes the Crown lounge TV's video down (server/tv.mjs). Run it on the computer Leo
// live runs on: it creates the clear file beside the checkout (or LEO_LIVE_TV_CLEAR), and the running server blanks the
// screen for everyone within a couple of seconds, deletes the video, logs it with the note given, and removes the file.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const file=process.env.LEO_LIVE_TV_CLEAR||fileURLToPath(new URL('../../leo-live-tv-clear',import.meta.url));
fs.writeFileSync(file,(process.argv.slice(2).join(' ')||'taken down by hand')+'\n');
console.log(`Asked Leo live to take the TV's video down (${file}). The server log says "tv taken down" once it has.`);
