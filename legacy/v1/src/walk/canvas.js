let factory=null;
export const installWalkCanvas=f=>{factory=f;};
export const hasWalkCanvas=()=>typeof document!=='undefined'||!!factory;
export const walkCanvas=()=>typeof document!=='undefined'?document.createElement('canvas'):factory?factory(1,1):null;
