// The visitor's own outfit (wardrobe.js), kept on this browser only: it never travels with poses, so others aboard see
// the usual hoodie. Keep Default first.
export const OUTFITS=[
 {id:'default',name:'Default'},
 {id:'bomber',name:'Bomber jacket'},
];
export const cleanOutfit=value=>OUTFITS.some(o=>o.id===value)?value:'default';
const KEY='leo-outfit';
export function savedOutfit(){try{return cleanOutfit(localStorage.getItem(KEY));}catch{return 'default';}}
export function saveOutfit(value){try{localStorage.setItem(KEY,cleanOutfit(value));return true;}catch{return false;}}
// A link's ?outfit= (a preview picture of the jacket, say) dresses the cat for that visit without saving it.
export function startOutfit(){try{const linked=new URLSearchParams(location.search).get('outfit');if(linked)return cleanOutfit(linked);}catch{}return savedOutfit();}
