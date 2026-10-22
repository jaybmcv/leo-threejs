import * as THREE from 'three';

/**
 * Sculpted cloth surface. t travels from the band opening to the roof center;
 * a travels around the head, with a=0 at the front. The off-center crest,
 * broad roof and individual folds are geometry, so they survive GLB export.
 */
export const CROWN_SHAPE={bodyTwist:.13,roofLift:-.056,frontRise:.43,sideRise:.070,shoulderLift:-.12,roofEdgeLift:-.008,lowTuck:.40,width:.96,depth:.96,height:.85};

export function createCrownSurface({ foldStrength=1, lean=1, shape={} }={}) {
  const sculpt={...CROWN_SHAPE,...shape};
  const profile=new THREE.SplineCurve([
    new THREE.Vector2(1,.325), new THREE.Vector2(1.09,.42),
    new THREE.Vector2(1.19,.60),new THREE.Vector2(1.20,.80),
    new THREE.Vector2(1.08,1.01),new THREE.Vector2(.87,1.23),
    new THREE.Vector2(.64,1.36),new THREE.Vector2(.43,1.40),
    new THREE.Vector2(.21,1.425),new THREE.Vector2(0,1.43)
  ]);
  const folds=[
    {a:-1.40,w:.120,d:.105,t0:.018,t1:.63,bend:.30},
    {a:-1.08,w:.070,d:.078,t0:.015,t1:.42,bend:-.45},
    {a:-.76,w:.045,d:.060,t0:.025,t1:.28,bend:.46},
    {a:-.45,w:.065,d:.048,t0:.045,t1:.45,bend:.42},
    {a:-.28,w:.048,d:.044,t0:.24,t1:.65,bend:.68},
    {a:.28,w:.052,d:.041,t0:.30,t1:.67,bend:-.58},
    {a:.40,w:.045,d:.042,t0:.025,t1:.30,bend:-.18},
    {a:.86,w:.065,d:.074,t0:.025,t1:.48,bend:-.38},
    {a:1.24,w:.090,d:.085,t0:.03,t1:.61,bend:-.46},
    {a:1.71,w:.055,d:.080,t0:.02,t1:.34,bend:.24},
    {a:2.35,w:.090,d:.088,t0:.025,t1:.52,bend:-.32},
    {a:-2.70,w:.075,d:.094,t0:.03,t1:.58,bend:.42},
    {a:-2.05,w:.060,d:.064,t0:.018,t1:.37,bend:-.22}
  ];
  const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const gauss=(v,w)=>Math.exp(-((v/w)**2));
  const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  let bodyHeights=null;
  const bodyRows=256,bodyColumns=1024,bodyEnd=.62;
  function bodyHeight(t,a){
    const row=t/bodyEnd*bodyRows,j=Math.min(bodyRows-1,Math.floor(row)),v=row-j;
    const column=THREE.MathUtils.euclideanModulo(a,Math.PI*2)/(Math.PI*2)*bodyColumns,i=Math.floor(column),u=column-i,next=(i+1)%bodyColumns;
    const a0=bodyHeights[i*(bodyRows+1)+j],b0=bodyHeights[next*(bodyRows+1)+j],a1=bodyHeights[i*(bodyRows+1)+j+1],b1=bodyHeights[next*(bodyRows+1)+j+1];
    return (1-v)*((1-u)*a0+u*b0)+v*((1-u)*a1+u*b1);
  }
  function foldDisplacement(t,a){
    let displacement=0;
    for(const f of folds){
      if(t<=f.t0||t>=f.t1)continue;
      const v=(t-f.t0)/(f.t1-f.t0),envelope=Math.pow(Math.sin(Math.PI*v),.85);
      const path=f.a+f.bend*(t-.20)+.022*Math.sin(v*Math.PI*1.6);
      const delta=wrap(a-path),width=f.w*(1-.35*v);
      const valley=-gauss(delta,width);
      const ridges=.24*gauss(delta-width*1.8,width*.9)+.19*gauss(delta+width*1.8,width*.85);
      const panelEdge=.43+.07*Math.cos(a)+.018*Math.sin(2*a);
      const stopAtPanel=1-smooth(panelEdge-.045,panelEdge+.018,t);
      displacement+=f.d*envelope*(valley+ridges)*stopAtPanel;
    }
    const turn=.40+.07*Math.cos(a)+.018*Math.sin(2*a);
    displacement-=.026*gauss(t-turn,.018)*(.65+.35*Math.cos(a-.5));
    const gatherEnvelope=smooth(0,.06,t)*(1-smooth(.15,.27,t));
    displacement+=.010*(Math.sin(18*a+1.5)+.45*Math.sin(29*a-.7))*gatherEnvelope;
    return displacement*foldStrength;
  }
  function shade(t,a){
    // Subtle baked cavity tone keeps the modeled creases legible in flat light.
    // The deformation is independent; this is vertex color, not a painted decal.
    const cavity=THREE.MathUtils.clamp((-foldDisplacement(t,a)-.003)/.078,0,1);
    return 1-.24*Math.pow(cavity,.72);
  }
  function point(t,a,inner=false){
    const p=profile.getPoint(t),r=p.x;
    const dp=profile.getTangent(t);
    const denom=Math.hypot(dp.y,1.47*dp.x)||1;
    const nrad=dp.y/denom,ny=-1.47*dp.x/denom;
    // The top is a slightly squared oval, rather than a spherical dome.
    const square=.10*Math.sin(Math.PI*t);
    const signedPow=(v,p)=>Math.sign(v)*Math.pow(Math.abs(v),p);
    const sx=signedPow(Math.sin(a),1-square),sz=signedPow(Math.cos(a),1-square);
    const rise=smooth(0,.54,t),roof=smooth(.36,.70,t);
    const shiftX=.025*rise*lean,spread=smooth(0,.18,t);
    let x=1.47*r*sx*(1+(sculpt.width-1)*spread)+shiftX;
    let z=1.035*r*sz*(1+(sculpt.depth-1)*spread)+.025*rise;
    // Long rising shoulder, high front-right crest, softly slumped opposite side.
    let y=p.y+lean*(sculpt.sideRise*x+sculpt.frontRise*z)*rise;
    y+=roof*(sculpt.roofLift-.045*(x-.08)**2-.07*(z-.12)**2);
    y-=sculpt.bodyTwist*(.885*x+.467*z)*gauss(t-.39,.17);
    y+=sculpt.shoulderLift*gauss(t-.37,.11)+sculpt.roofEdgeLift*gauss(t-.56,.115);
    y+=.055*gauss(wrap(a-.20),.66)*Math.sin(Math.PI*t)*Math.sin(Math.PI*t);
    y-=.055*gauss(wrap(a+1.2),.65)*Math.sin(Math.PI*t);
    // The reference's low side curls down around the band, while the front
    // stays gathered above the braid. This is deliberately not a level rim.
    const lowSide=gauss(wrap(a+1.52),.40)*(1-smooth(.025,.24,t));
    y-=sculpt.lowTuck*lowSide;x+=.045*lowSide*Math.sin(a);z+=.045*lowSide*Math.cos(a);
    y+=roof*(.021*Math.cos(3*a+.7)+.013*Math.sin(5*a-.6))*Math.min(1,r*3);
    const displacement=foldDisplacement(t,a);
    x+=displacement*nrad*Math.sin(a);z+=displacement*nrad*Math.cos(a);y+=displacement*ny;
    y=.325+(y-.325)*sculpt.height;
    if(bodyHeights&&t<=bodyEnd)y=bodyHeight(t,a);
    // Close at a single point, keeping the roof center smooth from every angle.
    if(inner){x-=.027*nrad*Math.sin(a);z-=.027*nrad*Math.cos(a);y-=.027*ny;}
    return [x,y,z];
  }
  function frontZ(x,y){
    // Solve both surface coordinates together. A bounded Newton step avoids
    // thousands of repeated angle searches when conforming detailed relief.
    let t=THREE.MathUtils.clamp((y-.325)*.40,.015,.66),a=x/1.55,p;
    const eps=.00015;
    for(let k=0;k<10;k++){
      p=point(t,a);const ex=x-p[0],ey=y-p[1];
      if(Math.abs(ex)+Math.abs(ey)<.00001)return p[2];
      const pt=point(t+eps,a),pa=point(t,a+eps);
      const xt=(pt[0]-p[0])/eps,yt=(pt[1]-p[1])/eps,xa=(pa[0]-p[0])/eps,ya=(pa[1]-p[1])/eps,det=xt*ya-xa*yt;
      if(Math.abs(det)<.00001)break;
      t=THREE.MathUtils.clamp(t+THREE.MathUtils.clamp((ex*ya-xa*ey)/det,-.085,.085),.002,.72);
      a=THREE.MathUtils.clamp(a+THREE.MathUtils.clamp((xt*ey-ex*yt)/det,-.18,.18),-1.1,1.1);
    }
    return point(t,a)[2];
  }
  function angles(t,{base=96,samples=7}={}){
    const positions=[];
    for(let i=0;i<base;i++)positions.push(i/base*Math.PI*2);
    const offsets=samples===9?[-2.6,-1.8,-1.1,-.55,0,.55,1.1,1.8,2.6]:samples===5?[-1.8,-.8,0,.8,1.8]:[-2.2,-1.3,-.6,0,.6,1.3,2.2];
    for(const f of folds){
      const v=THREE.MathUtils.clamp((t-f.t0)/(f.t1-f.t0),0,1),center=f.a+f.bend*(t-.20)+.022*Math.sin(v*Math.PI*1.6),w=f.w*(1-.35*v);
      for(const offset of offsets)positions.push(THREE.MathUtils.euclideanModulo(center+offset*w,Math.PI*2));
    }
    positions.sort((a,b)=>a-b);
    // Constant ring cardinality makes a continuous mesh while concentrating
    // vertices inside the narrow valleys instead of spending them on flat cloth.
    const eps=.0003;
    for(let i=1;i<positions.length;i++)positions[i]=Math.max(positions[i],positions[i-1]+eps);
    for(let i=positions.length-1;i>0;i--)positions[i]=Math.min(positions[i],Math.PI*2-(positions.length-i)*eps);
    positions.push(Math.PI*2);return positions;
  }
  function rings(detail='medium'){
    const counts=detail==='high'?[28,52,28]:detail==='low'?[12,18,10]:[20,40,20],limits=[0,.25,.58,1],ts=[];
    for(let segment=0;segment<3;segment++)for(let j=0;j<counts[segment];j++)ts.push(limits[segment]+(limits[segment+1]-limits[segment])*j/counts[segment]);
    ts.push(1);return ts;
  }
  // Keep the cloth wall continuous through tight folds. A small monotonic
  // correction prevents local turnbacks without removing radial creases.
  // Roof points are untouched; this only repairs the rising side wall.
  const values=new Float64Array(bodyRows+1),table=new Float32Array(bodyColumns*(bodyRows+1)),minimumRise=.35;
  let maxCorrection=0,sumCorrection=0,correctedSamples=0;
  for(let column=0;column<bodyColumns;column++){
    const a=column/bodyColumns*Math.PI*2,blocks=[];
    for(let row=0;row<=bodyRows;row++){
      const t=row/bodyRows*bodyEnd,y=point(t,a)[1];values[row]=y;
      blocks.push({start:row,end:row,mean:y-minimumRise*t,weight:1});
      while(blocks.length>1&&blocks.at(-2).mean>blocks.at(-1).mean){
        const b=blocks.pop(),a=blocks.pop(),weight=a.weight+b.weight;
        blocks.push({start:a.start,end:b.end,mean:(a.mean*a.weight+b.mean*b.weight)/weight,weight});
      }
    }
    for(const block of blocks)for(let row=block.start;row<=block.end;row++){
      const y=block.mean+minimumRise*row/bodyRows*bodyEnd,correction=Math.abs(y-values[row]);
      table[column*(bodyRows+1)+row]=y;maxCorrection=Math.max(maxCorrection,correction);sumCorrection+=correction*correction;if(correction>.00001)correctedSamples++;
    }
  }
  bodyHeights=table;
  const repair={maxCorrection,rmsCorrection:Math.sqrt(sumCorrection/table.length),correctedSamples,totalSamples:table.length};
  return {point,frontZ,profile,folds,angles,rings,shade,repair};
}
