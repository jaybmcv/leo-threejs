// Only the ridden ball on Deck 17 rebounds: a firm hit springs back at about half its speed (capped) and steering
// waits out the recoil. Speeds are metres per second; no upward kick is added.
export const BALL_BOUNCE={restitution:.55,maxSpeed:4.6,minSpeed:.8,drag:4,seconds:.45};
export const ballBounce=(inside,deck)=>inside&&deck===17?BALL_BOUNCE:null;

// Find a clear walk off the ball, checking the whole short path so a wall or floor edge cannot be skipped.
export function ballDismount(p,yaw,reach,stand){
 const distance=reach+.1,steps=Math.ceil(distance/.2);
 for(let i=0;i<16;i++){
  const a=yaw+i*Math.PI/8,dx=Math.sin(a),dz=Math.cos(a);let q=null;
  for(let j=1;j<=steps;j++){
   const d=distance*j/steps;q=stand([p.x+dx*d,p.y,p.z+dz*d]);
   if(!q||Math.abs(q.y-p.y)>.4){q=null;break;}
  }
  if(q)return q;
 }
 return null;
}
