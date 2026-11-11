// How many of the crowd (crowd-tier.js) this page draws, by how long its frames take (remotes.js). Frames slower than
// the target (fps: TARGET_FPS; by more than OVER, so a page held at it by its display's refresh is not over it) draw
// fewer, the farthest in view left out first (remotes.js places the nearest first); frames with HEADROOM to spare draw
// more again, while the cap is what holds them back. It starts at START, what a slow page drew before this, and comes
// up from there as fast as frames allow. What frames take is their mean since the last change, over WINDOW_S at least
// (nothing is done on less) and LONGEST_S at most.
//
// A cut is a trial: the frames after it against those before. It is kept only if frames came shorter, by MIN_GAIN at
// least and by more than their own unevenness could make them: SURE times the difference's standard error, from each
// side's spread of frames, so a page whose frames jump about is not cut on a lucky second. A second after the cut, a
// gain neither sure nor surely too small to keep is given until LONGEST_S. Not kept, the crowd is not what holds this
// page back (the room it is in is): the cut is undone, and none is tried again for a while (BACKOFF_S, longer each
// time; a cut kept starts it over). So a page held back by its room does not lose its crowd for nothing. Frames that
// came surely longer instead (the view grew heavier meanwhile: those before were no measure) undo it too, and another
// is tried RETRY_S later. Once a cut is kept, none are let back for HOLD_S, so the cap does not swing about where
// frames come to the target.
//
// Any test kept often enough is passed by luck now and then (a page its room holds back is tried for as long as it is
// there). So a cut kept while frames are still over the target is tried again, the other way, when a later cut is found
// not to help or none can be made (the cap at its least): those it left out are let back, and only if frames come surely
// longer for them does it stand (and nothing is tried again for a while, as after a cut undone); frames no longer, or
// shorter (the view grew lighter meanwhile), and they stay. Frames that come to the target end the spell: its cuts
// stand.
//
// A cut goes as far as frames are over the target (at least a fifth, at most a half), a rise as far as they are under
// (at least a tenth, at most double); one at a time. A change is measured from the frame after it: the length a frame
// passes is the last one's, drawn as it was. A frame's length is its own, not clamped (remotes.js times it: main.js
// clamps the step it passes at 0.1 s, at which a page at 5 fps would be no slower with a thousand than with five
// hundred). A frame far longer than the rest (a stall, a shader compiled as someone new comes into view) is let go,
// unless they go on, SUSTAIN of them or SUSTAIN_S: then this page is that slow (rig-budget.js does the same); one past
// GAP_S is not a frame drawn slowly (a tab come back, the Builder's Hub closed), and long frames either side of one, or
// of the selfie booth's countdown, are not in a row.
// On trial only (remotes.js crowdFps, the walk's ?crowdfps=N), not by default: on a phone (an S20 Ultra, 200 in a crowd
// 3 m off) it cut to the least and held there, with frames no shorter than at the old cap. Frames that grew shorter for
// another reason meanwhile (the page warming up after a load, the view turned somewhere lighter) passed for the cuts'
// gain; and between the target and HEADROOM nothing tries a low cap again. Before it is the default it wants cuts judged
// against frames either side of them, none while the page warms up, and a low cap tried again from time to time.
//   createCrowdCount({fps, least, most, start}) -> {frame(dt, drawn, {active}), most, state}
//   frame: each frame, its length (s) and how many of the crowd it drew; active false (the selfie booth counting down,
//   when the crowd is drawn in view or not): no step, and its frames not counted. most: how many to draw from now.
const TARGET_FPS=30,OVER=1.03,HEADROOM=.8,WINDOW_S=1,LONGEST_S=3,HOLD_S=5,MIN_GAIN=.015,SURE=3,BACKOFF_S=[15,30,60,120,300];
const RETRY_S=3,OUTLIER=2.5,SUSTAIN=30,SUSTAIN_S=3,GAP_S=1,LEAST=40,START=150,CUT=[.5,.8],RISE=[1.1,2];
const within=(v,[lo,hi])=>Math.min(hi,Math.max(lo,v));

