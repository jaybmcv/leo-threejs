// Whether this start walks the arrival hall first (arrival-preview.js) while the whole ship downloads and builds behind
// it: a desktop walking the full ship (not the phone ship, nor a touch screen: the hall takes keys and a mouse only),
// with an arrival pack cut from this very prepared walk, starting where main.js would put it anyway, in the arrival
// hall: no walk link, no spot kept from the last 10 minutes (last-spot.js), not the owner bake, and not under automation
// (navigator.webdriver: the deploy's walk checks, play tests and bakes start as before, as with the resolution step-down;
// scripts/check-arrival-walk.mjs hides it to measure this). ?arrival=0 starts as before, on the loading card, to compare.
// Decided before the prepared ship is read (prepared-resource.public.js), which waits for it at once on any other start.
import * as T from 'three';
import {readSpot} from '../walk/link.js';
import {peekSpot} from '../walk/last-spot.js';
import {loadCosmoScript} from '../walk/cosmo-script.js';
import {preparedFetcher} from './prepared-fetch.js';

const query=new URLSearchParams(location.search),assets=globalThis.LEO_PUBLIC_ASSETS||{};
// The pack's entry in the asset manifest (scripts/arrival-pack-public.mjs), only if it was cut from the prepared walk
// this page loads.
export const arrivalPack=(()=>{const pack=assets['walk-arrival'],prepared=assets['walk-prepared'];
 return pack?.parts?.length&&pack.source&&prepared?.sha256&&pack.source===prepared.sha256?pack:null;})();
export const arrivalStart=!!arrivalPack&&!globalThis.LEO_WALK_PHONE&&!matchMedia('(pointer:coarse)').matches&&!navigator.webdriver
 &&query.get('arrival')!=='0'&&!query.has('ownerBake')&&!readSpot()&&!peekSpot();
// The pack (a few tries, as the ship's files get: prepared-fetch.js) and Cosmo's script, asked for before anything else.
// The ship's own download starts once both have come or failed (prepared-resource.public.js): on a slow link the hall is
// walkable in seconds, and the ship, which shares the link either way, is in no later.
export const arrivalDownload=arrivalStart?(()=>{
 const url=new URL(arrivalPack.parts[0],import.meta.url),bytes=preparedFetcher(new URL('./',url),{fetch:u=>fetch(u,{priority:'high'})})(url.pathname.split('/').pop());
 const cosmo=loadCosmoScript(T);return {bytes,cosmo,settled:Promise.allSettled([bytes,cosmo])};
})():null;
