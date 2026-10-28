// The Container Maze in Deck 1's Container hold A (CONTAINER_MAZE.md), as plain numbers: no drawing, so the page, the
// live server and the checks all share it. One fixed layout, so every run is timed on the same maze.
// Room frame (Area_d01-cargo-1): x from the entrance wall (-25.92) to the end wall (25.92), z across the hold; the
// walls' inner faces at x=±25.84 and z=±16.84, the doorway at |z|<2. The maze fills the hold from X0 to the end wall
// and side to side, so the room's own walls are its outer walls; the 9.8 m in front of it, by the doorway, stays open
// (the desk, the parked trolley and the Go to spot are there).
export const MAZE_ROOM='d01-cargo-1';
export const END=25.84,SIDE=16.84;
// 9 x 7 cells. Every wall is a line of small shipping containers 2.2 m wide and 2.9 m tall (high enough that a third-
// person camera under the 3.3 m ceiling can't look over), with corridors 2.45 m (along x) and 2.93 m (along z) wide.
export const NX=9,NZ=7,WALL=2.2,CELL_X=2.45,CELL_Z=(2*SIDE-(NZ-1)*WALL)/NZ,HEIGHT=2.9;
export const X0=END-NX*(CELL_X+WALL);
// The way in faces the doorway; the red button is in the middle cell.
export const ENTRY_ROW=3,GOAL={i:4,j:3};
// The seed and the extra openings were picked (scripts/check-maze.mjs reports them) for a long way to the middle, many
// dead ends, and a middle that a hand kept on one wall never reaches from the entrance: the loops around it leave the
// walls nearest the button standing free of the outer ones.
export const SEED=1929,LOOPS=3;
export const RUN_SPEED=12;

export const cellX0=i=>X0+WALL+i*(CELL_X+WALL),cellZ0=j=>-SIDE+j*(CELL_Z+WALL);
export const cellCentre=(i,j)=>[cellX0(i)+CELL_X/2,cellZ0(j)+CELL_Z/2];
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const key=(i,j,d)=>d===0?`x${i},${j}`:d===1?`z${i},${j}`:d===2?`x${i-1},${j}`:`z${i},${j-1}`;
const inGrid=(i,j)=>i>=0&&i<NX&&j>=0&&j<NZ;

function rng(seed){let s=(seed*2654435761+1013904223)>>>0||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

// A maze for a seed: a growing tree (mostly the newest cell, sometimes a random one, for long winding corridors with
// side branches), then `loops` extra openings near the middle. Returns the set of open passages, each keyed by the
// cell on its low side: `x${i},${j}` between (i,j) and (i+1,j), `z${i},${j}` between (i,j) and (i,j+1).
export function carve(seed=SEED,loops=LOOPS){
 const random=rng(seed),open=new Set(),seen=new Set(['0,'+ENTRY_ROW]),live=[[0,ENTRY_ROW]];
 while(live.length){
  const k=random()<.75?live.length-1:Math.floor(random()*live.length),[i,j]=live[k];
  const next=DIRS.map((d,n)=>[i+d[0],j+d[1],n]).filter(([a,b])=>inGrid(a,b)&&!seen.has(a+','+b));
  if(!next.length){live.splice(k,1);continue;}
  const [a,b,n]=next[Math.floor(random()*next.length)];open.add(key(i,j,n));seen.add(a+','+b);live.push([a,b]);
 }
 // The loops: closed passages within two cells of the middle, opened.
 const near=[];for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++)for(const n of [0,1]){const a=i+DIRS[n][0],b=j+DIRS[n][1];
  if(inGrid(a,b)&&!open.has(key(i,j,n))&&Math.max(Math.abs(i-GOAL.i),Math.abs(j-GOAL.j),Math.abs(a-GOAL.i),Math.abs(b-GOAL.j))<=2)near.push(key(i,j,n));}
 for(let n=0;n<loops&&near.length;n++)open.add(near.splice(Math.floor(random()*near.length),1)[0]);
 return open;
}

export const isOpen=(open,i,j,d)=>{const a=i+DIRS[d][0],b=j+DIRS[d][1];if(d===2&&i===0&&j===ENTRY_ROW)return 'out';return inGrid(a,b)&&open.has(key(i,j,d));};
const exits=(open,i,j)=>[0,1,2,3].filter(d=>isOpen(open,i,j,d)===true);

