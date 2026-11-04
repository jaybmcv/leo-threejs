import {stripAtmosphere,createAtmosphere} from './atmosphere.js';
import {installPreparedColliders} from '../v2/prepared-codec.public.js';
import {finishLaunchBGeometry} from '../v2/launch-b-geometry.js';
import layout from '../plan/selected-layout.js';
import {prepareClubhouseAccess} from '../v2/clubhouse-access.js';
import {prepareV2LoungeFalls} from '../v2/lounge-falls-fit.js';
import {findRestSpots,solidSpots} from '../v2/rest.js';
import {createLounge} from './lounge.public.js';
import {createConcession} from './concession.public.js';
import {createSelfieBooth} from './selfie.public.js';
import {createPoolTable} from './pool/table.public.js';
import {createPinballMachine} from './pinball/machine.js';
import {buildColliders,prepareExteriorForWalking} from '../v2/world.public.js';
import {resolveRoomFrames} from '../plan/rooms.js';
import {solid} from './collision.js';
import {STATIC_LIFT_PARTS} from './lifts.js';
import {stripProvisions,createProvisions} from './provisions.public.js';
import {createLifeSupportPipes} from './life-support-pipes.public.js';
import {stripPlayFurniture,createKittens} from './kittens.public.js';
import {prepareBlossomBed,createBlossomGarden} from './blossom.public.js';
import {prepareLoungeFalls,createLoungeFalls} from './lounge-falls.js';
import {createDiningRobots} from './dining-robots.public.js';
import {createHydrationNook} from './hydration-nook.public.js';
import {createCargoTrolley} from './cargo-trolley.public.js';
import {createWardTrolley} from './ward-trolley.js';
import {stripHold,createMazeHold} from './maze/hold.js';
import {stripCargoMaintenance,createMctBay} from './mct-bay.js';
import {dressFreightGate,createFreightGate} from './freight-gate.js';
import {dressSurgery} from './surgery.public.js';
import {createMudwater} from './mudwater.public.js';
import {dressImaging} from './imaging.js';
import {createJaguarGate} from './jaguar-gate.public.js';
import {createLoungeEntranceSigns} from './lounge-entrance-signs.public.js';
import {createArcade} from './arcade.public.js';
import {createVault} from './vault.js';
import {prepareVaultLift,createVaultLift} from './vault-lift.js';
import {placeAttendant,dressTheatre,createTheatreCast} from './theatre.public.js';
import {dressGamingLounge} from './gaming-lounge.public.js';
import {dressRecreationHall} from './recreation-hall.js';
import {createMissionHolo} from './mission-holo.public.js';
import {createSwordCase} from './sword-case.public.js';
import {createChinampa} from './chinampa.js';
import {stripBaggage,createBaggage} from './baggage.js';
// Room edits and proxy colliders must be identical in the page and the Node checker.
export async function prepareWalkWorld(ship,{into,exteriorPrepared=false,afterBase=null,afterRest=null,light=null,kit=null,anisotropy=1,still=false,urls={},hat=''}={}){
 const dropped=0,colliders=installPreparedColliders(into,ship.v2PreparedColliders);
 afterBase?.(colliders);
 const restSpots=ship.v2PreparedRest,seats=ship.v2PreparedSeats.map(i=>restSpots[i]),lounge=createLounge(ship,colliders,light);afterRest?.({restSpots,seats,lounge});
 await new Promise(r=>setTimeout(r,0));
 const booth=createSelfieBooth();colliders.addStatic(booth.group);
 await new Promise(r=>setTimeout(r,0));
 const carpet=ship.root.getObjectByName('Activity_floor'),poolTable=carpet?createPoolTable(carpet):null;if(poolTable)colliders.addStatic(poolTable.group);
 await new Promise(r=>setTimeout(r,0));
 // The same hall's pinball machine at its end wall (pinball/machine.js): solid as one plain box.
 const pinball=createPinballMachine(ship);if(pinball)colliders.addStatic(pinball.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Deck 16 theatre's concession stand (concession.js): solid too.
 const concession=createConcession(ship);if(concession)colliders.addStatic(concession);
 await new Promise(r=>setTimeout(r,0));
 // The theatre's seats as drawn and its actors on the stage (theatre.js): the actors solid as plain boxes.
 const theatreCast=createTheatreCast(ship,kit,{hat});if(theatreCast)colliders.addStatic(theatreCast.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Refrigerated provisions' fridges, shelving and strip curtain (provisions.js): solid as plain boxes, the curtain not.
 const provisions=createProvisions(ship);if(provisions)colliders.addStatic(provisions.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Life-support control's colour-coded service pipework (life-support-pipes.js): its regulator boxes and supply
 // cabinets solid as plain boxes, the pipes overhead dressing.
 const pipework=createLifeSupportPipes(ship);if(pipework)colliders.addStatic(pipework.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Young explorers' kitten habitats (kittens.js): the climbing trees, step towers, toys and kittens solid as plain boxes.
 const kittens=createKittens(ship,kit);if(kittens)colliders.addStatic(kittens.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Communal dining's three serving robots (dining-robots.js): solid as plain boxes.
 const diningRobots=createDiningRobots(ship);if(diningRobots)colliders.addStatic(diningRobots.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The exercise studio's hydration and towel nook (hydration-nook.js): solid as one plain box.
 const hydration=createHydrationNook(ship);if(hydration)colliders.addStatic(hydration.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Container hold A's parked hand trolley (cargo-trolley.js): solid as one plain box, clear of the aisle.
 const trolley=createCargoTrolley(ship);if(trolley)colliders.addStatic(trolley.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Medical ward's two-tier supply trolley stands outside the aisle line (ward-trolley.js).
 const wardTrolley=createWardTrolley(ship);if(wardTrolley)colliders.addStatic(wardTrolley.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Cargo maintenance's MCT charging and service bays (mct-bay.js): the vehicles, power units, tool trolley and lift
 // pump solid as plain boxes; the cables, signs and floor markings dressing.
 const mctBay=createMctBay(ship);if(mctBay)colliders.addStatic(mctBay.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Container Maze in the same hold (maze/hold.js): its container walls and walk-through containers solid as plain
 // boxes, the red button's console too.
 const maze=createMazeHold(ship);if(maze)colliders.addStatic(maze.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The aft freight gate's iris, gantry, lanes and posters (freight-gate.js): its conveyors, transfer hatches and
 // barricades solid as plain boxes, the iris and lane paint flush, the claw overhead dressing. Its entrance door slides
 // as two movable colliders, opening for anyone near it.
 const freightGate=createFreightGate(ship,{still,colliders});if(freightGate)colliders.addStatic(freightGate.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The cherry blossom garden (blossom.js): its trunk, bridge and pond edges solid.
 const blossom=createBlossomGarden(ship);if(blossom)colliders.addStatic(blossom.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Hydro-Nip Lounge's waterfall pond (lounge-falls.js): its rim, bed, causeway, landing and rope rails solid.
 const loungeFalls=createLoungeFalls(ship);if(loungeFalls)colliders.addStatic(loungeFalls.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Hydro-Nip Lounge's promenade doorway as a jaguar's open mouth (jaguar-gate.js): the head's relief solid.
 const jaguarGate=createJaguarGate();colliders.addStatic(jaguarGate.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The marquee signs over the lounge's Deck 19 and 18 entrances (lounge-entrance-signs.js): dressing only, nothing solid.
 const entranceSigns=createLoungeEntranceSigns();
 await new Promise(r=>setTimeout(r,0));
 // The arcade row on the Hydro-Nip Lounge's forward wall, Paws Off's treadmill at its far end (arcade.js): solid as plain
 // boxes.
 const arcadeRow=createArcade();if(arcadeRow)colliders.addStatic(arcadeRow.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Behind the arcade, the hidden clubhouse's walls and vault door frame (vault.js): solid as plain boxes, the way in
 // left open (the page makes the door itself solid).
 const vault=createVault(ship);colliders.addStatic(vault.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 const vaultLift=createVaultLift(colliders);colliders.addStatic(vaultLift.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Mission control's holographic table (mission-holo.js): its pedestal and top solid as a plain cylinder.
 const missionHolo=createMissionHolo(ship,{anisotropy,still});if(missionHolo)colliders.addStatic(missionHolo.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // The Captain's office's gold sword case under its spotlight (sword-case.js): solid as a plain box.
 const swordCase=createSwordCase(ship);if(swordCase)colliders.addStatic(swordCase.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Hydroponic garden A's chinampa tank, its water plant and its two reading signs (chinampa.js): solid as plain boxes,
 // the hoses on the floor dressing.
 const chinampa=createChinampa(ship,{still});if(chinampa)colliders.addStatic(chinampa.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 const atmosphere=createAtmosphere(ship,{still});if(atmosphere)colliders.addStatic(atmosphere.solid,()=>true);
 const baggage=createBaggage(ship,{still});if(baggage)colliders.addStatic(baggage.solid,()=>true);
 await new Promise(r=>setTimeout(r,0));
 // Mudwater Arena's turning hologram cards, brand art, game link and pack counter (mudwater.js), before the room is
 // merged; its corridor entrance (door surround and pack standee) solid as plain boxes.
 const mudwater=createMudwater(ship,{urls,anisotropy});if(mudwater)colliders.addStatic(mudwater.solid,()=>true);colliders.commit();
 await new Promise(r=>setTimeout(r,0));
 return {colliders,dropped,restSpots,seats,lounge,booth,poolTable,pinball,concession,theatreCast,provisions,pipework,kittens,diningRobots,hydration,trolley,wardTrolley,maze,mctBay,freightGate,blossom,loungeFalls,jaguarGate,entranceSigns,arcadeRow,vault,vaultLift,missionHolo,swordCase,chinampa,baggage,atmosphere,mudwater};
}
