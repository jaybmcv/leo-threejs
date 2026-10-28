import assert from 'node:assert/strict';
import {loadWalkShip,fitForWalking} from './walk-plan.mjs';
import {solidSpots} from '../src/walk/rest.js';
const ship=await loadWalkShip(),{prepared,colliders}=fitForWalking(ship);
const after=solidSpots(prepared.restSpots,colliders);assert.equal(after.length,prepared.seats.length,'feature proxies changed accepted rest filtering');
for(let i=0;i<after.length;i++)assert.deepEqual(after[i].point.toArray(),prepared.seats[i].point.toArray());
for(const key of ['booth','poolTable','concession','provisions','pipework','kittens','diningRobots','hydration','trolley','freightGate','blossom','jaguarGate','arcadeRow','missionHolo','swordCase','mudwater','lounge'])assert(prepared[key],key+' missing from Node world');
console.log('Shared preparation: all 17 feature systems present; '+prepared.restSpots.length+' raw rest spots, '+prepared.seats.length+' accepted, unchanged by later feature proxies; '+colliders.triangles+' static triangles, '+colliders.movers.length+' lounge door movers.');
