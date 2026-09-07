const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Shallow forward crown rake. Only height changes, including its attached glazing.
export const bowHeight=(x,y)=>{
  const crown=4.5*smooth(120,240,x)*smooth(-15,35,y);
  // Ease the lower cheek and roll the underside upward toward the bow. Keep
  // the crown and all X/Z coordinates fixed; attached surfaces share this map.
  const cheek=1.8*smooth(220,282,x)*smooth(-22,-4,y)*(1-smooth(18,35,y));
  const underside=2.8*smooth(228,278,x)*(1-smooth(-38,-24,y));
  return y-crown-cheek+underside;
};
