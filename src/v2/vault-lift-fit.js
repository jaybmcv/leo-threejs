import{anchoredPoint,unanchorPoint}from'../plan/rooms.js';
import*as T from'three';
// The unchanged three-stop tube must fit the leaning upper garden skin.
// Move its specification, so opening cuts, live meshes, movers and map users
// all consume the same position rather than shifting only its appearance.
export const CLUBHOUSE_INBOARD_SHIFT=7;
export function fitV2VaultLiftSpec(spec){const world=anchoredPoint('commons-1',[spec.x,spec.y,spec.z]);world[2]+=CLUBHOUSE_INBOARD_SHIFT;const source=unanchorPoint('commons-1',world);return{...spec,x:source[0],z:source[2]};}
// The lounge cab fits below the galleries, facing the open floor. Upper arrivals stay put.
export const CLUBHOUSE_LOUNGE_STATION=[-138.9,24.3,-29.75];
export function clubhouseDockMatrix(spec,index){return index===0?new T.Matrix4().makeTranslation(...CLUBHOUSE_LOUNGE_STATION).multiply(new T.Matrix4().makeRotationY(Math.PI/2)):new T.Matrix4().makeTranslation(...anchoredPoint('commons-1',[spec.x,spec.stops[index].y,spec.z]));}
