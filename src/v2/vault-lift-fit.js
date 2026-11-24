import * as T from 'three';

// The room-side edges of commons-1-end-4 and commons-1-end-8 share X = -137.
const edge=-137,radius=1.7;
export const CLUBHOUSE_SHAFT={edge,x:edge+radius+.04,z:-31.5,radius,carRadius:1.56,doorWidth:1.9,front:1.36,reach:3.5};
export function clubhouseDockMatrix(spec,index){
 const {x,z}=CLUBHOUSE_SHAFT;return new T.Matrix4().makeRotationY(-Math.PI/2).setPosition(x,spec.stops[index].y,z);
}
