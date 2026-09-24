import * as THREE from 'three';
export function preloadDLCatData(): Promise<HTMLImageElement[]>;
export interface DLCatAsset {
  root: THREE.Group;
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: THREE.AnimationClip[];
  motionClips: THREE.AnimationClip[];
  meshes: THREE.SkinnedMesh[];
  sourceBounds: THREE.Box3;
  bounds: THREE.Box3;
  stats: {meshes:number;triangles:number;materials:number;textures:number;bones:number;animationClips:number;motionClips:number};
  play(name?:string):boolean;
  stop():void;
  update(dt:number):void;
  dispose():void;
}
export function createDLCat(options?: {height?:number|null;castShadow?:boolean;receiveShadow?:boolean;onProgress?:(value:{loaded:number;total:number})=>void}):Promise<DLCatAsset>;
