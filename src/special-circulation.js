import * as T from 'three';
import {SPECIAL_AREAS} from './special-areas.js';
import {transitOpenings} from './transit.js';
import {unionRectangles,slabGeometry} from './floor-geometry.js';

export function createSpecialCirculation(deck){
  if(![2,7,20].includes(deck))return null;
  const root=new T.Group();root.name=`Deck_${deck}_special_area_connections`;const shell=new T.Group();shell.name='Connection_walls_and_ceiling';root.add(shell);
  const floor=new T.MeshStandardMaterial({color:0xc5baa4,roughness:.85}),wall=new T.MeshStandardMaterial({color:0xd9ddd6,roughness:.8}),light=new T.MeshStandardMaterial({color:0xffedcd,emissive:0xffe4b6,emissiveIntensity:.6});
  const y=-39.7+(deck-1)*4,span=deck===20?[-52,156]:deck===7?[-273,-132]:[138,148],width=deck===20?8:6;
  const rooms=SPECIAL_AREAS.filter(a=>a.deck===deck&&a.door==='inboard');
  const add=(name,size,p,mat,parent=root)=>{const o=new T.Mesh(new T.BoxGeometry(...size),mat);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);};
  const intervals=(start,end,gaps)=>{const result=[];let p=start;for(const[a,b]of gaps.sort((a,b)=>a[0]-b[0])){if(a>p)result.push([p,a]);p=Math.max(p,b);}if(p<end)result.push([p,end]);return result;};
  const spine=unionRectangles([{x0:span[0],x1:span[1],z0:-width/2,z1:width/2}],transitOpenings(deck));
  const floorMesh=new T.Mesh(slabGeometry(spine,y,.25),floor);floorMesh.name='Special_spine_floor';root.add(floorMesh);
  const ceilingMesh=new T.Mesh(slabGeometry(spine,y+3.44,.14),wall);ceilingMesh.name='Special_spine_ceiling';shell.add(ceilingMesh);
  for(const s of [-1,1]){
    const sideRooms=rooms.filter(a=>Math.sign(a.center[2])===s);
    const stairGap=(deck===7?[[-174,-169.5],[-158,-154],[-137.5,-130.1]]:[[130.1,133.9],[136.8,146]]).map(([a,b])=>[Math.max(span[0],a),Math.min(span[1],b)]).filter(([a,b])=>b>a);
    for(const[a,b]of intervals(span[0],span[1],[...sideRooms.map(a=>[a.center[0]-2,a.center[0]+2]),...stairGap]))add('Special_spine_wall',[b-a,3.3,.16],[(a+b)/2,y+1.65,s*(width/2+.08)],wall,shell);
    for(const room of sideRooms){
      const end=Math.abs(room.center[2])-room.depth/2,start=width/2;if(end<=start+.01)continue;
      const cx=room.center[0],cz=s*(end+start)/2;
      add('Room_link_floor',[4,.25,end-start],[cx,y-.125,cz],floor);
      add('Room_link_ceiling',[4,.14,end-start],[cx,y+3.37,cz],wall,shell);
      for(const side of [-1,1])add('Room_link_wall',[.16,3.3,end-start],[cx+side*2.08,y+1.65,cz],wall,shell);
    }
  }
  for(let x=span[0]+4;x<span[1];x+=8)add('Connection_light',[3,.04,.24],[x,y+3.24,0],light,shell);
  root.userData={deck,floor:y,clearWidth:width,connections:rooms.map(a=>({id:a.id,entry:[a.center[0],y,a.center[2]-Math.sign(a.center[2])*a.depth/2]})),endpoints:span.map(x=>[x,y,0])};
  return {root,shell};
}
