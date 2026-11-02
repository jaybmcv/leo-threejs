import {V2_PLACES} from './wayfinding.js';
export const V2_FIND=[
 ['Go to','Press M or Go to, then search by name or open a deck group. Every public room, garden gallery and escape shuttle has a landing.'],
 ['Open atrium','Deck 6 is the open atrium floor. Use the deck map to find the adjoining neighborhoods. The centre above stays open.'],
 ['Food & wellbeing','Arrival food hall on Deck 2, farm-to-table restaurant on Deck 3, wellness & spa on Deck 5, and small bow cafés on Decks 6–15.'],
 ['Alien Cat Invasion','The raised forward observation lounge via the Deck 17 ramp, and the Hydro-Nip arcade on Deck 17.'],
 ['Paw Pool & Leo Pinball','The Recreation hall on Deck 16; Paw Pool is also in the Hydro-Nip arcade.'],
 ['Paws Off','Step onto a belt in the Deck 16 exercise studio or the Deck 17 Hydro-Nip arcade to play.'],
 ['Container Maze & Haze Maze','Container Maze is in Deck 1 Container hold A. Haze Maze is in the Deck 17 Hydro-Nip Lounge.'],
 ['Aquarium Treasure','The glass door on the upper Hydro-Nip gallery, Deck 19: enter the aquarium and swim for seven gems.'],
 ['Hamster ball & gardens','The ball is in Neighborhood 10’s Deck 17 sky garden. All ten sky gardens have upper galleries on Decks 18 and 19.'],
 ['MCT transporters','Six carts charge in Deck 1 Cargo maintenance. E at the front to drive; E at the back to ride.'],
 ['Escape shuttles','Decks 1–5: twenty 100-seat craft per deck. Search Escape shuttle to visit an interior.'],
 ['Crown lounge','The fin lift serves six inspection platforms and the crown’s photo camera, TV and panoramic lounge. Find each stop in Go to.'],
 ['Crew service gallery','The Deck 20 gallery is signed Crew only and is absent from the public Go-to list.'],
 ['Comics, yarn & feedback','Read comic books, push neon yarn, and use Feedback from the place you want to improve.'],
];
const p=V2_PLACES.find(p=>p.id==='theatre-concession');
export const V2_EXAMPLE_GO='?lv=2&at='+p.at.join(',')+'&yaw='+p.yaw*180/Math.PI+'&pitch=-9&view=first';
