export const AFT_VIEWS={
 overview:{name:'Aft systems cutaway',location:'Tail, wing roots and engine pods',description:'Central machinery, lower tanks, paired engine pods and the fin structure, connected by maintenance access.',position:[-420,205,330],target:[-211,24,0]},
 drive:{name:'Central machinery hall',location:'Deck 8 · floor −11.7 m',description:'Three parallel thruster trains at the three rear panel positions, with twin maintenance aisles.',position:[-138,70,104],target:[-230,0,0],eye:[-184,-10,8],look:[-274,-7,8]},
 tanks:{name:'Lower tank bay',location:'Deck 4 · floor −27.7 m',description:'Four concept reservoir tanks, saddles, isolation manifolds and maintenance aisles below the existing engineering rooms.',position:[-141,25,92],target:[-211,-23,0],eye:[-182,-26,0],look:[-234,-24,0]},
 pods:{name:'Engine pod interiors',location:'Port and starboard · floor −19.7 m',description:'Four drive chambers aligned with the existing exhausts, service frames and forward pump equipment. Wing galleries connect both pods to Deck 9.',position:[-121,78,240],target:[-221,-8,94],eye:[-171,-18,126.1625862121582],look:[-274,-12,126.1625862121582]},
 access:{name:'Aft access and transfer',location:'Decks 4–17 · wing access from Deck 9',description:'A dedicated service lift and switchback stairs link the lower tank bay, machinery hall and upper service gallery. Stepped passages follow the wing geometry.',position:[-87,52,104],target:[-162,-6,0],eye:[-147,-10,0],look:[-156,-10,8]},
 fin:{name:'Fin structure and access',location:'Upper service gallery to fin crown',description:'Internal spars, diagonal bracing and seven inspection platforms beside the new passenger lift to the panoramic crown.',position:[-345,112,135],target:[-229,78,0],eye:[-239,65.7,1.6],look:[-215,68,0]},
 crown:{name:'Fin crown panorama & bar',location:'Fin crown / 132.3 m elevation',description:'An expansive glazed observation deck with wraparound views, a central island bar, window seating and a passenger lift from the upper service gallery.',position:[-309,190,82],target:[-235,132,0],eye:[-241,134,8],look:[-230,133.7,0]},
};
export function aftOpenings(deck){const holes=[];
 if(deck>=4&&deck<=17){holes.push({x0:-158,x1:-154,z0:6,z1:10});if(deck>4)holes.push({x0:-169.5,x1:-162.5,z0:-12.5,z1:-7.5});}
 if(deck===5||deck===6)holes.push({x0:-244,x1:-176,z0:-28,z1:28});
 if(deck>=9&&deck<=13)holes.push({x0:-286,x1:-178,z0:-24,z1:24});
 if(deck>=18)holes.push({x0:-249.2,x1:-244.8,z0:-2.2,z1:2.2});
 return holes;
}
