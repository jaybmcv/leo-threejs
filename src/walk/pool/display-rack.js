import * as T from 'three';

// The walk's racked balls are stationary. Each array layer holds one original ball skin at its
// native resolution, with its own mip chain, so filtering cannot sample the adjacent number.
export function batchDisplayRack(group, balls) {
 if (balls.length < 2) return;
 const first = balls[0], map = first.material.map, {width, height} = map.image;
 const stride = width * 4, size = stride * height, data = new Uint8Array(size * balls.length);
 for (const [i, ball] of balls.entries()) {
  const canvas = ball.material.map.image;
  if (canvas.width !== width || canvas.height !== height) return;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y++) {
   const source = (height - y - 1) * stride;
   data.set(pixels.subarray(source, source + stride), i * size + y * stride);
  }
 }
 const skins = new T.DataArrayTexture(data, width, height, balls.length);
 skins.colorSpace = map.colorSpace;
 skins.magFilter = map.magFilter;
 skins.minFilter = map.minFilter;
 skins.anisotropy = map.anisotropy;
 skins.generateMipmaps = map.generateMipmaps;
 skins.needsUpdate = true;

 const material = first.material.clone();
 // The walk preloads textures found in material uniforms before a visitor reaches the table.
 material.uniforms = {rackSkins: {value: skins}};
 material.onBeforeCompile = shader => {
  shader.uniforms.rackSkins = material.uniforms.rackSkins;
  shader.vertexShader = 'flat varying float rackLayer;\n' + shader.vertexShader
   .replace('#include <uv_vertex>', '#include <uv_vertex>\n rackLayer = float(gl_InstanceID);');
  shader.fragmentShader = 'uniform highp sampler2DArray rackSkins;\nflat varying float rackLayer;\n' +
   shader.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= texture(rackSkins, vec3(vMapUv, rackLayer));');
 };
 material.onBeforeCompile.keepsGeometry = true;
 material.customProgramCacheKey = () => 'paw-pool-rack-skins';
 const rack = new T.InstancedMesh(first.geometry, material, balls.length);
 rack.name = 'Paw_pool_display_rack';
 rack.userData.noCollide = true;
 for (const [i, ball] of balls.entries()) {
  ball.updateMatrix();
  rack.setMatrixAt(i, ball.matrix);
 }
 rack.computeBoundingSphere();
 group.add(rack);
 group.remove(...balls);
}
