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

// A proof is reusable only when the target, every required surface in order, and the
// optional cabin slots all agree. An index has meaning only in its own input table.
function signature(table, [part, conditions, slots]) {
 return JSON.stringify([table.parts[part], conditions.map(i => table.conds[i]), slots ?? null]);
}

export function addCafeCell(base, extra) {
 for (const data of [base, extra]) {
  const problem = ownerBakeProblem(data, base.key);
  if (problem) throw Error('Cannot combine owner bakes: ' + problem);
 }
 if (!base.blocks.length || base.nearMargin !== extra.nearMargin || !extra.blocks.length ||
     extra.blocks.some(b => !b[6].length || !sameCell(b, cafe.cell))) throw Error('Unexpected café proof bounds or margin');

 const index = new Map(base.entries.map((entry, i) => [signature(base, entry), i]));
 const shared = extra.entries.map(entry => index.get(signature(extra, entry)));
 const ids = [];
 for (const block of extra.blocks) {
  for (const i of block[6]) {
   if (shared[i] !== undefined) ids.push(shared[i]);
  }
 }
 if (!ids.length) throw Error('No shared visibility proofs for ' + cafe.name);
 return {...base, blocks: [...base.blocks, [...cafe.cell, ...cafe.cell, ids]],
  region: {...base.region, bowCafeCell: [...cafe.cell]}};
}
