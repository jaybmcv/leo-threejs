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
import {createMazeGame} from '../src/walk/maze/run.js';

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
// The whole-ship walk check counts every standable 2 m sample of a room's floor: a body inside a container must not
// count as standing.
const inside=MAZE.walls.filter(r=>{for(let x=r.x0+.4;x<=r.x1-.4;x+=.5)for(let z=r.z0+.4;z<=r.z1-.4;z+=.5)if(free(x,z)){log("  free inside",x.toFixed(2),z.toFixed(2),JSON.stringify(r));return true;}return false;});
expect(!inside.length,`nobody can stand inside a container (${inside.length} wall runs let a body in)`);
// The space in front: from the doorway to the front row, side to side, is open but for the desk's place and the trolley.
const front=queue.filter(([i,j])=>i*G<X0).length*G*G;
expect(front>(X0+25.84-1)*(2*SIDE-1)*.85,`the space in front of the maze is open (${front.toFixed(0)} m² reached)`);
// The containers stand clear of the hold's name plate (on the end wall, 4 cm proud, 2.23-2.88 m up).
expect(MAZE.walls.every(r=>Math.min(r.x1,END-.1)<=25.76)&&HEIGHT<3.3-.2,'the containers stay off the end wall\'s name plate and under the ceiling');
expect(ENTRY_ROW===Math.floor(NZ/2)&&Math.abs(MAZE.entrance.z0+MAZE.entrance.z1)<1e-9,'the way in faces the doorway');
expect(hold.group.children.some(o=>o.material?.name==='Container_maze_light'),'the open containers have warm overhead fixtures');
expect(hold.group.children.filter(o=>o.material?.name==='Container_maze_numbers').length===1,'the cargo numbers share one draw');
expect(!!hold.group.getObjectByName('Container_maze_board')&&hold.near(hold.toShip(X0-1,0,MAZE.entrance.z1+6.5))==='sign','the foyer screen is readable with E without entering the course');

// Exercise the screen's real client flow with a small DOM stand-in, including an older server that never answers.
// Browser review still checks the actual screen and lettering in the room.
class Element{
 constructor(){this.hidden=false;this.children=[];this.dataset={};this.listeners={};}
 set textContent(v){this.text=String(v);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(e=>typeof e==='string'?e:e.textContent).join('');}
 append(...kids){this.children.push(...kids);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 focus(){}
}
const elements=[],saved=new Map(),sent=[],screens=[],moves=[];let now=10000;
const oldPerformance=Object.getOwnPropertyDescriptor(globalThis,'performance');
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
globalThis.document={head:new Element(),body:new Element(),createElement(){const e=new Element();elements.push(e);return e;}};
globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
const link={live:true,maze:(op,extra)=>sent.push({op,...extra})},foyer={x:X0-2,y:0,z:0};
const game=createMazeGame({hold:{toLocal:p=>p,toShip:(...p)=>p,near:()=> 'button',press(){},update(){},setBoard:b=>screens.push(b)},
 live:()=>link,goTo:p=>moves.push(p),muted:()=>true});
const tick=ms=>{now+=ms;game.update(foyer,now);},requests=()=>sent.filter(m=>m.op==='board').length;
game.update(foyer,now);game.update(foyer,now);
expect(requests()===1,'entering the foyer fetches the board once, without opening a sheet');
game.fromServer({op:'board',verified:false,top:[{name:'Runner',ms:9531}],you:null});
expect(screens.at(-1).status==='guest'&&screens.at(-1).top[0].ms===9531,'a guest sees the existing shared times on the room screen');
tick(14999);expect(requests()===1,'the room screen does not poll every frame');
tick(1);expect(requests()===2,'the room screen refreshes after 15 seconds');
tick(6001);expect(screens.at(-1).status==='unavailable'&&!screens.at(-1).top.length,'a connected server that ignores maze requests shows unavailable, without stale times');
tick(9000);game.fromServer({op:'board',verified:true,top:[],you:null});
expect(screens.at(-1).status==='ok','an empty board is distinct from a server that did not answer');
link.live=false;tick(1);expect(screens.at(-1).status==='offline','a lost connection clears the shared screen');
link.live=true;const before=requests();tick(1);
expect(requests()===before+1,'reconnecting fetches the board again');
game.fromServer({op:'board',verified:true,top:[{name:'Runner',ms:9531}],you:{ms:9531,rank:1}});
game.update({x:X0+1,y:0,z:0},now);expect(game.running,'the existing entrance still starts the clock');
now+=10000;game.use({at:'button'},now);
expect(!game.running&&saved.get('leo-maze-best')==='10000'&&sent.some(m=>m.op==='finish'&&m.ms===10000),'the red button still stops the clock and keeps the browser best');
tick(6001);
const sheet=elements.find(e=>e.id==='maze-sheet');
expect(sheet.textContent.includes('board did not answer')&&!sheet.textContent.includes('Saving your time'),'an unanswered finish stops waiting and keeps the browser best');
game.fromServer({op:'result',ok:true,ms:10000,best:9531,rank:1,newBest:false});
expect(sheet.textContent.includes('Your best is 0:09.5'),'a late server result still updates the result card');
elements.find(e=>e.text==='Back to the start').listeners.click();
expect(moves.length===1,'the result card still returns the walker to the start');
game.update(foyer,now);game.update({x:X0+1,y:0,z:0},now);
elements.find(e=>e.text==='Give up').listeners.click();
expect(!game.running&&moves.length===2,'Give up still exits a run');
// A finish with the link down is handed to the link, which holds it while it reconnects (net/live.js heldFinishes).
{const held=[],enter=()=>{game.update(foyer,now);game.update({x:X0+1,y:0,z:0},now);};link.maze=(op,extra,lost)=>{sent.push({op,...extra});if(op==='finish')held.push(lost);};
 enter();link.live=false;now+=12000;game.update({x:X0+1,y:0,z:0},now);game.use({at:'button'},now);
 expect(held.length===1&&typeof held[0]==='function'&&sent.at(-1).op==='finish'&&sent.at(-1).ms===12000&&sheet.textContent.includes('Saving your time'),'a finish with the link down is handed to the link to hold, and the card goes on saving');
 tick(3000);expect(sheet.textContent.includes('Saving your time'),'while the finish is held, the lost connection does not end the wait');
 link.live=true;tick(100);game.fromServer({op:'result',ok:true,ms:12000,best:9531,rank:1,newBest:false});
 expect(sheet.textContent.includes('Your best is 0:09.5'),'the answer to a held finish shows as any other');
 enter();link.live=false;now+=13000;game.update({x:X0+1,y:0,z:0},now);game.use({at:'button'},now);tick(5000);held[1]?.();
 expect(held.length===2&&sheet.textContent.includes('Not connected to Leo live')&&!sheet.textContent.includes('Saving your time'),'a held finish the link gives up is said to be offline');
 link.live=true;enter();now+=14000;game.update({x:X0+1,y:0,z:0},now);link.live=false;game.use({at:'button'},now);tick(6001);
 expect(held.length===3&&sheet.textContent.includes('board did not answer'),'a held finish never answered still stops waiting after six seconds');
 link.live=true;}
Object.defineProperty(globalThis,'performance',oldPerformance);delete globalThis.document;delete globalThis.localStorage;

if(problems.length){console.error(`\n${problems.length} problem(s)`);process.exit(1);}
log('\nContainer maze checks pass.');
