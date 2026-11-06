// ?fps=1: a small readout of how the walk is running, for testing on a phone without a debugger. Twice a second it
// shows frames a second, the median and slowest-in-ten frame, the main pass's draws and triangles, and the pixel ratio.
export function createFrameReadout(renderer){
 if(new URLSearchParams(location.search).get('fps')!=='1')return null;
 const box=document.createElement('div');
 box.style.cssText='position:fixed;left:6px;bottom:6px;z-index:9999;padding:3px 6px;border-radius:4px;background:rgba(0,0,0,.7);color:#9f9;font:11px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre';
 document.body.appendChild(box);
 let frames=[],from=0,last=0;
 return {frame(now){
  if(last)frames.push(now-last);last=now;if(!from)from=now;if(now-from<500)return;
  const f=frames.sort((a,b)=>a-b),median=f[f.length>>1]||0,p90=f[Math.floor(f.length*.9)]||0,{calls,triangles}=renderer.info.render;
  box.textContent=`${(f.length*1000/(now-from)).toFixed(1)} fps  ${median.toFixed(0)}/${p90.toFixed(0)} ms\n${calls} draws  ${(triangles/1e6).toFixed(2)}M tris  ×${renderer.getPixelRatio().toFixed(2)}`;
  frames=[];from=now;
 }};
}
