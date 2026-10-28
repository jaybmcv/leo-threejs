// The Container Maze (src/walk/maze): its layout and, built for real (maze/hold.js), walked as the 2 m walker. Every
// cell reached, a long way to the middle with dead ends off it, a middle that keeping a hand on one wall never finds,
// the red button within reach, nothing slipping between containers, the space by the doorway (desk, trolley, Go to
// spot) kept clear, and the server's floor for a believable time well under any real run.
import * as T from 'three';
import {MAZE,NX,NZ,X0,END,SIDE,WALL,HEIGHT,CELL_X,CELL_Z,GOAL,ENTRY_ROW,SEED,LOOPS,MAZE_FASTEST_S,MAZE_START,MAZE_BUTTON,RUN_SPEED,cellCentre,inMaze,inFront,MAZE_ROOM}
 from '../src/walk/maze/layout.js';
import {createMazeHold} from '../src/walk/maze/hold.js';
import {Colliders,BODY} from '../src/walk/collision.js';
import {TROLLEY_SPOT} from '../src/walk/cargo-trolley.js';
import {v1Frame} from '../src/plan/rooms.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};

log(`seed ${SEED}, ${LOOPS} loops: ${NX} x ${NZ} cells of ${CELL_X} x ${CELL_Z.toFixed(2)} m, walls ${WALL} m, ${MAZE.walls.length} wall runs, ${MAZE.hollows.length} walk-through or walk-in containers`);
expect(MAZE.reached===NX*NZ,`every cell can be reached (${MAZE.reached}/${NX*NZ})`);
expect(MAZE.path.length>=25,`the way to the middle is long: ${MAZE.path.length} cells, ${MAZE.metres.toFixed(0)} m`);
expect(MAZE.deadEnds>=8,`there are dead ends to fall for: ${MAZE.deadEnds}`);
expect(!MAZE.followers.left&&!MAZE.followers.right,'a hand kept on the left wall, or the right, never comes to the middle');
expect(MAZE.hollows.some(h=>h.kind==='tunnel')&&MAZE.hollows.some(h=>h.kind==='dead-end'),'some containers are open at both ends, some at one end only');
const sprint=MAZE.metres/RUN_SPEED;
expect(MAZE_FASTEST_S>=5&&MAZE_FASTEST_S<sprint*.75,`the fastest believable run, ${MAZE_FASTEST_S} s, is well under the way at a sprint (${sprint.toFixed(1)} s)`);
expect(MAZE.button.x>cellCentre(GOAL.i,GOAL.j)[0]-CELL_X/2&&MAZE.button.x<cellCentre(GOAL.i,GOAL.j)[0]+CELL_X/2,'the red button is in the middle cell');
const room=v1Frame(MAZE_ROOM);
expect(Math.abs(room.size[0]/2-.16-END)<1e-6&&Math.abs(room.size[2]/2-.16-SIDE)<1e-6,'the maze is sized to the hold\'s inner faces');
expect(TROLLEY_SPOT.x+.45<X0,`the parked trolley stays in front of the maze (${(X0-TROLLEY_SPOT.x).toFixed(2)} m clear of its front row)`);
expect(inFront(-20,0,0)&&!inMaze(-20,0,0),'the Go to spot, 6 m in from the doorway, is in front of the maze');
expect(inMaze(...MAZE_BUTTON)&&inFront(MAZE_START[0]-1,0,MAZE_START[2]),'the start line and the button are where the clock looks for them');

// Built for real, in a stand-in ship with just the hold's frame, and walked: a 0.25 m flood of the walker's capsule
// from the Go to spot, between the room's walls.
const ship={root:new T.Group()},area=new T.Group();area.name='Area_'+MAZE_ROOM;area.position.set(...room.origin);ship.root.add(area);
const hold=createMazeHold(ship);
expect(!!hold,'the maze builds');
const col=new Colliders();col.addStatic(hold.solid,()=>true);col.commit();
const {radius:R,height:H,step:STEP}=BODY,G=.25,seg=new T.Line3(new T.Vector3(),new T.Vector3());
const free=(x,z)=>{if(x<-25.84+R||x>END-R||Math.abs(z)>SIDE-R)return false;const p=hold.toShip(x,0,z);seg.start.set(p.x,p.y+STEP+R,p.z);seg.end.set(p.x,p.y+H-R,p.z);return !col.overlaps(seg,R);};
const k=(i,j)=>i*1000+j,seen=new Set(),queue=[[Math.round(-20/G),0]];seen.add(k(...queue[0]));
for(let n=0;n<queue.length;n++){const [i,j]=queue[n];for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(seen.has(k(a,b))||!free(a*G,b*G))continue;seen.add(k(a,b));queue.push([a,b]);}}
const reached=(x,z,r=.3)=>queue.some(([i,j])=>Math.hypot(i*G-x,j*G-z)<=r);
const cells=[];for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++)if(!reached(...cellCentre(i,j),.6))cells.push([i,j]);
expect(!cells.length,`the walker reaches every cell's middle (${NX*NZ-cells.length}/${NX*NZ})${cells.length?' · missed '+cells.join(' '):''}`);
const [bi,bj]=queue.reduce((m,q)=>Math.hypot(q[0]*G-MAZE.button.x,q[1]*G-MAZE.button.z)<Math.hypot(m[0]*G-MAZE.button.x,m[1]*G-MAZE.button.z)?q:m),press=hold.near(hold.toShip(bi*G,0,bj*G));
expect(press==='button','from the nearest spot the walker can stand, E reaches the red button');
// Nothing reached sits inside a wall: every reached spot is in a corridor, a container open to walk through, or in
// front of the maze.
const inWall=([i,j])=>MAZE.walls.some(r=>i*G>r.x0+.05&&i*G<r.x1-.05&&j*G>r.z0+.05&&j*G<r.z1-.05);
expect(!queue.some(inWall),'no gap between containers lets the walker into a wall');
// The space in front: from the doorway to the front row, side to side, is open but for the desk's place and the trolley.
const front=queue.filter(([i,j])=>i*G<X0).length*G*G;
expect(front>(X0+25.84-1)*(2*SIDE-1)*.85,`the space in front of the maze is open (${front.toFixed(0)} m² reached)`);
// The containers stand clear of the hold's name plate (on the end wall, 4 cm proud, 2.23-2.88 m up).
expect(MAZE.walls.every(r=>Math.min(r.x1,END-.1)<=25.76)&&HEIGHT<3.3-.2,'the containers stay off the end wall\'s name plate and under the ceiling');
expect(ENTRY_ROW===Math.floor(NZ/2)&&Math.abs(MAZE.entrance.z0+MAZE.entrance.z1)<1e-9,'the way in faces the doorway');

if(problems.length){console.error(`\n${problems.length} problem(s)`);process.exit(1);}
log('\nContainer maze checks pass.');
