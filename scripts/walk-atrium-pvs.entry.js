// Page for scripts/walk-atrium-pvs.mjs --prepared: the walk's static colliders, decoded from a prepared walk exactly as the
// public walk decodes them, and a renderer like the walk's, as window.__walk for scripts/walk-atrium-pvs.page.js. No walk
// is built or shown. Movers stay unplaced, so lift cars and doors neither block nor hold eye samples; the shut landing
// doors come from the lift data instead (landingDoors).
import * as T from 'three';
import {readPreparedWorld} from '../src/v2/prepared-codec.public.js';
import {shutLandingDoors} from '../src/walk/lifts.js';

const params=new URLSearchParams(location.search);
readPreparedWorld(new URL('prepared/',location.href),{skipImages:true,metadataName:params.get('meta')}).then(({ship})=>{
 const renderer=new T.WebGLRenderer({logarithmicDepthBuffer:true});renderer.setSize(8,8);
 globalThis.__walk={T,colliders:ship.v2PreparedColliders,renderer,landingDoors:shutLandingDoors()};document.body.dataset.ready='1';
},e=>{document.body.dataset.failed=e.message;});
