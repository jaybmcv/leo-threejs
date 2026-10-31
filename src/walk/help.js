import {toWorld,anchoredYaw} from '../plan/rooms.js';
// Help (H, or Help in the toolbar): how to play on foot, and, for testers (feedback is on in this browser), the tester
// guide: how a report becomes a change aboard, with a real report's before and after (the concession stand, ship log
// #123 in scripts/ship-log-media.json) and a way to go and see it. A keyboard gets the keys, a touch screen its
// on-screen controls; the "with others aboard" rows show only while Leo live is there.
const MEDIA='https://raw.githubusercontent.com/jaybmcv/leo-threejs/pr-media/';
const EXAMPLE={quote:'Can you add an L-shaped concession stand here that looks super fancy like this?',
 before:'feedback-issue-81/74ffeb1/tester-view-before.jpg',after:'feedback-issue-81/74ffeb1/tester-view-after.jpg',
 go:'?lv=1&at='+toWorld('d16-theater-5',[-20.29,0,-.42],{legacy:true}).join(',')+'&yaw='+209+'&pitch=-9&view=first'};

// Each row: the keys, then the touch control (null: none on that kind of screen), then what it does, and on a touch
// screen what it does there when that differs.
const PLAY=[
 {title:'Move',rows:[
  [['W','A','S','D'],'Left thumb','Walk (the arrow keys too)','Walk with the joystick'],
  [['Shift'],'Stick to its edge','Run'],
  [['Space'],'Jump','Jump: hold for height, press again in the air for a double jump'],
  [['C'],'Crouch','Crouch; while running, slide'],
  [['X'],null,'Lie flat'],
  [['Drag'],'Right thumb','Look around; scroll to bring the camera in or out','Drag to look around'],
  [['V'],'View','First or third person'],
 ]},
 {title:'Do things',rows:[
  [['E'],'Use','Use what’s in front of you: the prompt at the bottom says what (sit, lie down, play, read, climb in)','The orange button near something to use says what it does (sit, lie down, play, read, climb in)'],
  [['E'],'Use','Lifts: call one at its door, then pick a deck inside'],
  [['B'],'Emote','Emotes; 1 to 0 play one at once','Pick an emote to play'],
 ]},
 {title:'Get around',rows:[
  [['M'],'Go to','Go to: jump straight to a named place'],
  [['N'],'Mini-map','Ship map, deck by deck (or click the mini-map)','Tap it for the ship map, deck by deck'],
  [['L'],'Log','Ship log: every change to Leo, before and after'],
  [['R'],'Respawn','Respawn in the arrival hall'],
  [['Esc'],null,'Close any panel'],
 ]},
 {title:'With others aboard',live:true,rows:[
  [['T'],'Chat','Chat with everyone aboard (connect Discord if it asks)'],
  [['P'],'Ping','Ping where you stand, so others can find you'],
  [['Aboard'],'Aboard','Click the aboard count to set the name over your head; a teal dot marks a Discord-verified name','Tap the aboard count to set the name over your head; a teal dot marks a Discord-verified name'],
 ]},
];
const FIND=[
 ['Alien Cat Invasion','The telescope in the Deck 18 observation lounge, and the Hydro-Nip Lounge arcade on Deck 17'],
 ['Paw Pool','The Recreation hall’s table on Deck 16, and the same arcade'],
 ['Paws Off','A typing run on the Deck 16 exercise studio’s treadmills'],
 ['Hamster ball','Parked in the Deck 17 gardens: climb in and roll it round the ship, fast, with a hop on Space'],
 ['MCT transporters','Six three-seat carts in Deck 1’s Freight control: E at the front to drive one (WASD; hold Shift to run), E at the back to ride'],
 ['Group photo','The crown lounge camera counts down five seconds: get in the shot'],
 ['Comics and yarn','Comic books lying about to read, and neon balls of yarn to push'],
];
// The tester guide, as the printed one (minus its QR code: you're already aboard).
const STEPS=[
 ['You send it','1 minute','Press <b>Feedback</b>, then type it or say it.'],
 ['It gets sorted','A few hours','<b>Sonnet 5.5</b>, an AI agent, names it and sizes it.'],
 ['Team approves','Up to the team',null],
 ['Built and checked','Usually hours','<b>Opus 5.5</b>, the best AI model on the market, builds and checks it.'],
 ['Live on the ship','Overnight','Live by morning. Press <b>L</b> in Leo to see it in the ship log.'],
];
const DECISIONS=[['build','✓','Build it'],['plan','≡','Plan it first'],['','?','More info'],['','✕','No thanks']];
const TIPS=['Separate each idea clearly','Stand in-game where you want to see it','Explain what you want to see or fix'];

const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};

