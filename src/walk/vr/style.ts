// Voyager's Reach dresses Cosmo for its art styles (cel, painterly, Minecraft, Stylised 3D). Leo has one look, so
// these are the plain style's no-ops.
import type * as T from 'three';
export const DLCAT_EYES = (material: { name: string }): boolean => material.name === "body";
export function applyCelOnlyTree(_root: T.Object3D, _options?: unknown): void {}
export function applyOilCharacterTree(_root: T.Object3D): void {}
export function currentCharacterStyle(): { meshes(meshes: readonly T.Mesh[]): void } | null { return null; }
export function applyStylProportions(_bones: ReadonlyMap<string, T.Bone>): void {}
