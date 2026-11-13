import {clearArtDoors} from '../plan/art-clearance-v2.js';
import {applyRoomFitoutOverrides} from './room-fitout-overrides.js';
// The synthwave mural becomes one full-height panel on the aft wall across Decks 17-19, shaped to the hull line
// (community-routes.js), so neither of the old Deck 17 box backings stays. These edit the display parts made below, so
// they live here: the shared room overrides apply to each room's own fittings, which don't include these parts.
export const SYNTHWAVE_MURAL_EDITS={"remove":[{"part":"community_mural_wall","display":"Lounge_mural_back"},{"part":"community_mural_wall","display":"Lounge_mural_left"}]};
// Interior curation: no display covers a hull opening or reinstates an exterior setback.
// Backing panels clear the primary floor by 4 cm (2 cm above the highest finish); their tops and artwork stay fixed.
export function communityArtMounts(layout){const r=id=>layout.rooms.find(r=>r.id===id),capt=r('d20-captain-7'),arrival=r('d02-arrival-1'),ward=r('d05-ward-1'),dining=r('neighborhood-10-dining'),cafe=r('neighborhood-10-cafe');const mounts=[
 ['Orange_Haze_2','commons-10',[116.5,26,24.4],[0,0,1],4.8,3.0,17],
 ['Orange_Haze_3','observation-lounge',[170.25,28,-14],[1,0,0],5.1,3.0,17],
 ['Orange_Haze_4','observation-lounge',[170.25,28,14],[1,0,0],6.0,3.0,17],
 ['Orange_Haze_6',dining.id,[dining.door.center[0]-8.75,dining.y+2.15,dining.door.center[2]+6],[1,0,0],4.0,2.2,15],
 ['Orange_Haze_7',cafe.id,[cafe.door.center[0]-8.75,cafe.y+2.15,cafe.door.center[2]+6],[1,0,0],4.0,2.2,15],
 ['Orange_Haze_9',arrival.id,[-140.75,arrival.y+1.7,arrival.door.center[2]+8],[1,0,0],4.8,2.95,2],
 ['Orange_Haze_10',ward.id,[-123,ward.y+1.7,ward.door.center[2]-.25],[0,0,-1],3.62,2.95,5],
 // The two lounge pictures hang on the Hydro-Nip Lounge's aft wall (x -141), left of each gallery door as you face it from the
 // promenade: Deck 19 and Deck 18. They are bare (no backing panel): the wall is the backing, and the frame stands 2 cm off it.
 ['Orange_Haze_14_1','commons-1',[-141.07,34,-35],[-1,0,0],6.4,3.0,19,true],
 ['Orange_Haze_14_2','commons-1',[-141.07,30,-35],[-1,0,0],6.4,3.0,18,true],
 ...[1,2,3].map((n,i)=>['Orange_Haze_15_'+n,capt.id,[39.3,capt.y+1.7,30-i*3],[1,0,0],2.4,2.95,20])
 ];return mounts.map(([name,room,at,normal,width,height,deck,bare])=>clearArtDoors(layout,{name,room,at,normal,width,height,deck,bare}));}
export function communityDisplayParts(layout){const parts=communityArtMounts(layout).filter(m=>!m.bare).map(m=>({part:'community_display_wall',size:[m.width+(m.name==='Orange_Haze_2'?.80:.32),3.30,.10],at:[m.at[0]-m.normal[0]*.075,layout.decks[m.deck-1].y+(m.room==='observation-lounge'?2:0)+1.69,m.at[2]-m.normal[2]*.075],yaw:Math.atan2(m.normal[0],m.normal[2]),mat:'navy',room:m.room,deck:m.deck,display:m.name}));for(const m of synthwaveMounts())parts.push({part:'community_mural_wall',size:[m.width+.16,3.61,.10],at:[m.at[0]-m.normal[0]*.075,26.145,m.at[2]-m.normal[2]*.075],yaw:Math.atan2(m.normal[0],m.normal[2]),mat:'navy',room:'commons-1',deck:17,display:m.name});const roomOverrides=SYNTHWAVE_MURAL_EDITS;return applyRoomFitoutOverrides({parts,rests:[],rooms:[]},layout,{'commons-1':{replace:roomOverrides.replace,remove:roomOverrides.remove}}).parts;}
export function synthwaveMounts(){return[{name:'Lounge_mural_back',at:[-128,26.2,-24.25],normal:[0,0,-1],width:14,height:14*11.2/45},{name:'Lounge_mural_left',at:[-140.75,26.2,-36],normal:[1,0,0],width:10,height:10*11.2/38}];}
