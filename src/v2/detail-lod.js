import * as T from 'three';

// Static phase-4 props only. Keep their original matrices and collision/seat
// records; omit only subpixel instances or conservatively offscreen bounds.
export function detailBounds(mesh,matrices){
 // Prepared meshes share vertex pools; their supplied bounds cover only the
 // vertices used by this mesh. Recomputing would include unrelated geometry.
 if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();mesh.updateWorldMatrix(true,false);
 const sphere=mesh.geometry.boundingSphere,world=new T.Matrix4(),centre=new T.Vector3();
 const bounds=new Float32Array(matrices.length/4);
 for(let i=0;i<matrices.length/16;i++){
  world.fromArray(matrices,i*16).premultiply(mesh.matrixWorld);
  centre.copy(sphere.center).applyMatrix4(world);const e=world.elements;
  // Frobenius norm also bounds scale under shear; an overestimate is safe.
  const scale=Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);
  bounds.set([centre.x,centre.y,centre.z,sphere.radius*scale],i*4);
 }
 return bounds;
}

export function detailVisible(bounds,index,camera,pixelScale,wasVisible,minPixels=.75){
 if(!camera.isPerspectiveCamera||minPixels<=0)return true;
 const i=index*4,x=bounds[i],y=bounds[i+1],z=bounds[i+2],r=bounds[i+3],m=camera.matrixWorldInverse.elements;
 const depth=-(m[2]*x+m[6]*y+m[10]*z+m[14]);
 if(depth<=r+camera.near)return true;
 // Nearest point of the sphere gives a conservative projected diameter.
 // Hysteresis prevents tiny details flickering at the cutoff.
 const viewX=m[0]*x+m[4]*y+m[8]*z+m[12],viewY=m[1]*x+m[5]*y+m[9]*z+m[13];
 // Off-axis perspective can enlarge the projected silhouette as well.
 const pixels=2*r*pixelScale/(depth-r)*(1+Math.hypot(viewX,viewY)/(depth-r));
 return pixels>=minPixels*(wasVisible ? .72 : 1);
}

export function detailInFrustum(bounds,index,frustum,eye=null){
 const i=index*4,x=bounds[i],y=bounds[i+1],z=bounds[i+2];let r=bounds[i+3];
 // Cover ordinary motion between owner queries. Larger turns/translations
 // force an immediate update through the matching view guard below.
 if(eye)r+=2+.15*Math.hypot(x-eye.x,y-eye.y,z-eye.z);
 for(const p of frustum.planes)if(p.normal.x*x+p.normal.y*y+p.normal.z*z+p.constant < -r)return false;
 return true;
}

export function createDetailViewGuard(){
 const previous=new Float64Array(16),projection=new Float64Array(16);let ready=false;
 return{
  changed(camera){
   if(!ready)return true;const m=camera.matrixWorld.elements;
   return (m[12]-previous[12])**2+(m[13]-previous[13])**2+(m[14]-previous[14])**2>4
    ||m[8]*previous[8]+m[9]*previous[9]+m[10]*previous[10]<.9903
    ||m[4]*previous[4]+m[5]*previous[5]+m[6]*previous[6]<.9903
    ||camera.projectionMatrix.elements.some((v,i)=>v!==projection[i]);
  },
  commit(camera){previous.set(camera.matrixWorld.elements);projection.set(camera.projectionMatrix.elements);ready=true;},
 };
}
