// What scripts/check-public-area.mjs measures the public-area rule against, bundled with the selected layout.
import layout from '../../src/plan/selected-layout.js';
import {anchoredPoint,toWorld} from '../../src/plan/rooms.js';
import {VAULT_PLAN,VAULT_LIFT} from '../../src/walk/vault.js';
import {LIFTS} from '../../src/walk/lifts.js';
import {MAZE_ROOM,MAZE_START,MAZE_BUTTON} from '../../src/walk/maze/layout.js';
import {PANEL} from '../../src/walk/net/panel-rules.js';
import {SWIM,swimWorld} from '../../src/walk/aquarium-treasure/layout.js';
export const vaultLiftWorld=anchoredPoint('commons-1',[VAULT_LIFT.x,VAULT_LIFT.y,VAULT_LIFT.z]);
export {layout,toWorld,VAULT_PLAN,VAULT_LIFT,LIFTS,MAZE_ROOM,MAZE_START,MAZE_BUTTON,PANEL,SWIM,swimWorld};
