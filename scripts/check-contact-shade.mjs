// Contact shading (src/walk/contact-shade.js): a floor vertex in the corner of the Arrival hall darkens, one in the
// open floor barely changes, and nothing outside the pilot room is touched. Needs the v2 layout (selected-layout.js).
import assert from 'node:assert/strict';
import * as T from 'three';
import {shadeContacts} from '../src/walk/contact-shade.js';

const material=new T.MeshStandardMaterial({vertexColors:true});
// A merged mesh as the bake leaves it: world-space positions, Int16 normals, Uint16 colours, an index.
function merged(quads){
 const P=[],N=[],I=[];
 for(const [a,b,c,d,n]of quads){const o=P.length/3;P.push(...a,...b,...c,...d);for(let k=0;k<4;k++)N.push(...n.map(v=>Math.round(v*32767)));I.push(o,o+1,o+2,o,o+2,o+3);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));
 g.setAttribute('normal',new T.BufferAttribute(new Int16Array(N),3,true));
 g.setAttribute('color',new T.BufferAttribute(new Uint16Array(P.length).fill(60000),3,true));
 g.setIndex(I);g.computeBoundingBox();return new T.Mesh(g,material);
}
// Floor tiles 0.5 m apart with a wall standing at x=-116; the same pair again outside any pilot room (x=+60).
const scene=(x0,wall,y)=>{const quads=[];for(let x=x0;x<wall;x+=.5)for(let z=-60;z<-56;z+=.5)quads.push([[x,y,z],[x,y,z+.5],[x+.5,y,z+.5],[x+.5,y,z],[0,1,0]]);
 quads.push([[wall,y,-62],[wall,y+2.5,-62],[wall,y+2.5,-54],[wall,y,-54],[-1,0,0]]);return merged(quads);};
const inside=scene(-121,-116,-35.7),outside=scene(55,60,-35.7),band=new T.Group();band.add(inside,outside);
const stats=shadeContacts(new Map([[0,band]]));
const shade=(mesh,x,z)=>{const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<1e-4&&Math.abs(p.getZ(i)-z)<1e-4&&Math.abs(p.getY(i)+35.7)<1e-4)return c.array[i*3]/60000;throw Error(`no vertex at ${x},${z}`);};
assert.equal(stats.rooms,1);assert.ok(stats.vertices>0&&stats.meshes===1,JSON.stringify(stats));
const corner=shade(inside,-116,-58),open=shade(inside,-121,-58);
assert.ok(corner<.8,`floor at the wall foot darkens (${corner})`);
assert.ok(open>.97,`open floor 5 m from the wall stays light (${open})`);
assert.equal(shade(outside,60,-58),1,'outside the pilot room nothing changes');
// The wall is one 2.5 x 8 m face: its corners would dim the whole face, so they stay as they were.
{const p=inside.geometry.attributes.position,c=inside.geometry.attributes.color;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)+116)<1e-4&&p.getY(i)>-35)assert.equal(c.array[i*3],60000,'large faces are left alone');}
const again=shadeContacts(new Map([[0,(()=>{const g=new T.Group();g.add(scene(-121,-116,-35.7));return g;})()]]));
assert.deepEqual([again.meshes,again.vertices],[stats.meshes,stats.vertices],'repeatable');
console.log(`PASS contact shading: wall foot ${corner.toFixed(2)}, open floor ${open.toFixed(2)}, outside untouched (${stats.vertices} vertices, ${stats.ms} ms)`);
