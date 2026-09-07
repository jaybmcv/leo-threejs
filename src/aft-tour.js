import {ROUTE} from './model.js';
export const AFT_TOUR=[
 {...ROUTE[0],space:'home'},
 {...ROUTE[1],space:'home',detail:'Deck 15 / Neighborhood 10. Follow the residential corridor toward the aft connection.'},
 {name:'Aft residential connection',space:'residential',detail:'Deck 15. The aft lifts connect housing with the engineering decks.',position:[-116,18,0],target:[-131,18,0]},
 {name:'Engineering arrival',section:'access',also:'drive',detail:'Deck 8. Leave the service lift and enter through the open machinery bulkhead.',position:[-148,-10,0],target:[-181,-10,0]},
 {name:'Three central thruster rows',section:'drive',detail:'Deck 8. Two marked maintenance aisles separate the three parallel drive trains.',position:[-184,-10,8],target:[-274,-7,8]},
 {name:'Lower reservoir bay',section:'tanks',detail:'Deck 4. Four reservoirs sit inside an enclosed service bay below engineering.',position:[-182,-26,0],target:[-234,-24,0]},
 {name:'Engine pod service aisle',section:'pods',detail:'Wing galleries from Deck 9 lead into the paired engine pods through side portals.',position:[-171,-18,126.1625862121582],target:[-274,-12,126.1625862121582]},
 {name:'Lift to the fin crown',section:'fin',also:'access',detail:'Upper service gallery. The passenger lift rises through the fin to the panoramic deck.',position:[-239,26,0],target:[-245,26,0]},
 {name:'Panorama arrival lobby',section:'crown',detail:'Fin crown / 132.3 m elevation. A sheltered lift lobby opens onto both window promenades.',position:[-247,134,3],target:[-242,134,6]},
 {name:'The central bar',section:'crown',detail:'An island bar under an oval light canopy, with warm timber and bronze accents.',position:[-241,134,8],target:[-230,133.7,0]},
 {name:'Settle by the windows',section:'crown',detail:'Curved banquettes sit beside the panoramic glazing. End the journey with a view of Mars.',position:[-218,134,6],target:[-204,134,2]},
];
