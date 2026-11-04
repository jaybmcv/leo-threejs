// Only the ridden ball on Deck 17 rebounds. Speeds are metres per second; no upward kick is added.
export const BALL_BOUNCE={restitution:.35,maxSpeed:2.4,minSpeed:.8,drag:6,seconds:.18};
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
