// Phase 7 goto ownership: text/UI only; never mutate the v1 source files.
export const gotoAdapterAnchors={
 'src/walk/help.js':"import {toWorld,anchoredYaw} from '../plan/rooms.js';",
 'src/walk/signs.js':"import * as T from 'three';",
 'src/walk/lift-ride.js':"import * as T from 'three';",
};
export function gotoAdapters(file,s){
 if(file==='src/walk/places.js'){
  s.prepend("import {V2_PLACES,describePlace} from '../v2/wayfinding.js';\nimport layout from 'v2-layout';\nimport {plannedStanding} from '../v2/standing.js';\n");
  s.splice('export const PLACES=[','// Nearest point to \x60at\x60','export const PLACES=V2_PLACES;\n\n');
  s.replace(/export function describe\(p\)\{[\s\S]*?\n\}/,'export function describe(p){return describePlace(p); }');
  s.replace('colliders.raycast(ray,3.2)','(colliders.raycastGround||colliders.raycast).call(colliders,ray,3.2)');
  s.replace('const y=hit.point.y;seg.start.set','const y=hit.point.y;if(!plannedStanding(layout,x,y,z,r))return null;seg.start.set');
 }
 if(file==='src/walk/main.js'){
  s.prepend("import {renderGotoMenu} from '../v2/goto-menu.js';\nimport {gotoStand as v2GotoStand,yarnPlace} from '../v2/wayfinding.js';\nimport {addWayfindingGuides} from '../v2/wayfinding-guides.js';\n");
  // Keep v2Signs' 283 planned placements and the prepared-sign cache contract.
  s.replace('lifts=createLifts(scene,colliders);','lifts=createLifts(scene,colliders);addWayfindingGuides(lifts.signs);');
  s.splice(' for(const place of PLACES){',' panel.hidden=false;input.enabled=false;\n}',"  renderGotoMenu(list,PLACES,{go:goTo,close:closePanels,currentDeck:deckOf(controller.position.y)?.number});\n");
  s.replace('const q=findStand(colliders,place.at);','const q=place.id?v2GotoStand(colliders,place.at):findStand(colliders,place.at);');
  s.replace('PLACES.find(p=>p.name===s.place)','yarnPlace(PLACES,s.place)');
 }
 if(file==='src/walk/help.js'){
  s.prepend("import {V2_FIND,V2_EXAMPLE_GO} from '../v2/help-wayfinding.js';\n");
  s.replace(/const FIND=\[[\s\S]*?\n\];/,'const FIND=V2_FIND;');
  s.replace(/go:'\?lv=1&at='[^;]+;/,'go:V2_EXAMPLE_GO};');
  s.replace('This real report got built:','This report was built in the earlier layout. Its pictures are historical; See it aboard visits the current concession stand:');
 }
 if(file==='src/walk/signs.js'||file==='src/walk/lift-ride.js'){
  s.prepend("import layout from 'v2-layout';\n");s.replace("import {DECKS} from '../model.js';",'const DECKS=layout.decks;');
  if(file==='src/walk/signs.js')s.replace(/export const FEATURED=\{16:[^}]+\};/,"export const FEATURED={16:layout.rooms.find(r=>r.id==='d16-arena-1').name};");
 }
}
