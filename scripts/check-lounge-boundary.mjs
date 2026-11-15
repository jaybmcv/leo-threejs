import assert from 'node:assert/strict';
import * as T from 'three';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames} from '../src/plan/rooms.js';
import {inLounge} from '../src/walk/lounge.js';

const root=new T.Group();root.add(createGardenCommons(1).root);resolveRoomFrames(root);root.updateMatrixWorld(true);
const frame=root.getObjectByName('Hydro_Nip_Lounge').matrixWorld;
// Real ship positions on both sides of the aquarium, including the reported entrance strip.
const inside=inLounge(frame),point=p=>new T.Vector3(...p);
for(const p of [[-112.79,24.3,-25.44],[-112.5,24.3,-24.06],[-120,24.3,-25],[-100,32.3,-25],[-112.5,24.3,-32]])assert(inside(point(p)),'Lounge side must be dim: '+p);
for(const p of [[-112.5,24.3,-24.04],[-112.5,24.3,-23.5],[-112.5,24.3,-20.05]])assert(!inside(point(p)),'Walkway must stay bright: '+p);
// Only the front edge changes. Preserve both side edges, the rear and the ceiling.
for(const p of [[-137.01,24.3,-35],[-91.99,24.3,-35],[-112.5,24.3,-62.01],[-112.5,35.66,-35]])assert(!inside(point(p)),'Other lounge edges stay put: '+p);

console.log('PASS reported lounge strip, aquarium outer edge, bright walkway and unchanged side/rear/ceiling bounds');
