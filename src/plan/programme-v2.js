import {rectangle,bounds,area} from './geometry-v2.js';
// Ordered boolean regions partition the finished slab exactly. A remainder is a named service programme,
// not an implicit empty plate; exclusions reference the preceding physical reservations.
export function completeProgramme({decks,rooms,cabins,shuttles,circulation}){
 for(const d of decks){
  const reservations=[];
  for(const o of d.slab.holes)if(o.id!=='atrium'||d.number>6)reservations.push({id:o.id,category:'void',polygon:o.polygon});
  for(const r of [...rooms.filter(r=>!r.aggregate&&r.y<=d.y+2.1&&r.y+r.height>d.y+.1),...cabins.filter(c=>c.deck===d.number),...shuttles.filter(c=>c.deck===d.number)])reservations.push({id:r.id,category:r.row?'cabin':r.seats?'shuttle bay':'room',polygon:r.envelope?.find(s=>d.y-r.y>=s.rise-1e-7&&d.y-r.y<s.rise+s.height)?.polygon??r.polygon});
  for(const o of [...d.openings,...circulation.stairs.filter(s=>s.deck===d.number)])reservations.push({id:o.id,category:'service core',polygon:o.polygon});
  for(const c of d.corridors)for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>.001)reservations.push({id:c.id+'-strip-'+i,category:'corridor',polygon:rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,l,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0]))});}
  for(const l of circulation.doorLandings.filter(l=>l.deck===d.number))reservations.push({id:l.id,category:'corridor',polygon:l.polygon});
  const zones=[];
  if(d.number>=13&&d.number<=15){
   const lo=d.atrium.samples,hi=d.residentialFront,names=['Neighbourhood café and dining','Quiet lounge and reading','Family play and games','Planting and walking garden','Social lounge and work tables'];
   for(let k=0;k<5;k++)for(const side of [-1,1]){const x0=-126+k*77.2,x1=x0+77.2,points=lo.map((p,i)=>[p[0],p[1],hi[i][1]]).filter(p=>p[0]>=x0&&p[0]<=x1),polygon=[...points.map(p=>[p[0],side*p[1]]),...points.slice().reverse().map(p=>[p[0],side*p[2]])];if(area(polygon)>.1)zones.push({id:'d'+d.number+'-terrace-'+side+'-'+k,category:'terrace',name:names[k],polygon,fittings:['seating clusters','planters','accessible clear route'],excludes:'reservations'});}
  }
  if(d.number===6)zones.push({id:'atrium-floor',category:'terrace',name:'Atrium community garden, event floor and walking circuit',polygon:d.atrium.outline,excludes:'reservations'});
  if(d.number<=5)zones.push({id:'d'+d.number+'-spine',category:'corridor',name:'Central distribution spine',polygon:rectangle(-20,0,560,8),excludes:'reservations'});
  zones.push({id:'d'+d.number+'-aft-services',category:'service space',name:'Aft machinery, utilities, stores and maintenance access',polygon:rectangle(-225,0,150,180),excludes:'reservations and earlier zones'});
  zones.push({id:'d'+d.number+'-service-remainder',category:'service space',name:d.number<=5?'Inner-band supply, plant distribution and maintenance access':d.number<=15?'Pressure-wall access, wing services and cabin partition allowance':'Hull lining access, gallery support and public-room service distribution',polygon:d.slab.outline,excludes:'reservations and earlier zones'});
  d.programme={method:'ordered polygon intersection with slab, less reservations and all preceding regions',reservations,zones,domain:d.slab.outline,complete:true};
 }
}
