// The retained Deck 4 tank-bay entrance, in ship metres. Shared by the walk and Leo live.
export const PANEL={floor:-27.7,face:-175.2,depth:.16,height:3.66,half:3.94,
 code:[1,0,0,1,1],levers:[.8,.4,0,-.4,-.8],reach:1.8,
 inside:-176.3,outside:-174.6,door:{x0:-175.85,x1:-174.75,z:2.45},
 sink:1.1,rise:.35,wait:20,recovery:300};
export const panelDeck=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Math.abs(p[1]-PANEL.floor)<1;
export const panelDoor=p=>panelDeck(p)&&p[0]>PANEL.door.x0&&p[0]<PANEL.door.x1&&Math.abs(p[2])<PANEL.door.z;
export const panelInside=p=>panelDeck(p)&&p[0]<PANEL.inside;
export const panelFront=p=>panelDeck(p)&&p[0]>PANEL.face&&p[0]<PANEL.face+PANEL.reach&&Math.abs(p[2])<1.3;
export const panelBack=p=>panelDeck(p)&&p[0]<PANEL.face-PANEL.depth&&p[0]>PANEL.face-2.6&&Math.abs(p[2])<1.9;
// Reserve before the capsule reaches the face, while it is still held by its collider.
export const panelApproach=p=>panelDeck(p)&&p[0]>PANEL.face&&p[0]<PANEL.face+1.4&&Math.abs(p[2])<1.6;