export function createCrowdCount({fps=TARGET_FPS,least=LEAST,most=1000,start=START}={}){
 const target=1/fps,frames=[],kept=[];
 // ref: the frames' last mean (until there is one, the target), what a stall is measured against; skip: frames passed
 // that were drawn before the last change; kept: the cap before each cut kept in this spell over the target; recheck:
 // try the last of them the other way, next
 let cap=Math.min(most,Math.max(least,start)),sum=0,ref=target,slow=0,slowS=0,hold=0,quiet=0,fails=0,trial=null,skip=0,recheck=false;
 const restart=(stale=1)=>{frames.length=0;sum=0;skip=stale;};
 // The frames' mean, and its standard error squared (their spread over how many).
 const seen=mean=>({mean,se2:frames.reduce((s,f)=>s+(f-mean)**2,0)/Math.max(1,frames.length-1)/frames.length});
 const change=(to,frameS,back=false)=>{trial={from:cap,before:seen(frameS),back,looked:false};cap=to;restart();};
 const cut=(drawn,frameS)=>change(Math.max(least,Math.floor(Math.min(cap,drawn)*within(target/frameS,CUT))),frameS);
 const rise=frameS=>{cap=Math.min(most,Math.ceil(cap*within(target*HEADROOM/frameS,RISE)));kept.length=0;restart();};
 const undo=()=>{cap=trial.from;trial=null;restart();};
 // A trial's verdict, on the frames since the change: true, it stands (these frames are its); false, it is over and
 // undone or let be, with a second of frames wanted before anything else; null, wait (at the first look, unsure).
 const judge=(frameS,last)=>{
  const {mean,se2}=trial.before,gain=mean-frameS,sure=SURE*Math.sqrt(se2+seen(frameS).se2),small=mean*MIN_GAIN;
  const shorter=gain>=small&&gain>=sure,longer=-gain>=small&&-gain>=sure;
  if(trial.back){
   // Those a kept cut left out, let back: surely longer, the cut stands; otherwise it was luck, and they stay.
   // (at the least, no cut undone has set a wait: this one does)
   if(longer){if(quiet<=0)quiet=BACKOFF_S[Math.min(fails++,BACKOFF_S.length-1)];undo();return false;}
   if(!last&&gain-sure<=-small)return null;
   kept.pop();recheck=kept.length>0;trial=null;restart();return false;
  }
  if(shorter){kept.push(trial.from);fails=0;hold=HOLD_S;trial=null;return true;}
  if(!last&&!longer&&gain+sure>=small)return null;
  quiet=longer?RETRY_S:BACKOFF_S[Math.min(fails++,BACKOFF_S.length-1)];recheck=!longer&&kept.length>0;undo();return false;
 };
 return {
  get most(){return cap;},
  // (for the Stats readout and checks: what it is working from)
  get state(){return {fps,cap,frameS:ref,trial:!!trial,quiet:Math.max(0,quiet),hold:Math.max(0,hold),kept:kept.length};},
  frame(dt,drawn,{active=true}={}){
   if(!(dt>0))return cap;
   if(dt>GAP_S||!active){slow=slowS=0;if(!active)restart();return cap;}
   if(skip){skip--;return cap;}
   // (frames that stay long: this page is that slow now, and the frames before were of another)
   if(dt>OUTLIER*ref){slowS+=dt;if(++slow<SUSTAIN&&slowS<SUSTAIN_S)return cap;ref=dt;restart(0);}
   slow=slowS=0;hold-=dt;quiet-=dt;
   frames.push(dt);sum+=dt;while(sum-frames[0]>=LONGEST_S)sum-=frames.shift();
   if(sum<WINDOW_S)return cap;
   const frameS=ref=sum/frames.length;
   // A trial is looked at a second after its change, then (if unsure) once the frames since are LONGEST_S.
   if(trial){if(trial.looked&&sum<LONGEST_S)return cap;const last=trial.looked;trial.looked=true;if(!judge(frameS,last))return cap;}
   if(frameS<=target*OVER){kept.length=0;recheck=false;}
   if(recheck){recheck=false;change(kept.at(-1),frameS,true);}
   else if(frameS>target*OVER&&quiet<=0){if(drawn>least)cut(drawn,frameS);else if(kept.length)change(kept.at(-1),frameS,true);}
   else if(frameS<target*HEADROOM&&hold<=0&&drawn>=cap&&cap<most)rise(frameS);
   return cap;
  },
 };
}
