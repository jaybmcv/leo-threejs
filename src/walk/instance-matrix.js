// InstancedMesh matrices live in Float32 storage. Compare the values that would
// actually be uploaded, so an unchanged double-precision transform stays clean.
export function setInstanceMatrixIfChanged(mesh,index,matrix){
 const array=mesh.instanceMatrix.array,elements=matrix.elements,offset=index*16;
 for(let i=0;i<16;i++)if(!Object.is(array[offset+i],Math.fround(elements[i]))){
  mesh.setMatrixAt(index,matrix);mesh.instanceMatrix.needsUpdate=true;return true;
 }
 return false;
}
