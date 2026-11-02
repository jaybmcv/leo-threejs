import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import layout from 'v2-layout';
import {plannedStanding} from '../src/v2/standing.js';
const target=JSON.parse(await fs.readFile('output/launch-e/walk-target.json')),failed=target.approaches.filter(a=>!plannedStanding(layout,...a.at));
const result={status:failed.length?'FAIL':'PASS',checked:target.approaches.length,failed};
await fs.writeFile('output/launch-e/standing-fixture.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(failed.length,0);