// The shortest way from the entrance to the middle, as cells.
export function solve(open){
 const prev=new Map([['0,'+ENTRY_ROW,null]]),queue=[[0,ENTRY_ROW]];
 while(queue.length){const [i,j]=queue.shift();if(i===GOAL.i&&j===GOAL.j)break;
  for(const d of exits(open,i,j)){const a=i+DIRS[d][0],b=j+DIRS[d][1],k=a+','+b;if(!prev.has(k)){prev.set(k,[i,j]);queue.push([a,b]);}}}
 const path=[];for(let c=[GOAL.i,GOAL.j];c;c=prev.get(c.join(',')))path.unshift(c);
 return {path,reached:prev.size};
}
// Keep one hand on a wall from the entrance: does it ever come to the middle? (It does in any maze without loops.)
export function wallFollower(open,hand){
 let i=0,j=ENTRY_ROW,d=0;
 for(let step=0;step<NX*NZ*16;step++){
  if(i===GOAL.i&&j===GOAL.j)return true;
  const order=hand==='right'?[d+1,d,d+3,d+2]:[d+3,d,d+1,d+2];let moved=false;
  for(const t of order){const n=t%4,o=isOpen(open,i,j,n);if(o==='out')return false;if(o){d=n;i+=DIRS[n][0];j+=DIRS[n][1];moved=true;break;}}
  if(!moved)return false;
 }
 return false;
}

// The walls as rectangles to fill with containers, {x0,x1,z0,z1,along}: the front wall and the walls across the hold
// (each running along z, with the corner posts in them), then the walls along the hold, between posts. A post left on
// its own between two openings joins a wall along the hold beside it, or stands alone as one short container.
function walls(open){
 const out=[],tileZ=b=>b%2===0?[cellZ0(b/2),cellZ0(b/2)+CELL_Z]:[cellZ0((b+1)/2)-WALL,cellZ0((b+1)/2)],free=new Set();
 for(let k=0;k<NX;k++){
  const x0=X0+k*(CELL_X+WALL),solid=b=>b%2===1||(k===0?b/2!==ENTRY_ROW:!open.has(`x${k-1},${b/2}`));
  for(let b=0;b<2*NZ-1;){if(!solid(b)){b++;continue;}let e=b;while(e+1<2*NZ-1&&solid(e+1))e++;
   if(b===e&&b%2===1)free.add(k+','+b);else out.push({x0,x1:x0+WALL,z0:tileZ(b)[0],z1:tileZ(e)[1],along:'z'});b=e+1;}
 }
 for(let m=1;m<NZ;m++){
  const z0=cellZ0(m)-WALL,solid=i=>!open.has(`z${i},${m-1}`);
  for(let i=0;i<NX;){if(!solid(i)){i++;continue;}let e=i;while(e+1<NX&&solid(e+1)&&free.has((e+1)+','+(2*m-1)))e++;
   const lead=free.has(i+','+(2*m-1)),tail=e+1<NX&&free.has((e+1)+','+(2*m-1));
   const x0=lead?cellX0(i)-WALL:cellX0(i),x1=tail?cellX0(e)+CELL_X+WALL:cellX0(e)+CELL_X;
   if(lead)free.delete(i+','+(2*m-1));if(tail)free.delete((e+1)+','+(2*m-1));for(let q=i+1;q<=e;q++)free.delete(q+','+(2*m-1));
   out.push({x0,x1,z0,z1:z0+WALL,along:'x'});i=e+1;}
 }
 for(const f of free){const [k,b]=f.split(',').map(Number),x0=X0+k*(CELL_X+WALL),z0=cellZ0((b+1)/2)-WALL;out.push({x0,x1:x0+WALL,z0,z1:z0+WALL,along:'x'});}
 return out;
}

