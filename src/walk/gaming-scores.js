// Read the games' existing boards and browser bests. This display never writes scores.
const shared=new Map();
export function hearGamingBoard(id,board){
 if(!['board','top'].includes(board?.op||board?.m)||!Array.isArray(board.top))return;
 shared.set(id,board.top);
}
const stored=(key,fallback)=>{try{return JSON.parse(globalThis.localStorage?.getItem(key)||'null')??fallback;}catch{return fallback;}};
const points=n=>Number.isFinite(n)&&n>0;
const local=(value,field='score')=>points(value)?[{name:'You · browser best',[field]:value}]:[];
const seconds=ms=>(ms/1000).toFixed(1)+' s';
export function gamingBoards(){
 const darts=stored('leo-darts-best',[]),repair=stored('leo-mct-repair-times-v1',[]);
 const board=(id,title,rows,field='score',format=n=>Number(n.toFixed(0)).toLocaleString())=>{
  const top=shared.get(id),online=top?.length>0,source=online?top:rows;
  return {id,title,scope:online?'LEO LIVE':'THIS BROWSER',rows:(Array.isArray(source)?source:[]).filter(r=>typeof r?.name==='string'&&Number.isFinite(r[field])&&r[field]>=0).slice(0,5).map(r=>({name:r.name,value:format(r[field])}))};
 };
 return [
  board('invasion','Alien Cat Invasion',[]),
  board('pool','Paw Pool',[],'ms',seconds),
  board('pinball','Leo Pinball',local(stored('leo-pinball-best',0))),
  board('maze','Container Maze',local(stored('leo-maze-best',0),'ms'),'ms',seconds),
  board('treasure','Aquarium Treasure',local(stored('leo-aquarium-best',0),'ms'),'ms',seconds),
  board('darts','Nine-dart Challenge',Array.isArray(darts)?darts.filter(Number.isFinite).map(score=>({name:'You · browser round',score})):[]),
  board('emergency','Emergency Drill',local(stored('leo-emergency-drill-best-v1',0))),
  board('repair','MCT Repairs',Array.isArray(repair)?repair.filter(r=>Number.isFinite(r?.time)&&typeof r.date==='string').map(r=>({name:'You · '+r.date,time:r.time})):[],'time',s=>seconds(s*1000)),
  board('paws-off','Paws Off',local(stored('leo-paws-off-best',0),'time'),'time',s=>seconds(s*1000)),
 ];
}
