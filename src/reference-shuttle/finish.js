import * as T from 'three';

// Deterministic, portable surface maps. These become embedded PNGs in the GLB.
function panelAtlas(thermal=false) {
  const width=2048,height=1024,tile=thermal?64:256;
  const bytes=new Uint8Array(width*height*4);
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  let seed=738291;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const column=Math.floor(x/tile),row=Math.floor(y/tile),dx=x%tile,dy=y%tile;
    const random=hash(column,row),edge=Math.min(dx,dy,tile-1-dx,tile-1-dy);
    seed=(Math.imul(seed,1664525)+1013904223)|0;
    const grain=((seed>>>24)/255-.5)*2;
    let value=(thermal?237:246)-(thermal?17:10)*random+grain;
    if(edge<(thermal?1:1.4))value-=thermal?23:38;
    else if(edge<3)value-=thermal?7:10;
    if(!thermal) {
      // Occasional recessed access plates and a few tiny fasteners. No labels
      // or motifs that would repeat conspicuously along the six-hundred-metre hull.
      const hatch=random<.38 && dx>46&&dx<137&&dy>58&&dy<173;
      if(hatch) {value-=5;if(Math.min(dx-46,137-dx,dy-58,173-dy)<1.6)value-=23;}
      const rivet=Math.min(Math.hypot(dx-8,dy-8),Math.hypot(dx-(tile-9),dy-8));
      if(rivet<1.2)value-=46;
    }
    const index=(y*width+x)*4,shade=Math.round(T.MathUtils.clamp(value,0,255));
    bytes[index]=shade;bytes[index+1]=shade;bytes[index+2]=Math.min(255,shade+(thermal?1:2));bytes[index+3]=255;
  }
  const texture=new T.DataTexture(bytes,width,height,T.RGBAFormat);
  texture.name=thermal?'LEO_thermal_tile_atlas':'LEO_ceramic_panel_atlas';
  texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
  texture.anisotropy=8;texture.flipY=false;texture.needsUpdate=true;
  return texture;
}

export function applySurfaceFinish(root) {
  const ceramic=panelAtlas(),thermal=panelAtlas(true),materials=new Map();
  root.traverse(object=>{
    if(!object.isMesh)return;
    const hull=object.name.startsWith('Smooth_pressure_envelope_'),pod=object.name==='Sculpted_nacelle_shell';
    if(hull||pod) {
      const positions=object.geometry.attributes.position,uv=new Float32Array(positions.count*2),ring= hull?289:81;
      // Match the authored cross-section rings. Avoid planar projection seams
      // and keep the two halves registered at both the roof and belly.
      if(positions.count%ring!==0)throw new Error(`Unexpected loft topology: ${object.name}`);
      for(let i=0;i<positions.count;i++) {
        uv[i*2]=(positions.getX(i)+(hull?300:292))/(hull?240:160);
        uv[i*2+1]=(i%ring)/(ring-1)*(hull?2:1);
        if(hull&&!root.userData.saucer) {
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
          const blend=T.MathUtils.smoothstep(x,-255,-215)*(1-T.MathUtils.smoothstep(x,0,55))*T.MathUtils.smoothstep(y,12,28);
          uv[i*2+1]=T.MathUtils.lerp(uv[i*2+1],2-Math.abs(z)/100,blend);
        }
      }
      object.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
      const original=Array.isArray(object.material)?object.material:[object.material];
      object.material=original.map(material=>{
        if(!materials.has(material.uuid)) {
          const clone=material.clone(),isThermal=material.name.includes('Thermal_navy');
          clone.map=isThermal?thermal:ceramic;
          if(isThermal){clone.color.set(0x303a4a);clone.roughness=.55;clone.metalness=.24;}
          else {clone.color.set(0xd4d8df);clone.roughness=.57;clone.metalness=.13;}
          clone.needsUpdate=true;materials.set(material.uuid,clone);
        }
        return materials.get(material.uuid);
      });
      if(object.material.length===1)object.material=object.material[0];
    }
    if(object.name==='Forward_observation_panes') {
      const positions=object.geometry.attributes.position,colors=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++) {
        const y=positions.getY(i),row=y>37?2:y>27?1:0;
        const angle=Math.atan2(Math.abs(positions.getZ(i)),positions.getX(i)-168);
        const pane=Math.floor(angle/(row===0?1.3/5:1.62/6));
        const tint=.86+.12*((pane*7+row*3)%11)/10;
        colors.set([tint*.93,tint,Math.min(1,tint+.025)],i*3);
      }
      object.geometry.setAttribute('color',new T.BufferAttribute(colors,3));
      object.material=object.material.clone();object.material.vertexColors=true;object.material.needsUpdate=true;
    }
  });
  root.userData.surfaceFinish='Embedded ceramic panel and thermal tile textures; individual glazing tint variation';
}
