import * as T from 'three';

// The walk camera stops at 150 m and the space backdrop is drawn behind the ship, so down a long corridor whatever lies
// past the far plane showed stars and Mars, like a window that filled in with the real room on approach. A plain proxy of
// the hull (each deck's plate outline, raised through the deck's height) is drawn in its own pass, fogged, from just
// inside the far plane on: past the far plane the ship fades into the haze, and only the opened windows show space.
export function createHaze(ship){
 const pos=[],tri=(a,b,c)=>pos.push(...a,...b,...c);
 for(const deck of ship.decks){
  const pts=deck.children.find(o=>o.name==='Deck_slab')?.userData.outline;if(!pts?.length)continue;
  const y0=deck.userData.y-.5,y1=deck.userData.y+4.5;
  // The sides: round the outline (starboard forward, port back).
  const ring=[...pts.map(([x,w])=>[x,w]),...pts.slice().reverse().map(([x,w])=>[x,-w])];
  ring.forEach(([xa,za],i)=>{const [xb,zb]=ring[(i+1)%ring.length];tri([xa,y0,za],[xb,y0,zb],[xb,y1,zb]);tri([xa,y0,za],[xb,y1,zb],[xa,y1,za]);});
  // Floor and roof: the outline is one width per station, so strips across it fill it.
  for(let i=0;i<pts.length-1;i++){const [xa,wa]=pts[i],[xb,wb]=pts[i+1];for(const y of [y0,y1]){tri([xa,y,-wa],[xb,y,-wb],[xb,y,wb]);tri([xa,y,-wa],[xb,y,wb],[xa,y,wa]);}}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.computeBoundingSphere();
 const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({name:'Walk_haze',color:0xd9dcd6,side:T.DoubleSide}));mesh.name='Walk_haze';mesh.frustumCulled=false;
 return mesh;
}
