import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const dir='src/assets/accepted-exterior';
const names=(await fs.readdir(dir)).sort((a,b)=>parseInt(a)-parseInt(b));
const data=gunzipSync(Buffer.concat(await Promise.all(names.map(n=>fs.readFile(dir+'/'+n)))));
const expected='8971e14e0e72951880811b8a7e4f3e57310a733a9d990ba3a2ae2eec4ebabfee';
if(createHash('sha256').update(data).digest('hex')!==expected)throw new Error('Accepted exterior source failed integrity check');
const out='output/leo-interior-v01/leo-exterior.glb';
await fs.mkdir('output/leo-interior-v01',{recursive:true});
let existing;try{existing=await fs.readFile(out);}catch{}
if(existing&&createHash('sha256').update(existing).digest('hex')!==expected)throw new Error('Existing baseline differs; refusing to overwrite it');
if(!existing)await fs.writeFile(out,data);
console.log('Accepted exterior source verified.');
