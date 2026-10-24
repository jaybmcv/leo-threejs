// Alien Cat Invasion's pixel art (feedback-inbox #69): each sprite is rows of characters, one per pixel, and a palette
// for the characters ('.' is clear). Leo is traced from the ship's own top view: the rounded bow, the windowed hull
// and the two engine pods on swept wings. The three Alien Cats and their mothership are placeholder designs until
// canon Alien Cat art is supplied; they carry the antenna of the Mars Cats Voyage helmet.
const HULL={W:'#e9e6df',B:'#2b4a6b',G:'#b9c0c4',D:'#5d6770',O:'#f85800',Y:'#ffd34d'};
const cat=(body,stripe)=>({X:body,S:stripe,E:'#b6ff5c',N:'#ff8fb3',A:'#f4f0e8',W:'#f4f0e8',M:'#2a0f2a'});

export const SPRITES={
 leo:{palette:HULL,rows:[
  '.......W.......',
  '......WWW......',
  '.....WWWWW.....',
  '.....WBBBW.....',
  '.....WWWWW.....',
  '.....WBWBW.....',
  '.....WWWWW.....',
  '.....WBWBW.....',
  '.....WWWWW.....',
  '.....WBWBW.....',
  '.D...WWWWW...D.',
  'GGD..WWWWW..DGG',
  'GGGDDWWWWWDDGGG',
  'GGG..WWWWW..GGG',
  'GGG..WWWWW..GGG',
  'GGG...WWW...GGG',
  'OYO...OYO...OYO',
  '.Y.....Y.....Y.']},
 // Top rows, 30 points: the scout.
 scout:{palette:cat('#ff4fd8','#c23aa6'),frames:[[
  '..X..AA..X..',
  '..XX.AA.XX..',
  '..XXXXXXXX..',
  '.XXXXXXXXXX.',
  '.XEEXXXXEEX.',
  '.XEEXXXXEEX.',
  'WXXXXNNXXXXW',
  '..XXXXXXXX..',
  '..X.X..X.X..',
  '.X........X.'],[
  '..X..AA..X..',
  '..XX.AA.XX..',
  '..XXXXXXXX..',
  '.XXXXXXXXXX.',
  '.XEEXXXXEEX.',
  '.XEEXXXXEEX.',
  'WXXXXNNXXXXW',
  '..XXXXXXXX..',
  '...X.XX.X...',
  '..X......X..']]},
 // Middle rows, 20 points: the tabby.
 tabby:{palette:cat('#45e3ff','#1d8fa8'),frames:[[
  '.....AA.....',
  '.X...AA...X.',
  '.XX......XX.',
  '.XXXXXXXXXX.',
  'XXSXXXXXXSXX',
  'XXEEXXXXEEXX',
  'WXXXXNNXXXXW',
  '.XXSXXXXSXX.',
  '..XX....XX..',
  '.X........X.'],[
  '.....AA.....',
  '.X...AA...X.',
  '.XX......XX.',
  '.XXXXXXXXXX.',
  'XXSXXXXXXSXX',
  'XXEEXXXXEEXX',
  'WXXXXNNXXXXW',
  '.XXSXXXXSXX.',
  '...XX..XX...',
  '..X......X..']]},
 // Bottom rows, 10 points: the brute.
 brute:{palette:cat('#6dff7a','#2f9a4a'),frames:[[
  '.A........A.',
  '.A........A.',
  'XX........XX',
  'XXXXXXXXXXXX',
  'XEEEXXXXEEEX',
  'XEEEXXXXEEEX',
  'WXXXXNNXXXXW',
  'XXMMMMMMMMXX',
  '.XXXXXXXXXX.',
  'XX..X..X..XX'],[
  '.A........A.',
  '.A........A.',
  'XX........XX',
  'XXXXXXXXXXXX',
  'XEEEXXXXEEEX',
  'XEEEXXXXEEEX',
  'WXXXXNNXXXXW',
  'XXMMMMMMMMXX',
  '.XXXXXXXXXX.',
  '.XX.X..X.XX.']]},
 // The mothership crossing the top: a saucer under an alien cat's head, 50-300 points.
 mothership:{palette:{X:'#f85800',E:'#b6ff5c',R:'#9aa6b2',L:'#ffd34d'},rows:[
  '....X......X....',
  '....XX....XX....',
  '...XXXXXXXXXX...',
  '...XEEXXXXEEX...',
  '.RRRRRRRRRRRRRR.',
  'RRLRRLRRLRRLRRLR',
  '.RRRRRRRRRRRRRR.',
  '...RR......RR...']},
 boom:{palette:{Y:'#ffd34d'},rows:[
  '..Y...Y...Y.',
  '...Y..Y..Y..',
  'Y...Y...Y...',
  '.YY.......YY',
  '...Y....Y...',
  'Y...Y..Y...Y',
  '...Y..Y..Y..',
  '..Y...Y...Y.']},
 // A shield: four of them between Leo and the Cats, eaten away pixel by pixel.
 shield:{palette:{S:'#3fd0a0'},rows:[
  '....SSSSSSSSSSSSSS....',
  '...SSSSSSSSSSSSSSSS...',
  '..SSSSSSSSSSSSSSSSSS..',
  '.SSSSSSSSSSSSSSSSSSSS.',
  ...Array(8).fill('SSSSSSSSSSSSSSSSSSSSSS'),
  'SSSSSSS........SSSSSSS',
  'SSSSSS..........SSSSSS',
  'SSSSS............SSSSS',
  'SSSSS............SSSSS']},
};
export const COLORS={shot:'#f85800',bomb:'#b6ff5c',ground:'#3fd0a0',text:'#f4f0e8',accent:'#f85800',dim:'#8c94a3'};

// A sprite (or one frame) drawn at `scale` pixels per pixel into a canvas.
export function spriteCanvas(rows,palette,scale=1,make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h})){
 const c=make(rows[0].length*scale,rows.length*scale),g=c.getContext('2d');
 rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='.'){g.fillStyle=palette[ch];g.fillRect(x*scale,y*scale,scale,scale);}}));
 return c;
}
