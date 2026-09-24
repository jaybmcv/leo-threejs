import { ImageLoader } from 'three';

// Cache decoded HTML images only. Each avatar still creates and owns its
// textures, materials, geometry and skeleton; disposal cannot damage a peer.
export function createImageCache(sources, load = source => new ImageLoader().loadAsync(source)) {
  let pending;
  return () => pending ??= Promise.all(sources.map(load)).catch(error => {
    pending = undefined; // A failed background attempt must not poison Play.
    throw error;
  });
}
