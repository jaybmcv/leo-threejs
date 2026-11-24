import {ownerBakeProblem} from '../src/v2/owner-hiding.js';

// The first-person camera at the Deck 6 bow café remains in this cell through its full turn.
export const cafe = {
 name: 'The Daily Grind', at: [239.4, -19.694, 0], yaw: -112.5, cell: [270, 10, 75]
};

function sameCell(block, cell) {
 return cell.every((v, i) => block[i] === v && block[i + 3] === v);
}

export function coversCafe(data) {
 const cell = data?.region?.bowCafeCell;
 return Array.isArray(cell) && cell.length === 3 && cell.every((v, i) => v === cafe.cell[i]) && data.blocks.some(b => b[6].length && sameCell(b, cafe.cell));
}

// Both inputs have passed native pruning on their own scene. An index has meaning only
// inside its own tables. Keep every old index stable and translate every added reference.
export function addCafeCell(base, extra) {
 for (const d of [base, extra]) {
  const problem = ownerBakeProblem(d, base.key);
  if (problem) throw Error('Cannot combine owner bakes: ' + problem);
 }
 if (!base.blocks.length || base.nearMargin !== extra.nearMargin || !extra.blocks.length ||
     extra.blocks.some(b => !b[6].length || !sameCell(b, cafe.cell))) throw Error('Unexpected café proof bounds or margin');

 function addRows(oldRows, newRows) {
  const rows = oldRows.slice(), indexes = new Map(rows.map((r, i) => [JSON.stringify(r), i]));
  const prints = new Map(rows.map(r => [r[0], r[1]]));
  const remap = newRows.map(row => {
   if (prints.has(row[0]) && prints.get(row[0]) !== row[1]) throw Error('Incompatible scene rows for ' + row[0]);
   const key = JSON.stringify(row);
   if (!indexes.has(key)) {
    indexes.set(key, rows.length);
    prints.set(row[0], row[1]);
    rows.push(row);
   }
   return indexes.get(key);
  });
  return {rows, remap};
 }
 const parts = addRows(base.parts, extra.parts), conds = addRows(base.conds, extra.conds);
 const added = extra.entries.map(([p, cs, slots]) => [parts.remap[p], cs.map(c => conds.remap[c]), ...(slots ? [slots] : [])]);
 // All supplemental records have these exact bounds. Keep their original
 // order, with a single additional bounds check when the camera changes cell.
 const ids = extra.blocks.flatMap(b => b[6].map(i => base.entries.length + i));
 const block = [...cafe.cell, ...cafe.cell, ids];
 return {...base, parts: parts.rows, conds: conds.rows, entries: [...base.entries, ...added], blocks: [...base.blocks, block],
  region: {...base.region, bowCafeCell: [...cafe.cell]}};
}
