// What the walk makes of Otherside's glyph:ready (src/walk/net/otherside.js), whichever likely shape it comes in, and
// that anything else, or anything unusable in it, is left alone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readGlyph,onGlyph} from '../src/walk/net/otherside.js';
import {codeFor,installKeyCodeFallback} from '../src/walk/key-code.js';
const wallet='0x1111111111111111111111111111111111111111';
const fields={walletAddress:wallet,chainId:33139,username:' Cosmo ',profileImageUrl:'https://example.com/a.png'};
const full={wallet,chainId:33139,username:'Cosmo',picture:'https://example.com/a.png'};
for(const [what,data] of Object.entries({
 'flat':{type:'glyph:ready',...fields},
 'payload':{type:'glyph:ready',payload:fields},
 'data':{event:'glyph:ready',data:fields},
 'nested user':{type:'glyph:ready',payload:{user:fields}},
 'JSON text':JSON.stringify({type:'glyph:ready',payload:fields}),
 'address field':{type:'glyph:ready',...fields,walletAddress:undefined,address:wallet},
}))assert.deepEqual(readGlyph(data),full,what);
assert.deepEqual(readGlyph('glyph:ready'),{wallet:null,chainId:null,username:null,picture:null},'bare name');
for(const data of [null,undefined,5,'hello','{broken',{},{type:'other',...fields},[]])assert.equal(readGlyph(data),null,JSON.stringify(data));
const odd=readGlyph({type:'glyph:ready',walletAddress:'0x12',chainId:'nope',username:'  ',profileImageUrl:'javascript:alert(1)'});
assert.deepEqual(odd,{wallet:null,chainId:null,username:null,picture:null},'unusable fields');
assert.equal(readGlyph({type:'glyph:ready',chainId:'33139'}).chainId,33139,'chain ID as text');
// When it counts: only with a wallet or a username, from Otherside, until a wallet has come.
{globalThis.window={};const got=[];onGlyph(g=>got.push(g));const send=(data,origin='https://www.otherside.xyz')=>window.LEO_HEAR({origin,data});
 send('glyph:ready');send({type:'glyph:ready',payload:{unknownField:'x'}});send({type:'glyph:ready',walletAddress:'0x12',username:'  '});
 assert.equal(got.length,0,'an empty or unreadable message is not an identity');
 send({type:'glyph:ready',username:'Evil'},'https://example.com');assert.equal(got.length,0,'another origin is ignored');
 send({type:'glyph:ready',username:'Cosmo'});send({type:'glyph:ready',username:'Cosmo'});assert.equal(got.length,1,'a username counts, once');
 send({type:'glyph:ready',...fields});assert.equal(got.length,2,'a wallet after that still counts');assert.equal(got[1].wallet,wallet);
 send({type:'glyph:ready',...fields,username:'Later'});assert.equal(got.length,2,'nothing counts after a wallet');
 delete globalThis.window;}
// Keys with no `code` (Otherside's browser): the code comes from keyCode, which there is a Windows virtual-key number.
// Seen in Otherside's own probe: W/A/Z as 87/65/90, Space as 32, left Alt as 164, every code empty.
for(const [keyCode,key,location,code] of [[87,'w',0,'KeyW'],[65,'A',0,'KeyA'],[90,'z',0,'KeyZ'],[32,' ',0,'Space'],[164,'Alt',1,'AltLeft'],
 [160,'Shift',1,'ShiftLeft'],[161,'Shift',2,'ShiftRight'],[16,'Shift',2,'ShiftRight'],[16,'Shift',0,'ShiftLeft'],[162,'Control',1,'ControlLeft'],[18,'Alt',2,'AltRight'],
 [49,'!',0,'Digit1'],[13,'Enter',0,'Enter'],[13,'Enter',3,'NumpadEnter'],[27,'Escape',0,'Escape'],[9,'Tab',0,'Tab'],[37,'ArrowLeft',0,'ArrowLeft'],
 [192,'`',0,'Backquote'],[114,'F3',0,'F3'],[0,'e',0,'KeyE'],[0,' ',0,'Space'],[0,'Shift',2,'ShiftRight'],[0,'Unidentified',0,''],[229,'Process',0,'']])
 assert.equal(codeFor(keyCode,key,location),code,`keyCode ${keyCode}, key ${JSON.stringify(key)}`);
// A keyup names the same code as its keydown even when Shift changed the key between them.
assert.equal(codeFor(87,'W',0),codeFor(87,'w',0),'Shift does not change the code');
// Every code the walk compares against can come out of a keyCode.
{const reachable=new Set();for(let k=0;k<256;k++)for(const loc of [0,1,2,3])reachable.add(codeFor(k,'',loc));
 const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.js'))files.push(p);}};walk('src/walk');walk('src/v2');
 const used=new Set();for(const f of files){const s=fs.readFileSync(f,'utf8');if(!/\.code\b/.test(s))continue;
  for(const [,c] of s.matchAll(/['"`]((?:Key[A-Z]|Digit[0-9]|Numpad[A-Za-z0-9]+|Arrow(?:Up|Down|Left|Right)|(?:Shift|Control|Alt|Meta)(?:Left|Right)|Bracket(?:Left|Right)|IntlBackslash|Space|Enter|Escape|Tab|Backspace|Backquote|Minus|Equal|Comma|Period|Slash|Semicolon|Quote|F[0-9]{1,2}))['"`]/g))used.add(c);}
 const missing=[...used].filter(c=>!reachable.has(c));assert.deepEqual(missing,[],'codes the walk uses that no keyCode gives');}
// The fallback fills in only an empty code, once, and leaves a real one alone.
{class Fake{constructor(code,keyCode,key,location){Object.assign(this,{_code:code,keyCode,key,location});}get code(){return this._code;}}
 assert.equal(installKeyCodeFallback(Fake.prototype),true,'installs');assert.equal(installKeyCodeFallback(Fake.prototype),false,'installs once');
 assert.equal(new Fake('',87,'w',0).code,'KeyW','empty code filled in');assert.equal(new Fake('Unidentified',32,' ',0).code,'Space','Unidentified filled in');
 assert.equal(new Fake('KeyQ',87,'w',0).code,'KeyQ','a real code is kept');}
console.log('Otherside glyph:ready and key codes: all checks passed');
