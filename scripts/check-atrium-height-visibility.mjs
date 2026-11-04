// Camera-directed atrium visibility must not collapse to a four-metre band when grounded.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import layout from '../src/plan/selected-layout.js';
import {bandOf} from '../src/walk/collision.js';
import {setAtriumView,fastAtriumSpan} from '../src/v2/atrium-visibility.js';
import {showBands} from '../src/v2/render-bake.js';
import {showBands as showAuthoringBands} from '../src/v2/render-bake.authoring.js';

const deck=n=>layout.decks.find(d=>d.number===n),ground=deck(6).y;
// This centre-promenade point exercised the old grounded-only shortcut; jumping escaped it.
const position={x:30,y:ground,z:-3};
assert(fastAtriumSpan(position),'Regression point must be inside the ground-floor atrium');
assert.equal(fastAtriumSpan({...position,y:ground+1.8}),null,'Regression jump must escape the former shortcut');
const variants=[['runtime',showBands],['authoring',showAuthoringBands]],cases=[];
for(const [variant,show] of variants){
 const bands=new Map(layout.decks.map(d=>[d.number,{visible:false,userData:{band:bandOf(d.y)}}]));
 const visible=()=>[...bands].filter(([,g])=>g.visible).map(([n])=>n);
 const check=(name,p,lo,hi,expected)=>{
  setAtriumView(p);show(bands,lo,hi);assert.deepEqual(visible(),expected,`${variant}: ${name}`);
  cases.push({variant,name,visible:visible()});
 };
 const upperView=[deck(6).y-.2,deck(12).y+2],upperDecks=[6,7,8,9,10,11,12];
 for(const [name,dy] of [['grounded',0],['small jump',.5],['jump apex',1.8],['landing',0]])
  check(name,{...position,y:ground+dy},...upperView,upperDecks);
 check('Deck 7 looking upward',{...position,y:deck(7).y},deck(7).y-.2,deck(13).y+2,[7,8,9,10,11,12,13]);
 check('camera limited to current deck',position,ground-.2,ground+2,[6]);
 check('upper gallery looking downward',{...position,y:deck(12).y},deck(8).y-.2,deck(12).y+2,[8,9,10,11,12]);
 check('outside atrium retains requested span',{x:300,y:ground,z:100},...upperView,upperDecks);
}
for(const suffix of ['', '.authoring', '.prepared', '.public']){
 const file=`src/walk/main${suffix}.js`,source=await fs.readFile(file,'utf8');
 const span=source.slice(source.indexOf('function span(p,now){'),source.indexOf('\nfunction cull('));
 assert(span.startsWith('function span(p,now){'),`${file}: span missing`);
 assert.match(span,/setAtriumView\(p\)/,`${file}: fog/proxy updates retained`);
 assert.doesNotMatch(source,/fastAtriumSpan/,`${file}: grounded shortcut must not precede camera visibility`);
 assert.match(span,/for\(const \[x,y\] of VIEW_RAYS\)/,`${file}: camera ray visibility retained`);
 assert.match(span,/now-lastSpan>=150/,`${file}: visibility query throttling retained`);
}
console.log(JSON.stringify({status:'PASS',cases:cases.length,mainVariants:4,assertion:'Camera-selected upper decks remain visible through ground/jump/landing; narrow camera spans and non-atrium culling remain bounded.',details:cases},null,2));
