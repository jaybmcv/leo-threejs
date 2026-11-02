import fs from 'node:fs/promises';
export async function requireBuildSpace(){const s=await fs.statfs(process.cwd()),free=s.bavail*s.bsize;if(free<15*2**30)throw Error('Build stopped: keep at least 15 GiB free in the checkout volume; clear stale generated revisions first.');return free;}
