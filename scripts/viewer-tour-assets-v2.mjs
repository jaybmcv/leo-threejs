// Extract existing fittings only: this never rebuilds or moves source ship geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {NodeIO,Logger} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
const REVISION=2;
export const VIEWER_LOUNGE='leo-viewer-lounge.glb';
export async function extractViewerLounge(bytes){await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}),doc=await io.readBinary(bytes);doc.setLogger(new Logger(Logger.Verbosity.SILENT));const root=doc.getRoot(),anchor=root.listNodes().find(n=>n.getName()==='Shared_observation_lounge_and_approach');if(!anchor)throw Error('Viewer lounge source anchor missing');const extras=root.listNodes().filter(n=>n.getName()==='V2_shell_observation-lounge'),parts=[anchor,...extras],worlds=parts.map(n=>n.getWorldMatrix());for(const n of parts)n.getParentNode()?.removeChild(n);for(const s of root.listScenes())s.dispose();const scene=doc.createScene('V2_viewer_observation_lounge');root.setDefaultScene(scene);parts.forEach((n,i)=>{scene.addChild(n);n.setMatrix(worlds[i]);});for(const ext of root.listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();await doc.transform(prune());
 // A serialization round-trip drops detached extension properties before the final accessor prune.
 const compact=await io.readBinary(await io.writeBinary(doc));compact.setLogger(new Logger(Logger.Verbosity.SILENT));await compact.transform(prune());return Buffer.from(await io.writeBinary(compact));}
export async function writeViewerLounge({out,sourceFile,bytes,sourceHash,readBytes}){const hash=b=>createHash('sha256').update(b).digest('hex');sourceHash??=bytes?hash(bytes):hash(await fs.readFile(sourceFile));const dir=path.join(out,'viewer-assets');await fs.mkdir(dir,{recursive:true});const cache=path.join(dir,'lounge-source.json');let packed;try{const old=JSON.parse(await fs.readFile(cache,'utf8'));if(old.revision===REVISION&&old.sourceHash===sourceHash){const b=await fs.readFile(path.join(out,old.entry.parts[0].split('?')[0]));if(hash(b)===old.transportHash)return old.entry;}}catch{}packed=await extractViewerLounge(bytes||(readBytes?await readBytes():await fs.readFile(sourceFile)));const gz=gzipSync(packed,{level:9}),file='viewer-assets/lounge.'+hash(gz).slice(0,16)+'.bin';await fs.writeFile(path.join(out,file),gz);const entry={transport:'gzip',parts:[file],bytes:packed.length,compressedBytes:gz.length,sha256:hash(packed),sourceSha256:sourceHash};await fs.writeFile(cache,JSON.stringify({revision:REVISION,sourceHash,transportHash:hash(gz),entry}));return entry;}
