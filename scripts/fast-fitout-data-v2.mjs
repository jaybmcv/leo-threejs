import fs from 'node:fs/promises';
import layout from '../src/plan/selected-layout.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {communityDisplayParts} from '../src/v2/community-displays.js';
import {arrivalArtWall} from '../src/v2/phase4-community.js';
const data=phase4Programme(layout),mount=arrivalArtWall();
data.parts.push(...communityDisplayParts(layout),{part:'arrival_display_wall',size:[.10,3.28,2.6],at:[mount[0]-.10,layout.decks[1].y+1.64,mount[2]],yaw:0,mat:'navy',room:'circulation-2',deck:2});
await fs.mkdir('output/fast-deploy',{recursive:true});
await fs.writeFile('output/fast-deploy/fitout-current.json',JSON.stringify(data));
