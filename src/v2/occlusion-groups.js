import {Box3, Vector3} from 'three';

// The groups group-occlusion.js asks about on the walk page, beyond the room features themselves (featureRoots: a room's
// dressing or a vehicle, under the deck bands). Seen from the bow cafés looking down the ship, about five in six draws
// changed no pixel, and most of those belonged to nothing it asked about:
// - The baked room dressing left beside the merged deck bands (render-bake.js: one mesh per material, deck band and 40 m
//   slab along the ship; the bands copied the rest): one group per band, slab and side (port, middle, starboard), so
//   meshes that share a place share one question. One question each hid 18 more draws at a café for 79 more queries.
// - Named feature groups the walk adds to the scene on their own (below): Keel Club, a lounge's aquarium, the tube lift
//   and its riders, the atrium's park and cat tree, the stage frog. Named one by one: other visitors' cats, balls,
//   carried things and the crowd are never asked about (nor the yarn ball or a hatch, two draws each: not worth a
//   question every moving frame).
// - The furniture of the repeated cabins nearest the walker (the instanced fittings the walk re-ranks as he moves): one
//   group per cabin template. The cabins' walls are not: their instances span the whole deck.
// - The lift shafts.
export const NAMED_GROUPS = /^(Keel_club|Walk_lounge_aquarium|Clubhouse_tube_lift|Toybox_park|Common_stage_frog|Great_cat_tree)$/;
const SLAB = 40, SIDE = 8;

/** A function giving the groups (group-occlusion.js asks it again whenever it refreshes its members). `instanced`: the
 * walk's live instanced meshes, with userData.near on those it re-ranks by distance (cabin and lifeboat furniture). */
export function occlusionGroups(scene, {featureRoots, instanced = [], slab = SLAB, more = true}) {
 const box = new Box3(), centre = new Vector3();
 const slabs = new Map(), fittings = new Map();
 const known = new Set();
 function collect() {
  for (const band of scene.children) {
   if (!/^Walk_band_/.test(band.name)) continue;
   for (const o of band.children) {
    if (!o.isMesh || !o.name.startsWith('Walk_merged_') || known.has(o)) continue;
    known.add(o);
    const geo = o.geometry;if (!geo.boundingBox) geo.computeBoundingBox();
    o.updateWorldMatrix(true, false);box.copy(geo.boundingBox).applyMatrix4(o.matrixWorld).getCenter(centre);
    const side = centre.z < -SIDE ? 'port' : centre.z > SIDE ? 'starboard' : 'middle';
    const key = slab > 0 ? band.uuid + '|' + Math.floor(centre.x / slab) + '|' + side : o.uuid;
    let group = slabs.get(key);if (!group) slabs.set(key, group = {name: band.name + ' slab ' + key, parts: []});
    group.parts.push(o);
   }
  }
  // Cabin furniture (not the lifeboats' seats, which the walk shows only near him), by the group holding it: one
  // template's parts share their cabins.
  for (const o of instanced) {
   if (!o.userData.near || o.userData.boat || known.has(o)) continue;
   known.add(o);
   const p = o.parent, whole = p && !p.isScene && p.children.every(c => c.isInstancedMesh && c.userData.near && !c.userData.boat);
   const key = whole ? p : o;if (!fittings.has(key)) fittings.set(key, key);
  }
 }
 const lifts = o => o.isGroup && o.userData.keepLive && /^Walk_lift_/.test(o.name);
 // `more` false: the room features and lifts alone, as before these groups (?occlusionmore=0, to compare).
 if (!more) return () => [...featureRoots, ...scene.children.filter(lifts)];
 collect();
 return () => {
  collect();
  return [...featureRoots, ...slabs.values(), ...fittings.values(), ...scene.children.filter(o => lifts(o) || NAMED_GROUPS.test(o.name))];
 };
}
