// The four walk pages' own part of a game's finish (walk/main*.js, which run only in a browser): the scores.submit each
// hands its game, read from the page's source and run here against a stand-in link and game.
import fs from 'node:fs';
const PAGES=['main.js','main.authoring.js','main.prepared.js','main.public.js'];
// args: the submit's parameters as the pages write them ('ms,shots'); game: the game's name in the page ('pool').
// For each page: found (the page has that submit) and submit(link,...values), which gives what the game was told (its
// setResult calls, as they come in).
export function pageSubmits(args,game){
 return PAGES.map(page=>{
  const src=fs.readFileSync(new URL('../src/walk/'+page,import.meta.url),'utf8'),body=src.match(new RegExp('\\n  submit\\('+args+'\\)\\{(.*)\\},\\r?\\n'))?.[1];
  return {page,found:!!body,submit(link,...values){const told=[];new Function('live',game,...args.split(','),body)(link,{setResult:r=>told.push(r)},...values);return told;}};
 });
}
