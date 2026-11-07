import assert from 'node:assert/strict';
import * as T from 'three';
import {createHaze} from '../src/v2/haze.js';
import {attachFacade} from '../src/v2/facade.js';

// Straight down the atrium centre, the haze and the distant facade must both reach the Deck 6 floor with no solid
// floor in between. Needs only source, so fast deploys run it too (v2-quick.mjs) as well as v2-check.
export function checkAtriumRays(){
 const haze=createHaze(),ray=new T.Raycaster(new T.Vector3(0,35,0),new T.Vector3(0,-1,0),0,80);haze.updateMatrixWorld(true);const hits=ray.intersectObject(haze);assert(hits.length&&Math.abs(hits[0].point.y+19.7)<.01,'Haze preserves the full atrium to the Deck 6 floor');
 const scene=new T.Scene(),ship={};const facade=attachFacade(ship,scene);scene.updateMatrixWorld(true);const visibleFloor=ray.intersectObject(facade,true).filter(h=>!(h.object.userData.gardenDecor&&h.point.y>-19.7&&h.point.y<-19.65));assert(visibleFloor.length&&Math.abs(visibleFloor[0].point.y+19.7)<.01,'Distant facade retains Deck 6, with no intermediate solid atrium floor');
 return {haze,ray,scene,ship,facade};
}
