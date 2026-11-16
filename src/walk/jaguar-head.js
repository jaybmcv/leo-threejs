import * as T from 'three';

const hill=(x,y,cx,cy,rx,ry,h)=>h*Math.exp(-2*(((x-cx)/rx)**2+((y-cy)/ry)**2));
// These are the retained mouth coordinates, including the standing clearance above the arch.
const mouthAt=u=>{const k=Math.min(u,1-u)/.3,sx=u<.5?-1:1;
 if(k<1)return [sx*(1.05-.05*k),1.95*k];
 const x=(u-.5)/.2;return [x,1.95+.4*(1-Math.abs(x)**5)**.2];};
const outline=u=>{const k=Math.min(u,1-u)/.3,sx=u<.5?-1:1;
 if(k<1)return [sx*(2.05+.25*(1-k)**1.6),3.17*k];
 const c=(u-.5)/.2,x=2.05*c,t=(Math.abs(x)-1.7)/.35;
 const skull=1.35+2.1*Math.sqrt(1-c**4),ear=Math.abs(t)<=1?3.17+.46*Math.sqrt(1-t*t):0;
 return [x,Math.max(skull,ear)];};
// Brow, nose, curled lip, cheeks and the split jaw belong to the same skin.
const relief=(x,y)=>{x=Math.abs(x);return .22
 +hill(x,y,0,3.17,1.4,.62,.65)+hill(x,y,0,2.98,.4,.45,.18)
 +hill(x,y,1.18,3.04,.62,.38,.75)+hill(x,y,1.18,3.19,.53,.15,.28)-hill(x,y,1.18,3,.36,.13,.16)
 +hill(x,y,.43,2.61,.63,.27,.65)+hill(x,y,0,2.78,.39,.24,.65)+hill(x,y,1.19,2.65,.32,.3,.55)
 +hill(x,y,.62,2.39,.7,.12,.4)+hill(x,y,1.43,1.9,.6,.9,.5)
 +hill(x,y,1.57,.18,.6,.3,.65)+hill(x,y,1.87,.65,.46,.8,.4)
 +hill(x,y,1.78,3.35,.32,.38,.24)-hill(x,y,1.78,3.35,.18,.22,.28);};

