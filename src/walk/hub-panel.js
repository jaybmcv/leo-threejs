// The Builder's Hub on top of the walk: hub.html in a frame, so a tester can follow their ideas without leaving the ship
// or building it again. The frame exists only while it's open. It's the same site, so it shares this tab's Discord pass
// and drafts. While it's open the walk stands still, as it does in a background tab (main.js).
//   open({report})   show it, on that report if given
// Discord's sign-in can't run in a frame, so connecting leaves the page; this notes to come back here once the ship is ready.
const COME_BACK='leo-hub-reopen';
const PASSED_ON=['hub','creamery'];
export function createHubPanel({onOpen=()=>{},onClose=()=>{},onGo=()=>false,onConnect=()=>{}}={}){
 let sheet=null,frame=null,lastReport=null;
 function open({report=null}={}){
  if(sheet)return;
  lastReport=report;
  const query=new URLSearchParams({embed:'1'}),here=new URLSearchParams(location.search);
  if(report)query.set('r',report);
  for(const k of PASSED_ON)if(here.has(k))query.set(k,here.get(k));
  frame=Object.assign(document.createElement('iframe'),{src:`hub.html?${query}`,title:'Builder’s Hub'});
  const shut=Object.assign(document.createElement('button'),{type:'button',className:'hub-panel-close',textContent:'Back to Leo'});
  shut.addEventListener('click',close);
  sheet=Object.assign(document.createElement('div'),{id:'hub-panel'});
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Builder’s Hub');
  sheet.append(frame,shut);document.body.append(sheet);
  onOpen();
  frame.addEventListener('load',()=>{try{frame?.contentWindow?.focus();}catch{}},{once:true});
 }
 function close(){
  if(!sheet)return;
  sheet.remove();sheet=null;frame=null;onClose();
 }
 // Only the frame this opened may ask for anything.
 addEventListener('message',e=>{
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;
  const kind=e.data?.kind;
  if(kind==='hub-close')close();
  else if(kind==='hub-go'&&typeof e.data.search==='string'){close();onGo(e.data.search);}
  else if(kind==='hub-connect'){
   try{sessionStorage.setItem(COME_BACK,lastReport||'1');}catch{}
   onConnect();
  }
 });
 addEventListener('keydown',e=>{if(sheet&&e.key==='Escape')close();});
 return {
  open,close,
  isOpen:()=>!!sheet,
  // Back from Discord, with the ship built again: pick up where they were.
  resume(){
   let kept=null;try{kept=sessionStorage.getItem(COME_BACK);sessionStorage.removeItem(COME_BACK);}catch{}
   if(kept)open({report:kept==='1'?null:kept});
  },
 };
}
