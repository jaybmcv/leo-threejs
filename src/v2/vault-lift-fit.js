import{anchoredPoint,unanchorPoint}from'../plan/rooms.js';
// The unchanged three-stop tube must fit the leaning upper garden skin.
// Move its specification, so opening cuts, live meshes, movers and map users
// all consume the same position rather than shifting only its appearance.
export const CLUBHOUSE_INBOARD_SHIFT=7;
export function fitV2VaultLiftSpec(spec){const world=anchoredPoint('commons-1',[spec.x,spec.y,spec.z]);world[2]+=CLUBHOUSE_INBOARD_SHIFT;const source=unanchorPoint('commons-1',world);return{...spec,x:source[0],z:source[2]};}
