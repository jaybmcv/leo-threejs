import {findRestSpots,solidSpots} from './rest.js';
import {createLounge} from './lounge.js';
import {createConcession} from './concession.js';
import {createSelfieBooth} from './selfie.js';
import {createPoolTable} from './pool/table.js';
import {buildColliders,prepareExteriorForWalking} from './world.js';
import {resolveRoomFrames} from '../plan/rooms.js';
import {solid} from './collision.js';
import {STATIC_LIFT_PARTS} from './lifts.js';
import {stripProvisions,createProvisions} from './provisions.js';
import {createLifeSupportPipes} from './life-support-pipes.js';
import {createKittens} from './kittens.js';
import {prepareBlossomBed,createBlossomGarden} from './blossom.js';
import {createDiningRobots} from './dining-robots.js';
import {createHydrationNook} from './hydration-nook.js';
import {createCargoTrolley} from './cargo-trolley.js';
import {dressSurgery} from './surgery.js';
import {createMudwater} from './mudwater.js';
import {createJaguarGate} from './jaguar-gate.js';
import {createLoungeEntranceSigns} from './lounge-entrance-signs.js';
import {createArcade} from './arcade.js';
import {placeAttendant,dressTheatre,createTheatreCast} from './theatre.js';
import {dressGamingLounge} from './gaming-lounge.js';
import {createMissionHolo} from './mission-holo.js';
import {createSwordCase} from './sword-case.js';
import {createChinampa} from './chinampa.js';
// Room edits and proxy colliders must be identical in the page and the Node checker.
export function prepareWalkWorld(ship,{into,exteriorPrepared=false,afterBase=null,afterRest=null,light=null,kit=null,anisotropy=1,still=false,urls={},hat=''}={}){
 const dropped=exteriorPrepared?0:prepareExteriorForWalking(ship);
 // Refrigerated provisions loses its shared locker cabinets before the colliders see them (provisions.js).
 stripProvisions(ship);
 // The Deck 17 commons' aft planter loses its green tree and shrubs for the cherry blossom garden, and a corner for its
 // pond, and gains the bench under the tree (blossom.js).
 prepareBlossomBed(ship);
 // The theatre's attendant moves behind the concession counter (theatre.js) before the walls are fitted.
 placeAttendant(ship);
 // Its old chairs give way to rows of cinema seats (theatre.js), solid and sittable.
 dressTheatre(ship);
 // The Deck 16 training room's briefing furniture gives way to the gaming lounge's (gaming-lounge.js), solid and sittable.
 dressGamingLounge(ship);
 // The Deck 5 surgical suite's beds give way to sculpted medical beds (surgery.js), solid and lie-on-able.
 dressSurgery(ship);
 resolveRoomFrames(ship.root);
 const colliders=buildColliders(ship,{extra:[ship.exterior],filter:o=>solid(o)&&!STATIC_LIFT_PARTS.test(o.name),...(into?{into}:{})});
 afterBase?.(colliders);
 const restSpots=findRestSpots(ship.inside),seats=solidSpots(restSpots,colliders),lounge=createLounge(ship,colliders,light);afterRest?.({restSpots,seats,lounge});
 const booth=createSelfieBooth();colliders.addStatic(booth.group);
 const carpet=ship.root.getObjectByName('Activity_floor'),poolTable=carpet?createPoolTable(carpet):null;if(poolTable)colliders.addStatic(poolTable.group);
 // The Deck 16 theatre's concession stand (concession.js): solid too.
 const concession=createConcession(ship);if(concession)colliders.addStatic(concession);
 // The theatre's seats as drawn and its actors on the stage (theatre.js): the actors solid as plain boxes.
 const theatreCast=createTheatreCast(ship,kit,{hat});if(theatreCast)colliders.addStatic(theatreCast.solid,()=>true);
 // Refrigerated provisions' fridges, shelving and strip curtain (provisions.js): solid as plain boxes, the curtain not.
 const provisions=createProvisions(ship);if(provisions)colliders.addStatic(provisions.solid,()=>true);
 // Life-support control's colour-coded service pipework (life-support-pipes.js): its regulator boxes and supply
 // cabinets solid as plain boxes, the pipes overhead dressing.
 const pipework=createLifeSupportPipes(ship);if(pipework)colliders.addStatic(pipework.solid,()=>true);
 // Young explorers' kitten habitats (kittens.js): the climbing tree, tunnel, den and kittens solid as plain boxes.
 const kittens=createKittens(ship,kit);if(kittens)colliders.addStatic(kittens.solid,()=>true);
 // Communal dining's three serving robots (dining-robots.js): solid as plain boxes.
 const diningRobots=createDiningRobots(ship);if(diningRobots)colliders.addStatic(diningRobots.solid,()=>true);
 // The exercise studio's hydration and towel nook (hydration-nook.js): solid as one plain box.
 const hydration=createHydrationNook(ship);if(hydration)colliders.addStatic(hydration.solid,()=>true);
 // Container hold A's parked hand trolley (cargo-trolley.js): solid as one plain box, clear of the aisle.
 const trolley=createCargoTrolley(ship);if(trolley)colliders.addStatic(trolley.solid,()=>true);
 // The cherry blossom garden (blossom.js): its trunk, bridge and pond edges solid.
 const blossom=createBlossomGarden(ship);if(blossom)colliders.addStatic(blossom.solid,()=>true);
 // The Hydro-Nip Lounge's promenade doorway as a jaguar's open mouth (jaguar-gate.js): the head's relief solid.
 const jaguarGate=createJaguarGate();colliders.addStatic(jaguarGate.solid,()=>true);
 // The marquee signs over the lounge's Deck 19 and 18 entrances (lounge-entrance-signs.js): dressing only, nothing solid.
 const entranceSigns=createLoungeEntranceSigns();
 // The arcade row on the Hydro-Nip Lounge's forward wall, Paws Off's treadmill at its far end (arcade.js): solid as plain
 // boxes.
 const arcadeRow=createArcade();if(arcadeRow)colliders.addStatic(arcadeRow.solid,()=>true);
 // Mission control's holographic table (mission-holo.js): its pedestal and top solid as a plain cylinder.
 const missionHolo=createMissionHolo(ship,{anisotropy,still});if(missionHolo)colliders.addStatic(missionHolo.solid,()=>true);
 // The Captain's office's gold sword case under its spotlight (sword-case.js): solid as a plain box.
 const swordCase=createSwordCase(ship);if(swordCase)colliders.addStatic(swordCase.solid,()=>true);
 // Hydroponic garden A's chinampa tank, its water plant and its two reading signs (chinampa.js): solid as plain boxes,
 // the hoses on the floor dressing.
 const chinampa=createChinampa(ship,{still});if(chinampa)colliders.addStatic(chinampa.solid,()=>true);
 // Mudwater Arena's turning hologram cards, brand art, game link and pack counter (mudwater.js), before the room is
 // merged; its corridor entrance (door surround and pack standee) solid as plain boxes.
 const mudwater=createMudwater(ship,{urls,anisotropy});if(mudwater)colliders.addStatic(mudwater.solid,()=>true);colliders.commit();
 return {colliders,dropped,restSpots,seats,lounge,booth,poolTable,concession,theatreCast,provisions,pipework,kittens,diningRobots,hydration,trolley,blossom,jaguarGate,entranceSigns,arcadeRow,missionHolo,swordCase,chinampa,mudwater};
}