export function jaguarHeadGeometry(){
 const NU=96,FRONT=10,REAR=2,WALL=2,M=FRONT+REAR+WALL,p=[],uv=[],faces=[[],[],[],[]];
 // Build the left half once, then reflect it using the same vertex indices at the crown.
 for(let i=0;i<=NU/2;i++){
  const [mx,my]=mouthAt(i/NU),[ox,oy]=outline(i/NU),point=s=>[mx+(ox-mx)*s,my+(oy-my)*s];
  const front=s=>{const [x,y]=point(s);return [x,y,.03+relief(x,y)*Math.sqrt(1-s**4)];};
  const rear=s=>{const [x,y]=point(s);return [x,y,-(1.35+.25*Math.exp(-(((y-1.3)/1.6)**2)))*Math.sqrt(1-s**4)];};
  const f=front(0),b=rear(0);
  for(let r=0;r<M;r++){
   const v=r<=FRONT?front(r/FRONT):r<=FRONT+REAR?rear((FRONT+REAR-r)/REAR):b.map((n,k)=>n+(f[k]-n)*(r-FRONT-REAR)/WALL);
   if(i===NU/2)v[0]=0;p.push(...v);uv.push(2*Math.atan2(v[0],v[2]+.3),v[1]);
  }
 }
 for(let i=NU/2+1;i<=NU;i++)for(let r=0;r<M;r++){const k=((NU-i)*M+r)*3,x=-p[k],y=p[k+1],z=p[k+2];p.push(x,y,z);uv.push(2*Math.atan2(-x,z+.3),y);}
 for(let i=0;i<NU;i++)for(let r=0;r<M;r++){
  const a=i*M+r,b=a+M,c=i*M+(r+1)%M,d=c+M,x=Math.abs((p[a*3]+p[b*3]+p[c*3]+p[d*3])/4),y=(p[a*3+1]+p[b*3+1]+p[c*3+1]+p[d*3+1])/4;
  const material=r>=FRONT+REAR?1:r<FRONT&&y>2.64&&y<2.92&&x<.34*(.65+(y-2.64)/.28)?2:r<FRONT&&((x-1.78)/.13)**2+((y-3.35)/.22)**2<1?3:0;
  faces[material].push(...(i<NU/2?[a,b,c,b,d,c]:[a,b,d,a,d,c]));
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(faces.flat());let start=0;for(let m=0;m<faces.length;m++){g.addGroup(start,faces[m].length,m);start+=faces[m].length;}g.computeVertexNormals();
 insetEyes(g);
 // The inner wall has its own depth UV: black at the rear, orange at the lip.
 const depthUV=new Float32Array(g.attributes.position.count*2);
 for(let i=0;i<=NU;i++)for(let r=0;r<M;r++)depthUV[(i*M+r)*2]=r===0?1:Math.max(0,(r-FRONT-REAR)/WALL);
 g.setAttribute('uv1',new T.BufferAttribute(depthUV,2));return g;
}

// Split the skin triangles at the almond outline. Eyes share the skin's vertices and normals,
// so their rims cannot float or cut through the brow when seen from the side.
function insetEyes(g){
 const p=Array.from(g.attributes.position.array),n=Array.from(g.attributes.normal.array),uv=Array.from(g.attributes.uv.array),out=[[],[],[],[],[],[]];
 const vertex=i=>[...p.slice(i*3,i*3+3),...n.slice(i*3,i*3+3),...uv.slice(i*2,i*2+2)];
 const emit=(poly,mat)=>{if(poly.length<3)return;const ids=poly.map(v=>{const i=p.length/3;p.push(...v.slice(0,3));n.push(...v.slice(3,6));uv.push(...v.slice(6));return i;});for(let i=1;i<ids.length-1;i++)out[mat].push(ids[0],ids[i],ids[i+1]);};
 for(const part of g.groups)for(let i=part.start;i<part.start+part.count;i+=3){
  const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)],tri=ids.map(vertex),sx=tri[0][0]<0?-1:1;
  if(part.materialIndex!==0||tri.some(v=>v[2]<0)||Math.max(...tri.map(v=>v[1]))<2.83||Math.min(...tri.map(v=>v[1]))>3.18||Math.max(...tri.map(v=>Math.abs(v[0])))<.88||Math.min(...tri.map(v=>Math.abs(v[0])))>1.48){out[part.materialIndex].push(...ids);continue;}
  const rim=Array.from({length:16},(_,j)=>{const a=j/16*Math.PI*2,dx=.27*Math.cos(a);return [sx*(1.18+dx),3+.12*Math.sin(a)*Math.abs(Math.sin(a))**.35+dx*.17];});
  let poly=tri;
  for(let j=0;j<rim.length&&poly.length;j++){
   const a=rim[j],b=rim[(j+1)%rim.length],distance=v=>sx*((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0])),inside=[],outside=[];
   for(let k=0;k<poly.length;k++){
    const v=poly[k],w=poly[(k+1)%poly.length],d=distance(v),e=distance(w);(d>=0?inside:outside).push(v);
    if((d>=0)!==(e>=0)){const t=d/(d-e),cross=v.map((c,l)=>c+(w[l]-c)*t);inside.push(cross);outside.push(cross);}
   }
   emit(outside,0);poly=inside;
  }
  // The narrow pupil shares the eye's surface, including its pointed upper and lower ends.
  for(const edge of [-1,1]){
   const inside=[],outside=[],distance=v=>.025-edge*(sx*v[0]-1.18);
   for(let j=0;j<poly.length;j++){const v=poly[j],w=poly[(j+1)%poly.length],d=distance(v),e=distance(w);(d>=0?inside:outside).push(v);
    if((d>=0)!==(e>=0)){const t=d/(d-e),cross=v.map((c,k)=>c+(w[k]-c)*t);inside.push(cross);outside.push(cross);}}
   emit(outside,4);poly=inside;
  }
  emit(poly,5);
 }
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(out.flat());g.clearGroups();let start=0;
 for(let m=0;m<out.length;m++){g.addGroup(start,out[m].length,m);start+=out[m].length;}return g;
}

export function jaguarEyeGeometry(head){
 const parts=head.groups.splice(4),g=new T.BufferGeometry();for(const [name,attribute] of Object.entries(head.attributes))g.setAttribute(name,attribute);
 g.setIndex(Array.from(head.index.array.slice(parts[0].start)));g.addGroup(0,parts[0].count,0);g.addGroup(parts[0].count,parts[1].count,1);
 head.setIndex(Array.from(head.index.array.slice(0,parts[0].start)));return g;
}

export function jaguarToothGeometry(length,radius,bend){
 const p=[],idx=[],N=length<.3?6:8,R=length<.3?3:4;
 for(let j=0;j<=R;j++){const t=j/R,r=radius*(1-t)**.7;for(let i=0;i<N;i++){const a=i/N*Math.PI*2;p.push(Math.cos(a)*r,-t*length,Math.sin(a)*r+bend*t*t);}}
 for(let j=0;j<R;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N;idx.push(a,b,a+N,b,b+N,a+N);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
