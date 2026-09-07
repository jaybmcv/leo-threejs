const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Shallow forward crown rake. Only height changes, including its attached glazing.
export const bowHeight=(x,y)=>y-4.5*smooth(120,240,x)*smooth(-15,35,y);
