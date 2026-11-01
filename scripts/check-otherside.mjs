// What the walk makes of Otherside's glyph:ready (src/walk/net/otherside.js), whichever likely shape it comes in, and
// that anything else, or anything unusable in it, is left alone.
import assert from 'node:assert/strict';
import {readGlyph} from '../src/walk/net/otherside.js';
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
console.log('Otherside glyph:ready: all checks passed');
