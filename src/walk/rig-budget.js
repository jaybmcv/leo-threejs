// How much of each frame other visitors' rigs may take (remotes.js), and how it is spent. Each body's rig solve
// (avatar.js) costs this page what it costs here: a phone several times what a desktop does. So the budget is a share of
// the frame (SHARE of its smoothed length), turned into solves by what one solve has been taking (spent: the solves'
// own time, which avatar.js measures).
//
// The tier: how many of the nearest visitors get a body at all, as many as can solve at the rig's slowest pace (a 20 fps
// machine: rig-pace.js cap) within the budget, from LEAST to MOST. It moves one at a time, a STEP_S apart, down as soon
// as the budget cannot carry it, up only with HEADROOM to spare, so a body never comes and goes with timing noise.
//
// Rates: bodies ranked biggest on screen first (forced first: the selfie booth counting down, a grapple line out),
// each takes the fastest rate it wants (its natural one: remotes.js, by its size on screen) that leaves enough for every
// body after it to solve at the slowest pace. What a rate costs a frame is what rig-pace.js makes of it: one solve every
// floor(every/frame) frames (at 30 Hz the slowest pace is every frame). Out of the camera's view a body is at the
// slowest pace already. The rates hold on average; on a frame where many come due at once, past frameCap() the smaller
// wait (rig-pace.js hold).
//   createRigBudget({share, cap, most, least}) -> {frame(dt), spent(ms, solves), tier, rates(bodies) -> every[],
//   frameCap() -> solves}
//   bodies: [{natural, forced}] in rank order; natural: 0 (every frame) or seconds between solves, true for unseen.
//   every[i]: what to pass the body's update as solveEvery (0, or seconds; true stays true).
const SHARE=.08,STEP_S=.5,EASE=.05,FIRST_SOLVE_MS=.15,HEADROOM=.9,OUTLIER=3,SPIKE=1.25;
// The rates a body may be given, fastest first: every frame, then 60, 30 and 20 a second (the last is the cap's).
const RATES=[0,1/60,1/30,.05];
export function createRigBudget({share=SHARE,cap=.05,most=24,least=6}={}){
 let frameS=1/60,solveMs=FIRST_SOLVE_MS,tier=most,since=0;
 // A solve every `gap` seconds, as rig-pace.js runs it at this frame length: once every floor(gap/frame) frames.
 const perFrame=gap=>gap>0?1/Math.max(1,Math.floor(Math.min(gap,cap)/frameS+1e-6)):1;
 const cost=every=>perFrame(every===true?cap:every),solves=()=>share*frameS*1000/solveMs;
 return {
  // Each frame, its length. One far longer than the pace (a stall, a hidden tab: main.js clamps it to 0.1 s) moves it
  // only a little, so a page that is slow throughout still gets there.
  frame(dt){
   if(!(dt>0))return;frameS+=(dt-frameS)*(dt>OUTLIER*frameS?EASE*.02:EASE);since+=Math.min(dt,STEP_S);
   const room=solves()/cost(true),want=room<tier?Math.floor(room):Math.floor(room*HEADROOM)>tier?tier+1:tier;
   const next=Math.max(least,Math.min(most,want));
   if(next!==tier&&since>=STEP_S){tier+=next>tier?1:-1;since=0;}
  },
  // What a body's solves took (ms), and how many there were.
  spent(ms,count){if(count>0&&ms>=0)solveMs+=(ms/count-solveMs)*EASE;},
  get tier(){return tier;},
  // The most solves one frame should run: the budget's, with room for the frames where the paces line up.
  frameCap(){return Math.max(1,solves()*SPIKE);},
  // (for checks and probes: what the budget is working from)
  get state(){return {frameS,solveMs,solves:solves(),tier};},
  rates(bodies){
   const out=new Array(bodies.length),floor=cost(true);let left=solves();
   for(let i=0;i<bodies.length;i++){
    const b=bodies[i],after=(bodies.length-1-i)*floor;
    if(b.natural===true){out[i]=true;left-=floor;continue;}
    if(b.forced){out[i]=b.natural;left-=cost(b.natural);continue;}
    let every=RATES.at(-1);
    for(const r of RATES)if(r>=b.natural&&cost(r)<=left-after){every=r;break;}
    out[i]=every;left-=cost(every);
   }
   return out;
  },
 };
}
