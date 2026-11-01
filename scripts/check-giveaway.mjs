// Mudwater Arena's giveaway and counts (server/arena.mjs), headless, on files in a temporary folder: closed by default
// and when misconfigured; codes, wallet and list modes each give one claim per Discord-verified visitor and show it again;
// a visitor not signed in, or a wallet not theirs, is refused; codes and the limit run out; form mode only links; the
// counts tell visits from visitors, and their report holds no names, ids or wallets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createArena,readGiveaway} from '../server/arena.mjs';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leo-giveaway-'));
const files=n=>({giveaway:path.join(dir,`g${n}.json`),claims:path.join(dir,`c${n}.json`),stats:path.join(dir,`s${n}.json`)});
let run=0;
function arenaWith(config,day='2026-10-26'){const f=files(++run);if(config)fs.writeFileSync(f.giveaway,JSON.stringify(config));return createArena({files:f,today:()=>day,watch:false});}
const W1='0x'+'a'.repeat(40),W2='0x'+'b'.repeat(40);
const verified=(id,wallets=[W1])=>({id:'v'+id,name:'Cat '+id,discord:{discordId:'d'+id,username:'cat'+id,wallets}});
const guest=id=>({id:'g'+id,name:null,discord:null});

// Closed: no file, open:false, or settings that can't work.
expect(!arenaWith(null).statusFor(verified(1)).open,'with no giveaway file the card says details are coming');
expect(!arenaWith({open:false,mode:'codes',codes:['AAAA-1']}).statusFor(verified(1)).open,'open: false keeps it closed');
expect(!readGiveaway({open:true,mode:'codes',codes:[]}).open&&!readGiveaway({open:true,mode:'form'}).open&&!readGiveaway({open:true,mode:'raffle'}).open,
 'codes with no codes, a form with no link and an unknown mode all stay closed');
expect(!readGiveaway({open:true,mode:'form',formUrl:'javascript:alert(1)'}).open,'a form link must be https');

// Codes: one each, the same one again, none for a guest, sold out when they run out.
{const a=arenaWith({open:true,mode:'codes',note:'One each',codes:['AAAA-1','BBBB-2']});
 const s=a.statusFor(guest(1));expect(s.open&&s.mode==='codes'&&!s.verified&&s.note==='One each','a guest sees the giveaway open, and that they need to sign in');
 expect(a.claim(guest(1),{}).why==='sign-in','a guest cannot claim');
 const kept={...verified(9),discord:{...verified(9).discord,lapsed:true}},ks=a.statusFor(kept);
 expect(!ks.verified&&ks.remembered&&!ks.wallets.length&&a.claim(kept,{}).why==='sign-in','a remembered visitor (a lapsed pass) is asked to connect Discord again to claim, and shown no wallets');
 const glyph={id:'gl',name:'Gale',discord:{discordId:'glyph:'+W1,username:'gale',wallets:[W1],lapsed:false,glyph:true}},gs=a.statusFor(glyph);
 expect(!gs.verified&&!gs.wallets.length&&!gs.claim&&a.claim(glyph,{}).why==='sign-in','a wallet from Otherside is asked to connect Discord to claim, and shown no wallets');
 const one=a.claim(verified(1),{}),again=a.claim(verified(1),{}),two=a.claim(verified(2),{}),three=a.claim(verified(3),{});
 expect(one.ok&&one.code==='AAAA-1'&&again.ok&&again.again&&again.code==='AAAA-1','a verified visitor gets a code, and the same code if they claim again');
 expect(two.code==='BBBB-2'&&!three.ok&&three.why==='sold-out','the next visitor gets the next code; with none left it is sold out');
 expect(a.statusFor(verified(1)).claim?.code==='AAAA-1'&&a.statusFor(verified(4)).soldOut,'the card shows a claimed code again, and sold out to someone new');}

// Wallet: to one of their own verified wallets only.
{const a=arenaWith({open:true,mode:'wallet'});
 expect(a.statusFor(verified(1,[W1,W2])).wallets.length===2,'the card lists the visitor\'s verified wallets');
 expect(a.claim(verified(1,[]),{}).why==='no-wallet','no verified wallet, no claim');
 expect(a.claim(verified(2,[W1]),{wallet:W2}).why==='wallet','a wallet that is not theirs is refused');
 const r=a.claim(verified(3,[W1,W2]),{wallet:W2});expect(r.ok&&r.wallet===W2,'a claim goes to the chosen verified wallet');}

// List with a limit.
{const a=arenaWith({open:true,mode:'list',limit:1});
 expect(a.claim(verified(1),{}).ok&&a.claim(verified(2),{}).why==='sold-out','list mode takes names up to its limit');}

// Form: nothing claimed here.
{const a=arenaWith({open:true,mode:'form',formUrl:'https://example.com/claim'});
 const s=a.statusFor(guest(1));expect(s.open&&s.formUrl==='https://example.com/claim'&&a.claim(verified(1),{}).why==='closed','form mode shows the link to anyone and claims nothing');}

// Claims survive a restart: the file is read back.
{const f=files(++run);fs.writeFileSync(f.giveaway,JSON.stringify({open:true,mode:'codes',codes:['CCCC-3','DDDD-4']}));
 const a=createArena({files:f,watch:false});a.claim(verified(9),{});await new Promise(r=>setTimeout(r,1300));
 const b=createArena({files:f,watch:false});expect(b.statusFor(verified(9)).claim?.code==='CCCC-3'&&b.claim(verified(8),{}).code==='DDDD-4','claims are kept across a restart, and codes are not given twice');}

// Counts: visits and different visitors per day, game opens, card opens, claims; no personal data in the report.
{const a=arenaWith({open:true,mode:'codes',codes:['EEEE-5']});
 for(const v of [guest(1),guest(1),guest(2)])a.event(v,'enter');a.event(guest(1),'play');a.event(guest(1),'card');a.event(guest(1),'nonsense');a.claim(verified(1),{});
 const r=a.report(),d=r.days['2026-10-26'];
 expect(d.visits===3&&d.visitors===2&&d.plays===1&&d.cards===1&&d.claims===1,`the day's counts add up (${JSON.stringify(d)})`);
 const text=JSON.stringify(r);expect(!/Cat 1|cat1|d1|g1|0x/.test(text)&&r.giveaway.claimed===1,'the report has totals only: no names, ids or wallets');}

fs.rmSync(dir,{recursive:true,force:true});
if(problems.length){console.log(`\n${problems.length} problem(s)`);process.exit(1);}
console.log('\nMudwater giveaway: all checks passed');
