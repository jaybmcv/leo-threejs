import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

for(const mode of ['','.authoring','.prepared','.public']){
 const source=await fs.readFile('src/walk/main'+mode+'.js','utf8');
 assert.equal((source.match(/graffiti=createGraffiti\(baked,/g)||[]).length,1,mode+' must bind graffiti to the render bands');
 assert(source.includes('toBand(graffiti.group)'),mode+' must draw the graffiti group');
 assert(source.includes('graffiti.open(controller.position)'),mode+' must open graffiti from the walker’s position');
}
console.log('PASS Deck 19 graffiti bindings in all walk modes');
