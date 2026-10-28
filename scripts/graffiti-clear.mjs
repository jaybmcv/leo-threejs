// node scripts/graffiti-clear.mjs ["why"]: the Deck 19 graffiti wall's admin clear (server/graffiti.mjs). Run it on the
// computer Leo live runs on: it creates the clear file beside the checkout (or LEO_LIVE_GRAFFITI_CLEAR), and the running
// server wipes the wall for everyone within a couple of seconds, logs it with the note given, and removes the file.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const file=process.env.LEO_LIVE_GRAFFITI_CLEAR||fileURLToPath(new URL('../../leo-live-graffiti-clear',import.meta.url));
fs.writeFileSync(file,(process.argv.slice(2).join(' ')||'cleared by hand')+'\n');
console.log(`Asked Leo live to clear the graffiti wall (${file}). The server log says "graffiti wall cleared" once it has.`);
