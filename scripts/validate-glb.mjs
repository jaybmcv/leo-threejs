import fs from 'node:fs/promises';
import validator from 'gltf-validator';
const results=[];
for(const file of ['leo-full-ship.glb','leo-exterior.glb','leo-exterior-refined.glb','leo-neighborhood.glb','leo-service-areas.glb','leo-residential-decks.glb','leo-garden-commons.glb','leo-transit.glb','leo-aft-systems.glb']) {
  const bytes=await fs.readFile(`output/leo-interior-v01/${file}`);
  const result=await validator.validateBytes(new Uint8Array(bytes),{uri:file,maxIssues:1000,ignoredIssues:['UNUSED_OBJECT']});
  results.push({file,errors:result.issues.numErrors,warnings:result.issues.numWarnings,info:result.info,issues:result.issues.messages});
  console.log(file,JSON.stringify({errors:result.issues.numErrors,warnings:result.issues.numWarnings,truncated:result.issues.truncated,messages:result.issues.messages.slice(0,5)}));
  if(result.issues.numErrors)process.exitCode=1;
}
await fs.writeFile('output/leo-interior-v01/glb-validation.json',JSON.stringify(results,null,2));
