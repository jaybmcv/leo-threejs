// Poses on the wire, in bytes. The same design as Voyager's Reach's pose wire (packages/world-core/src/poseWire.ts):
// the server sends every visitor every nearby visitor's pose many times a second, so its upload grows as the square of
// the crowd; a JSON pose is ~130 bytes, most of it the same keys and the same name again. So server -> client poses are
// bytes: every visitor holds a small SLOT, who a slot is (id and name) is sent once, and after that a pose is 14 bytes.
// Client -> server stays JSON (one pose a tenth of a second each: N messages, not N squared).
//
// Leo's record carries what walk mode's Cosmo needs (avatar.js update): where, which way, on the ground or not, the
// stance and jump, an emote, and sitting or lying down. Speed is not sent; the receiver takes it from successive
// positions, as Reach does.
//
// A frame, little-endian:
//   u8 tag 0x4c ('L') · u8 version
//   u16 identities, each: u16 slot · u8 id bytes · id · u8 flags · u8 name bytes · name   (utf-8; flags 0x01: the
//                         name is the visitor's Discord name, vouched for by The Creamery: net/pass.js; 0x02: a tester,
//                         who wears the captain's hat: walk/hat.js)
//   u16 poses, each:      u16 slot · u8 head · three u24 position · u16 heading · extras
//   head:     bits 0-1 rest (0 none, 1 sitting, 2 lying) · 0x04 GROUNDED · 0x08 MOTION · 0x10 EMOTE · 0x20 PLAYING
//             (at the lounge telescope's game: walk/invasion) · 0x40 BALL (rolling in a hamster ball:
//             walk/hamster-ball.js); bit 7 unused
//   position: (metres + 2048) x 4096, an eighth of a millimetre
//   heading:  a turn in 65,536 steps, read back in [-pi, pi)
//   MOTION:   u8 stance | jumps << 2 · i16 rise x 300 · u16 (jumpS + 1) x 1000   (a body standing plainly sends none)
//   EMOTE:    u8 bytes · utf-8
// Encoding throws on anything out of range (a bug in the sender); decoding drops a frame that does not read cleanly.

export const WIRE_TAG=0x4c,WIRE_VERSION=5;
export const STANCES=['stand','crouch','prone','slide'];
export const RESTS=[null,'sit','lie'];
const GROUNDED=0x04,MOTION=0x08,EMOTE=0x10,PLAYING=0x20,BALL=0x40,KNOWN=0x7f;
const ORIGIN=-2048,STEPS=4096,MAX_STEP=0xffffff,YAW_STEPS=65536,TURN=Math.PI*2;
const encoder=new TextEncoder(),decoder=new TextDecoder();

function range(what,n,min,max){if(!Number.isFinite(n)||n<min||n>max)throw new RangeError(`pose wire: ${what} ${n} is outside ${min}..${max}`);}
const yawStep=yaw=>{const t=yaw/TURN;return Math.round((t-Math.floor(t))*YAW_STEPS)%YAW_STEPS;};

// A pose: {pos:[x,y,z], yaw, grounded, stance, jumpCount, jumpS, rise, emote, rest, playing, ball}.
export function encodeRecord(slot,p){
 range('slot',slot,0,0xffff);
 const steps=p.pos.map(m=>{range('position',m,ORIGIN,ORIGIN+MAX_STEP/STEPS);return Math.round((m-ORIGIN)*STEPS);});
 const stance=STANCES.indexOf(p.stance||'stand'),jumps=p.jumpCount||0,rise=Math.round((p.rise||0)*300),jump=Math.round(((p.jumpS??-1)+1)*1000);
 if(stance<0)throw new RangeError(`pose wire: unknown stance ${p.stance}`);
 range('jumps',jumps,0,3);range('rise',p.rise||0,-100,100);range('jump time',p.jumpS??-1,-1,60);
 const rest=RESTS.indexOf(p.rest||null);if(rest<0)throw new RangeError(`pose wire: unknown rest ${p.rest}`);
 const moving=stance!==0||jumps!==0||rise!==0||jump!==0,clip=p.emote?encoder.encode(p.emote):null;
 if(clip&&clip.length>0xff)throw new RangeError('pose wire: emote too long');
 const bytes=new Uint8Array(14+(moving?5:0)+(clip?1+clip.length:0)),v=new DataView(bytes.buffer);
 v.setUint16(0,slot,true);v.setUint8(2,rest|(p.grounded?GROUNDED:0)|(moving?MOTION:0)|(clip?EMOTE:0)|(p.playing?PLAYING:0)|(p.ball?BALL:0));
 steps.forEach((s,k)=>{v.setUint16(3+k*3,s&0xffff,true);v.setUint8(5+k*3,s>>>16);});
 v.setUint16(12,yawStep(p.yaw),true);let o=14;
 if(moving){v.setUint8(o,stance|(jumps<<2));v.setInt16(o+1,rise,true);v.setUint16(o+3,jump,true);o+=5;}
 if(clip){v.setUint8(o,clip.length);bytes.set(clip,o+1);}
 return bytes;
}
export function encodeIdentity(slot,id,name,verified=false,hat=false){
 const a=encoder.encode(id),b=name?encoder.encode(name):new Uint8Array(0);
 if(a.length>0xff||b.length>0xff)throw new RangeError('pose wire: id or name too long');
 const bytes=new Uint8Array(2+1+a.length+2+b.length),v=new DataView(bytes.buffer);
 v.setUint16(0,slot,true);v.setUint8(2,a.length);bytes.set(a,3);v.setUint8(3+a.length,(verified?1:0)|(hat?2:0));v.setUint8(4+a.length,b.length);bytes.set(b,5+a.length);
 return bytes;
}
// Records into a frame: the server encodes each record once and copies it into every frame that carries it.
export function assembleFrame(identities,records){
 let size=6;for(const r of identities)size+=r.length;for(const r of records)size+=r.length;
 const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);
 v.setUint8(0,WIRE_TAG);v.setUint8(1,WIRE_VERSION);v.setUint16(2,identities.length,true);let o=4;
 for(const r of identities){bytes.set(r,o);o+=r.length;}
 v.setUint16(o,records.length,true);o+=2;
 for(const r of records){bytes.set(r,o);o+=r.length;}
 return bytes;
}

