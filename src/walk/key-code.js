// Otherside's in-game browser (Unreal's Chromium) sends key events with an empty `code`, and every key handler in the
// walk reads `code` (WASD, Space, Shift, E, the games, the settings), so nobody could move there. Where `code` is
// empty, this fills it in from keyCode, which that browser does send (as Windows virtual-key numbers: its left Alt is
// 164, not 18), and failing that from key. keyCode comes first because key changes with Shift ('a' or 'A', '1' or '!'):
// a keyup has to name the same code as its keydown, or the walker would keep walking. Browsers that send `code` are
// untouched. It changes KeyboardEvent itself, so it doesn't matter which handler was added first.
const NAMED={8:'Backspace',9:'Tab',12:'NumpadEqual',19:'Pause',20:'CapsLock',27:'Escape',32:'Space',33:'PageUp',34:'PageDown',
 35:'End',36:'Home',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',44:'PrintScreen',45:'Insert',46:'Delete',
 91:'MetaLeft',92:'MetaRight',93:'ContextMenu',106:'NumpadMultiply',107:'NumpadAdd',109:'NumpadSubtract',110:'NumpadDecimal',
 111:'NumpadDivide',144:'NumLock',145:'ScrollLock',160:'ShiftLeft',161:'ShiftRight',162:'ControlLeft',163:'ControlRight',
 164:'AltLeft',165:'AltRight',186:'Semicolon',187:'Equal',188:'Comma',189:'Minus',190:'Period',191:'Slash',192:'Backquote',
 219:'BracketLeft',220:'Backslash',221:'BracketRight',222:'Quote',226:'IntlBackslash'};
// keyCode 16, 17 and 18 name a modifier without its side; the event's location says which (2 is the right one).
const SIDED={16:'Shift',17:'Control',18:'Alt'};
const KEY_NAMES=/^(Arrow(Up|Down|Left|Right)|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|F\d{1,2})$/;

// The code a key event would have named, from its keyCode, key and location; '' if none fits.
export function codeFor(keyCode,key,location){
 if(keyCode>=65&&keyCode<=90)return 'Key'+String.fromCharCode(keyCode);
 if(keyCode>=48&&keyCode<=57)return 'Digit'+(keyCode-48);
 if(keyCode>=96&&keyCode<=105)return 'Numpad'+(keyCode-96);
 if(keyCode>=112&&keyCode<=135)return 'F'+(keyCode-111);
 if(keyCode===13)return location===3?'NumpadEnter':'Enter';
 if(SIDED[keyCode])return SIDED[keyCode]+(location===2?'Right':'Left');
 if(NAMED[keyCode])return NAMED[keyCode];
 if(typeof key!=='string'||!key)return '';
 if(/^[a-z]$/i.test(key))return 'Key'+key.toUpperCase();
 if(/^[0-9]$/.test(key))return (location===3?'Numpad':'Digit')+key;
 if(key===' '||key==='Spacebar')return 'Space';
 if(key==='Esc')return 'Escape';
 if(['Shift','Control','Alt','Meta'].includes(key))return key+(location===2?'Right':'Left');
 if(KEY_NAMES.test(key))return key==='Enter'&&location===3?'NumpadEnter':key;
 return '';
}

// Makes `code` fall back to codeFor where the browser leaves it empty. Returns whether it did (once per prototype).
const DONE=Symbol.for('leo.keyCodeFallback');
export function installKeyCodeFallback(proto=globalThis.KeyboardEvent?.prototype){
 const own=proto&&Object.getOwnPropertyDescriptor(proto,'code');
 if(!own?.get||!own.configurable||proto[DONE])return false;
 Object.defineProperty(proto,'code',{configurable:true,enumerable:own.enumerable,get(){
  const code=own.get.call(this);
  return code&&code!=='Unidentified'?code:codeFor(this.keyCode,this.key,this.location);
 }});
 Object.defineProperty(proto,DONE,{value:true});
 return true;
}
installKeyCodeFallback();
