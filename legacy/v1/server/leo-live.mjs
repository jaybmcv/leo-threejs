// Keep the original service data locations when running the frozen v1 implementation.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const files=[["LEO_LIVE_TREASURE","leo-live-treasure.json"],["LEO_LIVE_GIVEAWAY","leo-live-giveaway.json"],["LEO_LIVE_GIVEAWAY_CLAIMS","leo-live-giveaway-claims.json"],["LEO_LIVE_ARENA_STATS","leo-live-arena-stats.json"],["LEO_LIVE_GRAFFITI","leo-live-graffiti.json"],["LEO_LIVE_GRAFFITI_CLEAR","leo-live-graffiti-clear"],["LEO_LIVE_SCORES","leo-live-scores.json"],["LEO_LIVE_HEARTS","leo-live-hearts.json"],["LEO_LIVE_CHAT_LOG","leo-live-chat.json"],["LEO_LIVE_HALLOWEEN","leo-live-halloween.json"],["LEO_LIVE_MAZE","leo-live-maze.json"],["LEO_LIVE_TV","leo-live-tv"],["LEO_LIVE_TV_CLEAR","leo-live-tv-clear"]];
for(const [key,name]of files)if(!process.env[key])process.env[key]=fileURLToPath(new URL('../../../../'+name,import.meta.url));else if(!path.isAbsolute(process.env[key]))process.env[key]=path.resolve(repo,process.env[key]);
export const {server}=await import('./live-core.mjs');