// {identities:[{slot,id,name}], poses:[{slot,pose}]} or null for anything that is not a whole frame of this version.
export function decodeFrame(data){
 const bytes=data instanceof Uint8Array?data:new Uint8Array(data),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let o=0;
 const has=n=>o+n<=bytes.length,text=n=>{const s=decoder.decode(bytes.subarray(o,o+n));o+=n;return s;};
 if(!has(4)||v.getUint8(0)!==WIRE_TAG||v.getUint8(1)!==WIRE_VERSION)return null;
 const identities=[],poses=[],ids=v.getUint16(2,true);o=4;
 for(let i=0;i<ids;i++){
  if(!has(3))return null;const slot=v.getUint16(o,true),n=v.getUint8(o+2);o+=3;
  if(!has(n+2))return null;const id=text(n),flags=v.getUint8(o),m=v.getUint8(o+1);o+=2;
  if(flags&~3||!has(m))return null;identities.push({slot,id,name:m?text(m):undefined,verified:!!(flags&1),hat:!!(flags&2)});
 }
 if(!has(2))return null;const count=v.getUint16(o,true);o+=2;
 for(let i=0;i<count;i++){
  if(!has(14))return null;
  const slot=v.getUint16(o,true),head=v.getUint8(o+2);
  if(head&~KNOWN||(head&3)===3)return null;
  const pos=[0,1,2].map(k=>(v.getUint16(o+3+k*3,true)+v.getUint8(o+5+k*3)*0x10000)/STEPS+ORIGIN);
  const turned=v.getUint16(o+12,true)/YAW_STEPS*TURN;o+=14;
  const pose={pos,yaw:turned>=Math.PI?turned-TURN:turned,grounded:!!(head&GROUNDED),rest:RESTS[head&3],stance:'stand',jumpCount:0,jumpS:-1,rise:0,emote:null,playing:!!(head&PLAYING),ball:!!(head&BALL)};
  if(head&MOTION){
   if(!has(5))return null;const first=v.getUint8(o);if(first&0xf0)return null;
   Object.assign(pose,{stance:STANCES[first&3],jumpCount:first>>2,rise:v.getInt16(o+1,true)/300,jumpS:v.getUint16(o+3,true)/1000-1});o+=5;
  }
  if(head&EMOTE){if(!has(1))return null;const n=v.getUint8(o);o+=1;if(!n||!has(n))return null;pose.emote=text(n);}
  poses.push({slot,pose});
 }
 return o===bytes.length?{identities,poses}:null;
}

// The client's half: who each slot is, learned frame by frame, forgotten with the connection.
export class WireReader{
 who=new Map();
 reset(){this.who.clear();}
 read(data){
  const frame=decodeFrame(data);if(!frame)return [];
  for(const w of frame.identities)this.who.set(w.slot,w);
  const out=[];for(const {slot,pose} of frame.poses){const w=this.who.get(slot);if(w)out.push({id:w.id,name:w.name,verified:w.verified,hat:w.hat,...pose});}
  return out;
 }
}

// A visitor's id from the random key their browser keeps: "voyager-" and the first 20 hex digits of its SHA-256, the
// same scheme as Voyager's Reach (world-core identity.ts). The key proves the id; the id alone proves nothing.
export async function actorIdOf(keyHex){
 if(!/^[0-9a-f]{64}$/.test(keyHex))return null;
 const key=new Uint8Array(keyHex.match(/../g).map(h=>parseInt(h,16)));
 const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',key));
 return 'voyager-'+[...hash.slice(0,10)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
// A display name: control characters out, spaces collapsed, at most 24 characters.
export function cleanName(name){
 if(typeof name!=='string')return '';
 return [...name.replace(UNSEEN,'').replace(/\s+/g,' ').trim()].slice(0,24).join('');
}
// Control, zero-width and direction-changing characters: nothing a name needs.
const UNSEEN=new RegExp('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]','g');

// 2: names can be Discord-verified (a Leo pass in the hello). 3: testers wear the captain's hat. 4: a pose says when its
// visitor is playing Alien Cat Invasion, and the leaderboard's messages (play, score, board). 5: a pose says when its
// visitor is rolling in a hamster ball.
export const PROTOCOL=5;
