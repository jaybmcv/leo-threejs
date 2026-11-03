import {MeshoptDecoder} from 'meshoptimizer/decoder';

// Lossless transport only: reconstruct the exact exported bytes before the
// guarded pack hydrator creates any geometry. No simplifier runs here.
export async function decodeAtriumGeometryTransport(manifest,chunks,{maxBinaryBytes=128*1024*1024,yieldMs=8,yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const transport=manifest?.transport,fail=message=>{throw Error('Atrium geometry transport: '+message);};
 if(transport?.format!=='leo-atrium-meshopt-v1'||!Array.isArray(transport.arrays)||!Array.isArray(manifest.arrays)||transport.arrays.length!==manifest.arrays.length)fail('invalid descriptor');
 if(!Number.isSafeInteger(manifest.binaryBytes)||manifest.binaryBytes<0||manifest.binaryBytes>maxBinaryBytes||!Number.isSafeInteger(transport.poolBytes)||transport.poolBytes<0||transport.poolBytes>256*1024*1024)fail('invalid buffer size');
 const ranges=[];
 for(const chunk of chunks){
  if(!(chunk.bytes instanceof Uint8Array)||!Number.isSafeInteger(chunk.offset)||chunk.offset<0||chunk.offset+chunk.bytes.length>transport.poolBytes)fail('invalid pool chunk');
  ranges.push({start:chunk.offset,end:chunk.offset+chunk.bytes.length,bytes:chunk.bytes});
 }
 ranges.sort((a,b)=>a.start-b.start);
 for(let i=1;i<ranges.length;i++)if(ranges[i].start<ranges[i-1].end)fail('overlapping pool chunks');
 const read=(start,length)=>{
  const first=ranges.find(range=>range.start<=start&&range.end>start);
  if(!first)fail('missing pool bytes');
  if(start+length<=first.end)return first.bytes.subarray(start-first.start,start-first.start+length);
  const bytes=new Uint8Array(length);let offset=0;
  for(const range of ranges){
   if(range.end<=start+offset)continue;
   if(range.start>start+offset)fail('missing pool span');
   const take=Math.min(length-offset,range.end-start-offset);
   bytes.set(range.bytes.subarray(start+offset-range.start,start+offset-range.start+take),offset);offset+=take;
   if(offset===length)return bytes;
  }
  fail('incomplete pool span');
 };
 await MeshoptDecoder.ready;
 const binary=new Uint8Array(manifest.binaryBytes);let previousEnd=0,lastYield=performance.now();
 for(let i=0;i<manifest.arrays.length;i++){
  const array=manifest.arrays[i],record=transport.arrays[i];
  if(!Number.isSafeInteger(array.offset)||array.offset<previousEnd||!Number.isSafeInteger(array.bytes)||array.bytes<=0||array.offset+array.bytes>binary.length)fail('invalid destination array');
  if(!record||!Number.isSafeInteger(record.start)||record.start<0||!Number.isSafeInteger(record.bytes)||record.bytes<=0||record.start+record.bytes>transport.poolBytes||
   !Number.isSafeInteger(record.count)||record.count<=0||!Number.isSafeInteger(record.stride)||record.stride<=0||record.stride>256||
   !Number.isSafeInteger(record.rawStride)||record.rawStride<=0||record.rawStride>record.stride||record.count*record.rawStride!==array.bytes)fail('invalid encoded array');
  const encoded=read(record.start,record.bytes),destination=binary.subarray(array.offset,array.offset+array.bytes);
  if(record.encoding==='index'){
   if(![2,4].includes(record.stride)||record.rawStride!==record.stride)fail('invalid index stride');
   MeshoptDecoder.decodeIndexSequence(destination,record.count,record.stride,encoded);
  }else if(record.encoding==='vertex'){
   if(record.stride%4)fail('unaligned vertex stride');
   const target=record.rawStride===record.stride?destination:new Uint8Array(record.count*record.stride);
   MeshoptDecoder.decodeVertexBuffer(target,record.count,record.stride,encoded);
   if(target!==destination)for(let row=0;row<record.count;row++)destination.set(target.subarray(row*record.stride,row*record.stride+record.rawStride),row*record.rawStride);
  }else fail('unknown codec');
  previousEnd=array.offset+array.bytes;
  if(performance.now()-lastYield>=yieldMs){await yieldWork();lastYield=performance.now();}
 }
 if(previousEnd!==binary.length)fail('unreferenced payload tail');
 return binary;
}
