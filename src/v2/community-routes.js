import layout from'../plan/selected-layout.js';import*as T from'three';
// The synthwave mural on commons-1's aft wall (x -141), across Decks 17-19. Its inboard edge runs to the wall's end at the
// aquarium glass (z -28), with a hole cut for each of the Deck 18 and 19 gallery doors (z -31 to -29); its outboard edge
// follows the room's envelope, slice by slice, 1.5 m inside it, so the hull curving in overhead never cuts it and it stays clear of the hull windows. Its top stops under the garden
// ceiling. S0 is where its picture starts along the painted panorama (lounge-mural.js), chosen so the sun sits where
// the wall is wide enough for all of it; the picture began at z -32 (`was`) with S 62 before the mural reached the wall's end.
export const SYNTHWAVE_MURAL={name:'Lounge_mural_back',x:-140.692,inner:-28.02,was:-32,floor:24.34,top:35.4,margin:1.5,s0:58.02,paintFloor:24.3,paintHeight:11.2,doorPad:.1,doorTop:2.6};
let muralOutline=null;
// The mural's outline as [z,y] points, inboard bottom first, its width (the canvas span in metres) and its holes, one for each
// upper gallery door, a little larger than the opening so no art or backing crosses it.
export function synthwaveMuralOutline(){
 if(muralOutline)return muralOutline;
 const m=SYNTHWAVE_MURAL,room=layout.rooms.find(r=>r.id==='commons-1');if(!room?.envelope?.length)throw Error('commons-1 has no envelope for the synthwave mural');
 // The outboard boundary at x: the most outboard (lowest z) crossing of the slice's outline. Two lines just inside the
 // wall, keeping the tighter one.
 const crossing=(poly,x)=>{let z=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a[0]===b[0]||(a[0]-x)*(b[0]-x)>0)continue;z=Math.min(z,a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));}return z;};
 const edge=[];for(const s of room.envelope){const y=room.y+s.rise;if(y>=m.top)break;const z=Math.max(crossing(s.polygon,-140.9),crossing(s.polygon,-140.6))+m.margin;if(!Number.isFinite(z)||z>=m.inner-1)throw Error('No room for the synthwave mural at y '+y);edge.push([z,Math.max(y,m.floor)]);}
 // Each slice's limit holds up to the next slice, which only narrows, so the edge runs from each slice's bottom to the next.
 edge.push([edge.at(-1)[0],m.top]);
 const points=[[m.inner,m.floor],[m.inner,m.top],...edge.reverse()];
 const holes=(room.galleryDoors||[]).filter(d=>d.center[1]>m.floor&&d.outward[0]<-.5).map(d=>{const a=d.center[2]-d.width/2-m.doorPad,b=d.center[2]+d.width/2+m.doorPad,y0=d.center[1]-.02,y1=d.center[1]+m.doorTop;return [[a,y0],[a,y1],[b,y1],[b,y0]];});
 return muralOutline={points,holes,width:m.inner-Math.min(...points.map(p=>p[0]))};
}
export function fitLoungeEntrance(group,deck){const room=layout.rooms.find(r=>r.id==='commons-1'),door=room.galleryDoors.find(d=>d.deck===deck);if(!door)throw Error('No real Hydro-Nip gallery entrance '+deck);group.position.set(...door.center);group.rotation.set(0,Math.atan2(door.outward[0],door.outward[1]),0);group.scale.set(1,1,1);group.userData={...group.userData,room:room.id,door:door.id,phase4Route:true};group.updateMatrixWorld(true);}
export function hazeMazeApproach(){const r=layout.rooms.find(r=>r.id==='commons-1'),m=r.components.pieces.find(p=>p.name==='Haze Maze tower');return{name:'Haze Maze entrance',detail:'Deck 17 · Hydro-Nip Lounge',room:r.id,at:[m.center[0],r.y,m.center[2]-m.size[2]/2-1.8],yaw:0,lv:2,resolved:true};}
export function fitSynthwaveMural(group){const m=SYNTHWAVE_MURAL,o=group.getObjectByName(m.name);if(!o)throw Error('Missing original synthwave panel '+m.name);
 const {points:contour,holes,width}=synthwaveMuralOutline(),vec=([z,y])=>new T.Vector2(-z,y),tris=T.ShapeUtils.triangulateShape(contour.map(vec),holes.map(h=>h.map(vec))),points=[...contour,...holes.flat()],pos=[],uv=[];
 // The picture at full scale: S runs outboard from the inboard edge, and its height is measured from the floor.
 for(const tri of tris)for(const i of tri){const [z,y]=points[i];pos.push(m.x,y,z);uv.push((m.inner-z)/width,(y-m.paintFloor)/m.paintHeight);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 o.geometry.dispose();o.geometry=g;o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.userData={...o.userData,room:'commons-1',noCollide:true,phase4Display:true};const old=group.getObjectByName('Lounge_mural_left');if(old){old.removeFromParent();old.geometry.dispose();old.material.map?.dispose();old.material.dispose();}return group;}