// Walk-through containers on straight stretches (open at both ends) and walk-in ones at dead ends (open at one end):
// each 2.2 m wide, centred in its corridor, reaching through the wall tiles to the next cells' edges.
function hollows(open,random){
 const deg=(i,j)=>exits(open,i,j),skip=(i,j)=>(i===GOAL.i&&j===GOAL.j)||(i===0&&j===ENTRY_ROW),used=new Set(),out=[];
 const straight=(i,j)=>{const e=deg(i,j);return !skip(i,j)&&e.length===2&&(e[0]+2)%4===e[1]?e[0]%2:-1;};
 for(const axis of [0,1])for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){
  if(used.has(i+','+j)||straight(i,j)!==axis)continue;
  const chain=[[i,j]];for(let [a,b]=[i+DIRS[axis][0],j+DIRS[axis][1]];inGrid(a,b)&&straight(a,b)===axis&&!used.has(a+','+b);a+=DIRS[axis][0],b+=DIRS[axis][1])chain.push([a,b]);
  for(const c of chain)used.add(c.join(','));
  if(random()<.45)continue;
  const [fi,fj]=chain[0],[li,lj]=chain.at(-1);
  out.push(axis===0?{kind:'tunnel',along:'x',a0:cellX0(fi)-WALL,a1:cellX0(li)+CELL_X+WALL,c:cellZ0(fj)+CELL_Z/2,open:[true,true]}
   :{kind:'tunnel',along:'z',a0:cellZ0(fj)-WALL,a1:cellZ0(lj)+CELL_Z+WALL,c:cellX0(fi)+CELL_X/2,open:[true,true]});
 }
 // A tunnel's ends reach into the passages beside it; a walk-in container needs its own passage free.
 const taken=new Set();for(const h of out)for(const [i,j] of cellsOf(h))for(const d of exits(open,i,j))taken.add(key(i,j,d));
 for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){
  const e=deg(i,j);if(skip(i,j)||e.length!==1||used.has(i+','+j)||taken.has(key(i,j,e[0]))||random()<.4)continue;
  const d=e[0],axis=d%2,toward=d<2;
  if(axis===0)out.push({kind:'dead-end',along:'x',a0:toward?cellX0(i):cellX0(i)-WALL,a1:toward?cellX0(i)+CELL_X+WALL:cellX0(i)+CELL_X,c:cellZ0(j)+CELL_Z/2,open:[!toward,toward]});
  else out.push({kind:'dead-end',along:'z',a0:toward?cellZ0(j):cellZ0(j)-WALL,a1:toward?cellZ0(j)+CELL_Z+WALL:cellZ0(j)+CELL_Z,c:cellX0(i)+CELL_X/2,open:[!toward,toward]});
 }
 return out;
}
// The cells a walk-through or walk-in container covers.
function cellsOf(h){
 const out=[];for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++){const [x,z]=cellCentre(i,j),[a,c]=h.along==='x'?[x,z]:[z,x];if(a>h.a0&&a<h.a1&&Math.abs(c-h.c)<1)out.push([i,j]);}
 return out;
}

// The red button: a console against one closed side of the middle cell, the far side first.
function button(open){
 const [cx,cz]=cellCentre(GOAL.i,GOAL.j);
 for(const d of [0,1,3,2])if(!isOpen(open,GOAL.i,GOAL.j,d)){
  const [dx,dz]=DIRS[d],x=cx+dx*(CELL_X/2-.3),z=cz+dz*(CELL_Z/2-.3);return {x,z,face:[-dx,-dz]};}
 return {x:cx,z:cz,face:[-1,0]};
}

export function buildMaze(seed=SEED,loops=LOOPS){
 const open=carve(seed,loops),{path,reached}=solve(open);
 // The way's length from the start line (the maze's front face) to the button, cell centre to cell centre.
 let metres=WALL+CELL_X/2;for(let n=1;n<path.length;n++)metres+=path[n][0]!==path[n-1][0]?CELL_X+WALL:CELL_Z+WALL;
 const press=button(open);
 return {open,path,reached,metres,walls:walls(open),hollows:hollows(open,rng(seed+7)),button:press,
  entrance:{x:X0,z0:cellZ0(ENTRY_ROW),z1:cellZ0(ENTRY_ROW)+CELL_Z},
  deadEnds:(()=>{let n=0;for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++)if(exits(open,i,j).length===1&&!(i===GOAL.i&&j===GOAL.j))n++;return n;})(),
  followers:{left:wallFollower(open,'left'),right:wallFollower(open,'right')}};
}
export const MAZE=buildMaze();
// The fastest believable run: the way's length at a sprint, with a third off for cutting the corners. A time under
// this is refused by the live server.
export const MAZE_FASTEST_S=Math.floor(MAZE.metres/RUN_SPEED*.66);
// Where a run starts (the start line, in the middle of the way in) and the button, in the room's frame (y=0 the floor).
export const MAZE_START=[X0,0,(MAZE.entrance.z0+MAZE.entrance.z1)/2],MAZE_BUTTON=[MAZE.button.x,0,MAZE.button.z];
// Is a point (room frame) inside the maze, or in the space in front of it?
export const inMaze=(x,y,z)=>x>X0&&x<END&&Math.abs(z)<SIDE&&y>-1&&y<2.5;
export const inFront=(x,y,z)=>x<=X0&&x>X0-4&&Math.abs(z)<SIDE&&y>-1&&y<2.5;
