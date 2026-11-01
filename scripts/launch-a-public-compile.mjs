import fs from 'node:fs/promises';
process.env.LEO_LAYOUT='2';
const {writeWalkPage}=await import('./walk-page.mjs');
import {publicPreparedAdapters} from './public-walk-adapters-v2.mjs';
const out='output/launch-a/public-check',manifest=JSON.parse(await fs.readFile('output/launch-a/base/asset-manifest.json')),cosmo=(await fs.readdir('output/launch-a/base')).find(f=>/^cosmo\./.test(f));
const result=await writeWalkPage(out,{cosmo,manifest,preparedWalk:true,sourceAdapters:publicPreparedAdapters});
await fs.writeFile('output/launch-a/public-compile-full.json',JSON.stringify({...result,preparedArtifact:manifest['walk-prepared'].sha256,mode:'normal production walk-page producer, full ship log, frozen geometry'},null,2));
console.log(result);
