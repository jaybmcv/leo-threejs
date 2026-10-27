import {setFrameOverride} from './rooms.js';
// This entire branch is removed from the public walk by esbuild's false define.
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__){
 const value=new URLSearchParams(globalThis.location?.search||'').get('anchorTest');
 if(value){const m=/^([^:]+):(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)(,m)?$/.exec(value);if(!m)throw new Error('Invalid anchorTest');setFrameOverride(m[1],{dx:+m[2],dz:+m[3],yawDeg:+m[4],mirror:!!m[5]});}
}
