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

// Native baking records each owner's results separately. Consecutive records
// with identical bounds are visited for exactly the same camera cells. Append
// their references in place in the new table; runtime hide order is unchanged.
export function compactOwnerBlocks(blocks) {
 const result = [];
 let previous;
 for (const row of blocks) {
  if (previous && row.slice(0, 6).every((v, i) => v === previous[i])) {
   for (const id of row[6]) previous[6].push(id);
  } else {
   previous = [...row.slice(0, 6), [...row[6]]];
   result.push(previous);
  }
 }
 return result;
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
 const entries = base.entries.slice(), index = new Map(entries.map((row, i) => [JSON.stringify(row), i]));
 const added = extra.entries.map(([p, cs, slots]) => {
  const row = [parts.remap[p], cs.map(c => conds.remap[c]), ...(slots ? [slots] : [])];
  const key = JSON.stringify(row);
  if (!index.has(key)) {
   index.set(key, entries.length);
   entries.push(row);
  }
  return index.get(key);
 });
 const ids = extra.blocks.flatMap(b => b[6].map(i => added[i]));
 const block = [...cafe.cell, ...cafe.cell, ids];
 return {...base, parts: parts.rows, conds: conds.rows, entries, blocks: compactOwnerBlocks([...base.blocks, block]),
  region: {...base.region, bowCafeCell: [...cafe.cell]}};
}
