import {shapePoint} from './concept-shape.js';

// The gate at every crown-lift landing on the fin: its opening is the lift's landing door (width x height, lifts.js and
// lift-ride.js), framed by two jambs wide enough to carry the landing's signs, and a header under the height label.
export const FIN_GATE={width:2.6,height:2.75,jamb:.54,header:.3,x:-244.8,depth:.15};
// How much the fin drop (concept-shape.js) squashes a height built at `y` inside the fin: 1 below the squash band and
// above it, where the drop is a plain translation. Divide a size by it to build a part that ends up the size it is meant to be.
export const finDropSqueeze=y=>(shapePoint([FIN_GATE.x,y+.5,0])[1]-shapePoint([FIN_GATE.x,y,0])[1])/.5;
