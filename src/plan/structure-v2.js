// Physical headroom for the scheduled ramp and wing flights. Runs before navigation/programme.
export function wingFlight(s,stairs=[]){const x=s.x,inner=Math.abs(s.z)-3,z=s.side*(inner+.8),previous=stairs.find(p=>p.wing===s.wing&&p.side===s.side&&p.deck===s.deck-1),below=previous?Math.abs(previous.z)-3+.8:inner,choices=[inner+2.6,inner+5.2],outer=s.side*choices.sort((a,b)=>Math.abs(b-below)-Math.abs(a-below))[0];return {x,z,outer,portal:[[x-3.4,z-.8],[x+3.4,z-.8],[x+3.4,z+.8],[x-3.4,z+.8]]};}
export function addStructuralOpenings(plan){
 // A wing core is a reservation, not a floor opening. Only the incoming return
 // flight pierces a deck; the first residential deck has no incoming wing stair.
 for(const d of plan.decks)d.slab.holes=d.slab.holes.filter(h=>!/^d\d+-wing-stair-/.test(h.id)||h.id.endsWith('-return-headroom'));

 // The accepted arcade/treadmill stays anchored on N1's forward wall. Slide the
 // replacement garden stair and both links 2.2 m toward the free end-wall bay.
 for(const r of plan.rooms||[]){if(r.id!=='commons-1'||!r.components||r.components.v2EntryClearance)continue;for(const o of [...r.components.stairs,...r.components.links,...r.components.landings]){o.center[0]+=2.2;if(o.polygon)o.polygon=o.polygon.map(([x,z])=>[x+2.2,z]);}r.components.v2EntryClearance=true;}

 for(const ramp of plan.circulation.ramps){const d=plan.decks[ramp.deck],id=ramp.id+'-headroom';if(!d.slab.holes.some(h=>h.id===id))d.slab.holes.push({id,polygon:ramp.polygon});}
 // Roots follow the tapering hull. The return flight's opening reaches the deck above;
 // it must not be replaced by that upper deck's differently positioned root reservation.
 for(const s of plan.circulation.stairs.filter(s=>s.wing!==undefined&&s.deck<15)){const d=plan.decks[s.deck],id=s.id+'-return-headroom';if(!d.slab.holes.some(h=>h.id===id))d.slab.holes.push({id,polygon:wingFlight(s,plan.circulation.stairs).portal});}
 return plan;
}
