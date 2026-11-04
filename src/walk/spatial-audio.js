// Point sounds use the camera as the listener. Existing gain controls keep their distance and mute rules.
export function createSpatial(ctx){
 const p=ctx.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.rolloffFactor=0;p.connect(ctx.destination);return p;
}
function vector(node,keys,values,time,legacy){
 if(node[keys[0]])keys.forEach((key,i)=>node[key].setTargetAtTime(values[i],time,.05));
 else legacy(...values);
}
export function updateSpatial(ctx,p,camera,source){
 if(!camera)return;
 camera.updateMatrixWorld(true);const m=camera.matrixWorld.elements,t=ctx.currentTime,l=ctx.listener;
 vector(p,['positionX','positionY','positionZ'],[source.x,source.y,source.z],t,(...v)=>p.setPosition(...v));
 vector(l,['positionX','positionY','positionZ'],[m[12],m[13],m[14]],t,(...v)=>l.setPosition(...v));
 if(l.forwardX){
  ['forwardX','forwardY','forwardZ','upX','upY','upZ'].forEach((key,i)=>l[key].setTargetAtTime([-m[8],-m[9],-m[10],m[4],m[5],m[6]][i],t,.05));
 }else l.setOrientation(-m[8],-m[9],-m[10],m[4],m[5],m[6]);
}
