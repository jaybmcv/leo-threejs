// Which rows of a full owner bake a later walk build keeps (scripts/walk-owner-carry.mjs). Pure, so
// scripts/check-owner-carry.mjs runs it on scenes built in Node.
//
// What a bake depends on: each entry [part, [cond...]] is a proof that the part's boxes lie behind the triangles of those
// walls (conditions) from every eye in a cell (src/v2/owner-proof.js), under the proof's rules, for the walk's build
// configuration (merge or batch, desk piece size). Nothing else: a proof covers a box, so a subset of it stays hidden, and
// more triangles elsewhere only cover more. The walk script's hash stands for far more than that (every HUD or game
// change), which is why a page-only fast deploy used to start with an empty bake.
//
// So a full bake stores, beside itself, a digest of each row it names (walk-owner-bake.scene.js rowDigests: a wall's
// triangles and sides as the bake read them, a part's boxes, with their prints) where the bake stood: the bench seed, and
// the café seed for the café cell. A carry reads the same digests from the new build in a bake page standing at the same
// seeds and keeps a row only when its digests match at both; every entry relying on another row goes. The bake page's own
// identity (proof rules, scene reading, hiding) and the build configuration must match too. Then the carry runs the full
// bake's self-check on the new build before writing anything.
import {keepOwnerRows,ownerBakeProblem} from '../src/v2/owner-hiding.js';

// Where a full run keeps its last checked bake with its row digests: build output that a build does not clear (the walk's
// own walk-owner-bake.<hash>.json is removed by every public build).
export const OWNER_STORE='output/leo-interior-v02/owner-bake/last.json';

// ownerKey(script, config) is `<format>.<walk script>.<config>`.
export const keyScript=key=>/^\d+\.(walk\.[0-9a-z]+\.js)\./i.exec(key||'')?.[1]??null;
export const keyConfig=key=>/^\d+\.walk\.[0-9a-z]+\.js\.(.*)$/is.exec(key||'')?.[1]??null;

const fits=(d,data)=>Array.isArray(d?.parts)&&d.parts.length===data.parts.length&&Array.isArray(d?.conds)&&d.conds.length===data.conds.length;

/** Why `stored` (a full bake with its row digests, `carry`) cannot be carried to a walk keyed `key` by a bake page of
 * identity `code` (walk-owner-page.mjs pageScript), or null when it can. */
export function carryProblem(stored,{code,key}){
 const problem=ownerBakeProblem(stored,stored?.key);if(problem)return 'the stored bake: '+problem;
 const c=stored.carry;if(!c)return 'the stored bake has no row digests (made before bakes were carried)';
 if(!fits(c.main,stored)||c.cafe!==null&&!fits(c.cafe,stored)||!c.seed?.at||c.cafe!==null&&!c.cafeSeed?.at)return 'its row digests do not fit its tables';
 if(c.code!==code)return 'the bake page changed since it was baked (proof rules, scene reading or hiding)';
 if(!stored.blocks.length)return 'it proves nothing';
 const was=keyConfig(stored.key),now=keyConfig(key);
 if(was===null||was!==now)return `another build configuration (${was} baked, ${now} now)`;
 return null;
}

/** `stored` for the walk keyed `key`: only the rows whose digests read now (`main` at the bench seed, `cafe` at the café
 * seed: rows(tables) of walk-owner-bake.page.js, one per row) equal those stored, with the entries relying on them
 * alone. Returns {data, dropped} (as pruneOwnerBake) and `changed` {parts, conds}: the stored rows' indices that did not
 * match. data.blocks is empty when nothing is left. Check carryProblem first. */
export function carryRows(stored,{key,main,cafe=null}){
 const c=stored.carry;if(!fits(main,stored)||c.cafe!==null&&!fits(cafe,stored))throw Error('The digests read now do not fit the stored tables');
 // A row with no digest (the scene had none for it) never matches, even another missing one, where it was baked.
 const same=k=>stored[k].map((_,i)=>c.main[k][i]!==null&&c.main[k][i]===main[k][i]&&(c.cafe===null||c.cafe[k][i]===cafe[k][i]));
 const ok={parts:same('parts'),conds:same('conds')},{carry,...rest}=stored,{data,dropped}=keepOwnerRows(rest,ok.parts,ok.conds);
 const changed=k=>ok[k].flatMap((v,i)=>v?[]:[i]);
 return {data:{...data,key,carried:{from:stored.key,made:stored.made??null}},dropped,changed:{parts:changed('parts'),conds:changed('conds')}};
}
