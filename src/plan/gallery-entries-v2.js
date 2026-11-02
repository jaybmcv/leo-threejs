// Keep the lounge's aquarium and its swim game sealed. The two upper entrances
// use the existing aft end-gallery landing, which meets dry public deck on both sides.
export function gardenGalleryDoors(r,x0,side){return [4,8].map(rise=>({id:r.id+'-gallery-door-'+rise,deck:17+rise/4,center:r.neighborhood===1?[x0,r.y+rise,side*30]:[r.x,r.y+rise,side*24],width:2,outward:r.neighborhood===1?[-1,0]:[0,-side],...(r.neighborhood===1?{reason:'Dry aft end-gallery entrance; preserves the sealed aquarium and its complete treasure-swim volume.'}:{})}));}
