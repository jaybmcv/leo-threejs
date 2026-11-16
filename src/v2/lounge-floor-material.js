import{loungeCarpet}from'./lounge-carpet.js';import{finishOwnedLoungeFloor}from'./community-finishes.js';
export function applyLoungeFloorFinish(ship){if(ship.v2LoungeFloorMaterial)return{material:ship.v2LoungeFloorMaterial};return finishOwnedLoungeFloor(ship,loungeCarpet());}
