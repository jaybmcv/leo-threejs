import {writeViewerLounge,VIEWER_LOUNGE} from './viewer-tour-assets-v2.mjs';
import {readPublicModel} from './shared-model-transport-v2.mjs';
// Only bundles the viewer; never exports geometry or runs the walk producer.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeViewerPageV2} from './viewer-page-v2.mjs';
export async function buildViewerReview({base,out='output/phase7/viewer-review'}={}){if(!base)throw Error('Pass --base=<frozen build folder>');const root=path.resolve(out),workspace=process.cwd()+path.sep;if(!root.startsWith(workspace))throw Error('Review output must be inside this workspace');let layoutInput=path.join(base,'output/layout.json');try{await fs.access(layoutInput);}catch{layoutInput=path.join(base,'output/leo-interior-v02/layout.json');}const layout=JSON.parse(await fs.readFile(layoutInput,'utf8')),manifest=JSON.parse(await fs.readFile(path.join(base,'dist-v2/asset-manifest.json'),'utf8'));manifest[VIEWER_LOUNGE]=await writeViewerLounge({out:root,sourceHash:manifest['leo-full-ship.glb'].sha256,readBytes:()=>readPublicModel(manifest['leo-full-ship.glb'],path.join(base,'dist-v2'))});const result=await writeViewerPageV2(root,{layout,manifest});await fs.writeFile(path.join(root,'review-build.json'),JSON.stringify(result,null,2));return result;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7);console.log(await buildViewerReview({base}));}
