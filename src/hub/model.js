// What the Builder's Hub says about a card from the Hub service. Pure, so scripts/check-hub.mjs can run it without a page.
export const TRACK=[['submitted','Submitted'],['approved','Approved'],['building','Building'],['shipped','Shipped'],['live','Live']];
const STATUS={
 submitted:{pill:'Received',tone:'plain'},
 decision:{pill:'Waiting for a decision',tone:'plain'},
 planning:{pill:'Being looked at',tone:'plain'},
 'more-info':{pill:'We need a bit more from you',tone:'orange'},
 approved:{pill:'Approved',tone:'teal'},
 building:{pill:'Being built',tone:'orange'},
 review:{pill:'Built, waiting for review',tone:'orange'},
 paused:{pill:'Paused for now',tone:'plain'},
 shipped:{pill:'Shipped',tone:'orange'},
 live:{pill:'Live on Leo',tone:'teal'},
 joined:{pill:'Joined with another idea',tone:'plain'},
 resolved:{pill:'Dealt with',tone:'plain'},
 closed:{pill:'Not going ahead',tone:'plain'},
 planned:{pill:'Planned',tone:'plain'},
};
export const statusOf=status=>STATUS[status]||STATUS.submitted;
const ENDED=new Set(['joined','resolved','closed']);
export const hasTrack=c=>!ENDED.has(c.status);
// Only work that is really moving gets the pulse: something waiting on a person, or paused, sits still.
export const isMoving=c=>c.status==='building'||c.status==='review'||c.status==='shipped';

// The number of the step under way: the first not yet live, or the one after them all once the next has been approved.
function stepNow(c){
 if(!c.steps?.length)return null;
 const open=c.steps.find(s=>s.status!=='live'&&s.status!=='planned');
 if(open)return open.number;
 return c.status==='live'||c.status==='shipped'?null:c.steps.length+1;
}
export function pill(c){
 const {pill:label,tone}=statusOf(c.status);
 const n=stepNow(c),of=c.stepTotal?` of ${c.stepTotal}`:'';
 if(n)return {text:`Step ${n}${of} · ${label}`,tone};
 if(c.moreToCome)return {text:`${label} · more to come`,tone};
 return {text:label,tone};
}
// A sentence under the title, only where the status needs one.
export function note(c){
 if(c.status==='more-info')return c.question||'Anything else you can tell us helps. Send it through Feedback from the same spot.';
 if(c.status==='closed'||c.status==='joined'||c.status==='resolved')return c.reason||null;
 if(c.status==='shipped')return c.deployment==='pending'?'Merged, and on its way aboard with the next update.':'Merged. It shows as live once we can confirm it’s running aboard.';
 if(c.status==='paused')return 'We hit a snag on this one. It’s still on the list.';
 return c.moreToCome&&c.status==='live'?'This part is aboard, and there’s more of this idea still to come.':null;
}

export function trackNodes(c){
 const live=c.status==='live',at=TRACK.findIndex(([k])=>k===c.stage);
 return TRACK.map(([key,label],i)=>({key,label,date:c.dates?.[key]||null,state:live||i<at?'done':i===at?'now':'todo',reached:live||i<at}));
}

const WORKS=new Set(['approved','building','review','paused','shipped']);
const WAITING=new Set(['submitted','decision','planning']);
const when=c=>Date.parse(c.dates?.live||c.dates?.shipped||c.dates?.building||c.dates?.approved||c.dates?.submitted)||0;
const newest=(a,b)=>when(b)-when(a);
export function groups(cards){
 const pick=test=>cards.filter(test).sort(newest);
 return [
  {key:'needs',title:'Needs you',cards:pick(c=>c.status==='more-info')},
  {key:'works',title:'In the works',cards:pick(c=>WORKS.has(c.status))},
  {key:'waiting',title:'Waiting for a decision',cards:pick(c=>WAITING.has(c.status))},
  {key:'live',title:'Live on Leo',cards:pick(c=>c.status==='live')},
  {key:'ended',title:'Wrapped up',cards:pick(c=>ENDED.has(c.status))},
 ].filter(g=>g.cards.length);
}
export function stats(cards){
 const count=test=>cards.filter(test).length;
 return [{n:cards.length,label:'Ideas sent'},{n:count(c=>WORKS.has(c.status)),label:'In the works',tone:'orange'},{n:count(c=>c.status==='live'),label:'Live on Leo',tone:'teal'},{n:count(c=>c.status==='more-info'),label:'Need you'}];
}
export const feature=cards=>cards.filter(c=>c.status==='live'&&c.shots?.length).sort(newest)[0]||null;

// "Oct 27", or "Today". The walk's clock is the visitor's own.
export function shortDate(iso,now=new Date()){
 const d=new Date(iso);if(!iso||Number.isNaN(+d))return '';
 if(d.toDateString()===now.toDateString())return 'Today';
 const opts={month:'short',day:'numeric',...(d.getFullYear()===now.getFullYear()?{}:{year:'numeric'})};
 return d.toLocaleDateString('en-US',opts);
}
