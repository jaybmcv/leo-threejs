// The arcade's Neon Arena Survival (arcade.js): a game hosted outside Leo, opened in a window over the walk. The page loads
// only when the window opens and is dropped when it closes, so nothing outside loads until a visitor chooses to play. The
// frame is sandboxed without top navigation or popups: the game cannot send the visitor away from Leo, and Back to Leo
// (or Esc, while Leo has the keys) closes the window and returns to the walk where they stood.
export const NEON_ARENA_URL='https://neonarenasurvival.grok.me/';

export function openOutside(sheet,frame,url=NEON_ARENA_URL){
 sheet.classList.add('loading');sheet.hidden=false;
 frame.onload=()=>{sheet.classList.remove('loading');frame.focus();};
 frame.src=url;
}
// Drops the page, so the game stops and its sound with it.
export function closeOutside(sheet,frame){
 frame.onload=null;sheet.classList.remove('loading');
 const src=frame.getAttribute('src');if(src&&src!=='about:blank')frame.src='about:blank';
}
