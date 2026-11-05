// Stable indices travel with poses. Keep Cosmo first and append new colours.
export const FUR_COLOURS=[
 {name:'Cosmo blue',rgb:[62,94,209]},
 {name:'Lagoon',rgb:[66,180,163]},
 {name:'Rose',rgb:[215,123,166]},
 {name:'Honey',rgb:[222,169,83]},
 {name:'Lilac',rgb:[160,134,218]},
];
export const cleanFur=value=>Number.isInteger(value)&&value>=0&&value<FUR_COLOURS.length?value:0;
const KEY='leo-fur-colour';
export function savedFur(){try{return cleanFur(JSON.parse(localStorage.getItem(KEY)));}catch{return 0;}}
export function saveFur(value){try{localStorage.setItem(KEY,String(cleanFur(value)));return true;}catch{return false;}}
