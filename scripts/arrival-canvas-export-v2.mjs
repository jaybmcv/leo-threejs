// Node-only compatibility for the selected Arrival canvas textures. Native
// Canvas.data() is a method; GLTFExporter mistakes it for DataTexture pixels.
// Keep other rooms' images untouched and stamp affected export roots so the
// existing scoped-model fingerprint cannot reuse the earlier blank exports.
export function prepareArrivalCanvasExport(root) {
  const images = new Set();
  root.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      if (!material.name?.startsWith('Arrival_Retro_')) continue;
      const image = material.map?.image;
      if (!material.map?.isCanvasTexture || typeof image?.getContext !== 'function') continue;
      images.add(image);
      if (typeof image.data === 'function') {
        Object.defineProperty(image, 'data', {value: undefined, configurable: true});
      }
    }
  });
  if (images.size) root.userData.arrivalCanvasExportVersion = 1;
  return images.size;
}
