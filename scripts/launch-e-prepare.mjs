import {runPreparedAuthoring} from './prepared-authoring-lock-v2.mjs';
import {encodePreparedWalk} from './encode-prepared-walk-v2.mjs';
await runPreparedAuthoring();
await encodePreparedWalk();
