// What the walk makes of Otherside's glyph:ready (src/walk/net/otherside.js), whichever likely shape it comes in, and
// that anything else, or anything unusable in it, is left alone.
import assert from 'node:assert/strict';
import {readGlyph,onGlyph} from '../src/walk/net/otherside.js';
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
console.log('Otherside glyph:ready: all checks passed');
