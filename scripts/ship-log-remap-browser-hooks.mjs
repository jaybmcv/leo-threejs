import assert from 'node:assert/strict';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function remapBrowserHooks(source){
 const get=(pattern,label)=>{const m=pattern.exec(source);assert(m,'Public walk '+label+' signature changed; update the diagnostic hook');return m;};
 const remap=get(/function ([$\w]+)\(([$\w]+)\)\{if\(!\2\|\|\2\.resolved\)return \2;if\(\2\.lv!==void 0&&\2\.lv!==1\)/,'remap')[1];
 const read=get(/function ([$\w]+)\(([$\w]+)=location.search\)/,'link reader')[1];
 const stand=get(/function ([$\w]+)\(([$\w]+),([ $\w]+),\{radius:([$\w]+)=8\}=\{\}\)\{/,'findStand')[1];
 const start=source.indexOf('function '+stand+'('),end=source.indexOf('function ',start+10),body=source.slice(start,end);
 const ray=/let ([$\w]+)=new ([$\w]+),([$\w]+)=new ([$\w]+)\(new ([$\w]+),new \5\)/.exec(body);assert(ray,'Native ray/capsule constructors changed');
 const size=/\{radius:[$\w]+,height:[$\w]+,step:[$\w]+\}=([$\w]+),/.exec(body);assert(size,'Native body signature changed');
 const layout=/return ([$\w]+)\(([$\w]+),[$\w]+,[$\w]+,[$\w]+,[$\w]+\)\?/.exec(body)?.[2];assert(layout,'Native standing policy changed');
 const initial=get(new RegExp('([$\\w]+)='+escape(remap)+'\\('+escape(read)+'\\(\\)\\),([$\\w]+)=\\1&&'+escape(stand)+'\\(([$\\w]+),\\1\\.at\\);([$\\w]+)\\.place\\('),'initial placement');
 const follow=/;([$\w]+)\.yaw=/.exec(source.slice(initial.index,initial.index+600))?.[1];assert(follow,'Initial camera signature changed');
 const go=get(new RegExp('function ([$\\w]+)\\(([$\\w]+)\\)\\{return \\2='+escape(remap)+'\\(\\2\\),'),'Go there')[1];
 const boards=get(/([$\w]+)\.nearby\([ $\w]+\)\.length/,'nearby')[1];
 const log=get(new RegExp('new Map\\(([$\\w]+)\\.map\\([ $\\w]+=>\\[[\\s\\S]{0,300}'+escape(remap)+'\\('+escape(read)+'\\('),'log position index')[1];
 const legacyRoom=get(/\.room\|\|([$\w]+)\([ $\w]+\.at,\{legacy:!0\}\)/,'legacy room')[1];
 return {legacyRoom,remap,read,stand,ray:ray[2],line:ray[4],vector:ray[5],body:size[1],layout,colliders:initial[3],controller:initial[4],follow,go,boards,log};
}
