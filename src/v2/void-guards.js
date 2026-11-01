import * as T from 'three';
// The raster planner cannot represent pointed or oblique atrium edges. Sample the actual void perimeter against the same ground and wall colliders used by the walker.
export function planVoidGuards(layout,col,{step=.2,existing=[]}={}){
 const rows=[],ray=new T.Ray(),ground=col.raycastGround||col.raycast;
 const supported=(x,y,z)=>{ray.origin.set(x,y+.45,z);ray.direction.set(0,-1,0);const h=ground.call(col,ray,1.45);return !!h&&h.normal.y>.64&&Math.abs(h.point.y-y)<.42;};
 const blocked=(p,y,n)=>[.95,1.55].every(h=>{ray.origin.set(p[0]-n[0]*.3,y+h,p[1]-n[1]*.3);ray.direction.set(n[0],0,n[1]);return !!col.raycast(ray,.6);});
 for(const d of layout.decks)for(const hole of d.slab.holes.filter(h=>h.kind!=='lift'&&h.kind!=='stairs'&&!layout.circulation?.lifts?.some(l=>l.deck===d.number&&l.id===h.id)&&!/(lift|stairs|aft-opening)/i.test(h.id))){
  let ring=hole.polygon.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-7),changed=true;
  while(changed&&ring.length>3){changed=false;ring=ring.filter((b,i,a)=>{const p=a[(i+a.length-1)%a.length],q=a[(i+1)%a.length],u=[b[0]-p[0],b[1]-p[1]],v=[q[0]-b[0],q[1]-b[1]],keep=Math.abs(u[0]*v[1]-u[1]*v[0])>1e-7||u[0]*v[0]+u[1]*v[1]<0;if(!keep)changed=true;return keep;});}
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.04)continue;const n=[-dz/len,dx/len],count=Math.ceil(len/step),point=t=>[a[0]+dx*t,a[1]+dz*t];let start=null,side=0;
   const emit=t=>{if(start===null)return;const p=point(start),q=point(t);if(Math.hypot(q[0]-p[0],q[1]-p[1])>.04)rows.push([d.number,2,p[0]+n[0]*side*.025,q[0]+n[0]*side*.025,p[1]+n[1]*side*.025,d.y,q[1]+n[1]*side*.025]);start=null;};
   for(let k=0;k<=count;k++){let next=0;if(k<count){const p=point((k+.5)/count),L=supported(p[0]+n[0]*.25,d.y,p[1]+n[1]*.25),R=supported(p[0]-n[0]*.25,d.y,p[1]-n[1]*.25);const covered=existing.some(r=>Math.abs(r[5]-d.y)<.02&&(Math.abs(dz)<1e-7&&r[1]===0&&Math.abs(r[4]-p[1])<.1&&p[0]>=r[2]-.02&&p[0]<=r[3]+.02||Math.abs(dx)<1e-7&&r[1]===1&&Math.abs(r[4]-p[0])<.1&&p[1]>=r[2]-.02&&p[1]<=r[3]+.02));if(L!==R&&!covered&&!blocked(p,d.y,n))next=L?1:-1;}if(next!==side){emit(k/count);side=next;if(next)start=k/count;}}
  }
 }return rows;
}

export function replaceRasterVoidGuards(rows,exact){const diagonal=exact.filter(r=>Math.abs(r[3]-r[2])>1e-6&&Math.abs(r[6]-r[4])>1e-6),distance=(p,r)=>{const dx=r[3]-r[2],dz=r[6]-r[4],t=Math.max(0,Math.min(1,((p[0]-r[2])*dx+(p[1]-r[4])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-r[2]-t*dx,p[1]-r[4]-t*dz);};return [...rows.filter(row=>!diagonal.some(r=>r[0]===row[0]&&Math.abs(r[5]-row[5])<.02&&[row[2],row[3]].every(a=>distance(row[1]?[row[4],a]:[a,row[4]],r)<.4))),...exact];}
