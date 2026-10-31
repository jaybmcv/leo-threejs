// Selection is a build input, never a runtime URL option.
export const layoutVersion=process.env.LEO_LAYOUT==='2'?2:1;
if(process.env.LEO_LAYOUT&&!['1','2'].includes(process.env.LEO_LAYOUT))throw new Error('LEO_LAYOUT must be 1 or 2');
export const v2=layoutVersion===2;
export const modelOutput=v2?'output/leo-interior-v02':'output/leo-interior-v01';
export const publicOutput=v2?'dist-v2':'dist';

if(v2)await (await import('./v2-output.mjs')).ensureV2Output();