// sheet: the #help-sheet dialog. touch(): show the on-screen controls (asked at each opening). tester(): the tester
// guide is there. live(): Leo live is there. onLog(), onFeedback(): open those (Help closes first). onGo(search): go to a
// spot link's spot.
export function createHelp(sheet,{touch=()=>false,tester=()=>false,live=()=>false,onLog=()=>{},onFeedback=()=>{},onGo=()=>{}}={}){
 const tabs=sheet.querySelector('.help-tabs'),pages={play:sheet.querySelector('[data-page="play"]'),ideas:sheet.querySelector('[data-page="ideas"]')};
 let sections=[],playFor=null;
 function buildPlay(touch){
  playFor=touch;sections=[];pages.play.textContent='';
  const grid=el('div',{className:'help-grid'});
  for(const s of PLAY){
   const rows=s.rows.filter(r=>touch?r[1]:r[0]).map(([keys,control,text,touchText])=>el('div',{className:'help-row'},
    el('span',{className:'help-keys'},...(touch?[el('i',{textContent:control})]:keys.map(k=>el('kbd',{textContent:k})))),
    el('span',{textContent:touch&&touchText||text})));
   const box=el('section',{},el('h3',{textContent:s.title}),...rows);if(s.live)sections.push(box);grid.append(box);
  }
  pages.play.append(grid,el('h3',{className:'help-find-title',textContent:'Things to find'}),
   el('ul',{className:'help-find'},...FIND.map(([name,where])=>el('li',{},el('b',{textContent:name}),el('span',{textContent:where})))),
   ...touch?[]:[el('p',{className:'help-small',textContent:'H opens this again any time.'})]);
 }

 // The tester guide, built the first time it is shown (its pictures load then too).
 let built=false;
 function buildGuide(){
  built=true;
  const steps=el('ol',{className:'guide-steps'},...STEPS.map(([title,when,text],i)=>{
   const body=text?el('p',{innerHTML:text}):el('div',{className:'guide-decisions'},...DECISIONS.map(([kind,icon,label])=>el('span',{className:kind},el('i',{textContent:icon}),label)));
   return el('li',{className:i===STEPS.length-1?'live':''},el('span',{className:'n',textContent:String(i+1).padStart(2,'0')}),
    el('div',{className:'guide-step'},el('header',{},el('h4',{textContent:title}),el('span',{className:'when',textContent:when})),body));
  }));
  const log=el('button',{type:'button',className:'guide-link',textContent:'Open the ship log'});log.onclick=onLog;
  const hub=el('a',{className:'guide-link',href:'hub.html',target:'_blank',rel:'noopener',textContent:'Follow your ideas'});
  const see=el('button',{type:'button',className:'guide-link',textContent:'See it aboard'});see.onclick=()=>onGo(EXAMPLE.go);
  const shot=(kind,path,alt)=>el('figure',{className:kind},el('img',{src:MEDIA+path,alt,loading:'lazy',decoding:'async'}),el('figcaption',{textContent:kind}));
  const send=el('button',{type:'button',className:'guide-send',textContent:'Send feedback'});send.onclick=onFeedback;
  pages.ideas.append(
   el('div',{className:'eyebrow guide-eyebrow'},el('span',{textContent:'Tester guide'}),el('span',{textContent:'Feedback → ship'})),
   el('h3',{className:'guide-title'},'From your idea to ',el('em',{textContent:'the ship'})),
   el('p',{className:'guide-lead',textContent:'A real person reads every report, and the team decides what gets built.'}),
   steps,el('div',{className:'guide-after'},el('span',{textContent:'Not showing yet? Refresh the page.'}),log,hub),
   el('div',{className:'eyebrow guide-eyebrow'},el('span',{textContent:'Writing a good report'})),
   el('h3',{className:'guide-title small',textContent:'Plain words work'}),
   el('p',{className:'guide-lead',textContent:'Write it like you’d text a friend, and add a picture. This real report got built:'}),
   el('div',{className:'guide-quote'},el('blockquote',{textContent:EXAMPLE.quote}),
    el('div',{className:'guide-shots'},shot('before',EXAMPLE.before,'The Deck 16 theatre corner before: bare walls and floor'),shot('after',EXAMPLE.after,'The same corner after: a gold-fronted L-shaped concession stand with a lit menu')),
    el('div',{className:'guide-built'},el('span',{textContent:'✓ Built from one sentence and one picture'}),see)),
   el('ol',{className:'guide-tips'},...TIPS.map((t,i)=>el('li',{},el('b',{textContent:String(i+1)}),t))),
   el('div',{className:'guide-cta'},el('div',{},el('div',{className:'eyebrow',textContent:'Have an idea?'}),el('h4',{textContent:'Press Feedback, then type it or say it'})),send));
 }
 let page='play';
 function show(name){
  page=name;if(name==='ideas'&&!built)buildGuide();
  for(const [n,p] of Object.entries(pages))p.hidden=n!==name;
  for(const b of tabs.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===name));
  sheet.querySelector('.card').scrollTop=0;
 }
 for(const b of tabs.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>show(b.dataset.tab));
 return {
  // Opens on the page last shown (the guide only while this browser is a tester's).
  open(){
   const t=tester(),k=touch();if(k!==playFor)buildPlay(k);tabs.hidden=!t;for(const s of sections)s.hidden=!live();
   // Focus on the card, so the arrow and page keys scroll it.
   show(t?page:'play');sheet.hidden=false;sheet.querySelector('.card').focus({preventScroll:true});
  },
 };
}
