import fs from 'node:fs/promises';
import path from 'node:path';
// The Mars Cats Voyage mark and the website's three typefaces (SIL OFL 1.1); the viewer loads them from ./brand/.
export async function copyBrandAssets(out){
 const dir=path.join(out,'brand');await fs.mkdir(dir,{recursive:true});
 for(const name of await fs.readdir('src/brand'))await fs.copyFile(path.join('src/brand',name),path.join(dir,name));
}
