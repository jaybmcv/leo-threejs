import fs from 'node:fs/promises';
import path from 'node:path';
// The Mars Cats Voyage mark and the website's three typefaces (SIL OFL 1.1); the viewer loads them from ./brand/.
export async function copyBrandAssets(out){
 // Start from an empty folder so files dropped from src/brand (like the old .ttf fonts) do not linger in builds.
 const dir=path.join(out,'brand');await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(dir,{recursive:true});
 for(const name of await fs.readdir('src/brand'))await fs.copyFile(path.join('src/brand',name),path.join(dir,name));
}
