# LEO — reference shuttle

Revision 6 follows the user's elongated-saucer reference. A closed 502 m by 208 m lenticular body now has its own rounded rear perimeter around an 86 m wide tail attachment. The forebody and glazing are widened together to keep the oval silhouette continuous. Side markings and service details follow the new hull. The full assembly remains approximately 600 m long and 300 m across its engine pods. Revision 5 source and GLB are preserved in `archive/reference-v05-source`.

Revision 5 smooths the roof between the main body and tail, replaces the overlapping oval tail-root piece with a fillet in the hull mesh, and restores smooth surface normals. The aft panel details move with the roof. The Tail camera shows the changed area. Curvature measurements and the maximum vertex displacement are recorded with the GLB validation report. Revision 4 source and GLB are preserved in `archive/reference-v04-source`.

Revision 4 introduces embedded ceramic panel and thermal tile atlases with subtle access-panel markings, individual cockpit-pane tint variation, and Cockpit / Engine close-up cameras. Both the GLB and offline procedural viewer include the same finish. Texture export uses a native canvas during the build; the viewer has no new runtime dependency. Revision 3 source and GLB are preserved in `archive/reference-v03-source`.

Revision 3 adds recessed engine heat exchangers, finer observation-window sills, chamfered service panels, restrained amber guide lights, and paired communications masts. Lettering uses adaptive subdivision. The local server now loads the validated GLB directly; opening the HTML as a file retains the procedural offline fallback. Geometry dependencies are pinned in `src/reference-shuttle/base` so other project revisions cannot change this model unexpectedly. Revision 2 source and GLB are preserved in `archive/reference-v02-source`.

Revision 2 softens the shoulder transitions, tapers the upper engine-pod housings, and reduces the tail height above its root by 18%. Markings and surface details follow the revised geometry. Subtle ceramic panel variation is stored as vertex colors, and reflective observation glass uses glTF-compatible clearcoat. The viewer includes soft self-shadowing. The prior reference source and GLB are preserved in `archive/reference-v01-source`.

An interactive Three.js exterior study of the supplied LEO illustration, using the workspace's detailed procedural hull, wings, engine pods, glazing, tail, panel seams, and markings. This variant retains the 600 m logical length and 300 m span from the reference. Earlier model revisions are untouched.

Open `index.html` directly in a WebGL-capable browser; the renderer and geometry are bundled for offline use. Keep `saucer-reference.png` and `leo-shuttle.glb` alongside it for reference viewing and model download. Drag to orbit, scroll to zoom, and right-drag to pan. Buttons select orthographic camera views, toggle orbit and wireframe, display the reference, and save a PNG.

The GLB contains named, editable geometry groups in metres (+X forward, +Y up, +Z starboard). It can be loaded with Three.js GLTFLoader or imported into Blender. This is an artistic exterior reconstruction; unseen surfaces are inferred. The artwork's 10,000-occupant label does not represent a validated capacity for this variant.

From the project root:

```sh
npm run build:reference
npm run start:reference
```

Viewer: http://127.0.0.1:4174

Source entry: `src/reference-shuttle/model.js`. Its frozen geometry dependencies are in `src/reference-shuttle/base`. The additional surface details are in `src/reference-shuttle/surface-details.js`. Viewer source: `src/reference-shuttle/viewer.js`. Build performs finite-vertex checks and Khronos glTF validation; results are saved in `validation.json`.

