import fs from 'node:fs/promises';
export async function ensureV2Output(){for(const dir of ['output/leo-interior-v02','output/phase3','output/phase3b/startup'])await fs.mkdir(dir,{recursive:true});}
if(process.env.LEO_LAYOUT==='2')await ensureV2Output();
