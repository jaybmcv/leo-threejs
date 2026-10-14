import * as T from 'three';
/** Exact rigid boot contact. The general body probe approximates blended skin
 * vertices; donor ankle angles expose that approximation as a floating sole. */
export class DLCatShoeContact {
  private readonly samples:Array<{bone:T.Bone;points:Float32Array}>=[];
  constructor(meshes:readonly T.SkinnedMesh[]){
    const points=new Map<T.Bone,number[]>();
    for(const mesh of meshes){
      const ids=mesh.geometry.getAttribute('skinIndex');
      for(let i=0;i<ids.count;i++){
        const bone=mesh.skeleton.bones[ids.getX(i)]!;
        const name=String(bone.userData.originalName??bone.name);
        if(!/^(?:foot|toe)(?:\.[LR]|[LR])$/.test(name))continue;
        const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(bone.matrixWorld.clone().invert());
        const list=points.get(bone)??[];list.push(p.x,p.y,p.z);points.set(bone,list);
      }
    }
    for(const [bone,values] of points)this.samples.push({bone,points:new Float32Array(values)});
  }
  lowestY(side?:'L'|'R'){
    let low=Infinity;
    for(const {bone,points} of this.samples){if(side&&!String(bone.userData.originalName??bone.name).endsWith(side))continue;const e=bone.matrixWorld.elements;for(let i=0;i<points.length;i+=3)low=Math.min(low,e[1]!*points[i]!+e[5]!*points[i+1]!+e[9]!*points[i+2]!+e[13]!);}
    return low;
  }
}

