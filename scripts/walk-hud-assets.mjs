import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const source = new URL('../src/walk/hud/', import.meta.url);
const generated = /^walk-hud(?:-arcade-(?:concourse|flight|orbit)|-arrival-stamp)?\.[a-f0-9]{10}\.(?:webp|css|js)$/;

// Publish only the standalone walk's interface. CSS points to immutable illustrations so
// the browser fetches the selected edition's artwork when its control becomes visible.
export async function withWalkHud(html, out) {
  const files = new Set();
  async function publish(stem, extension, bytes) {
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const name = stem + '.' + hash + '.' + extension;
    await fs.writeFile(path.join(out, name), bytes);
    files.add(name);
    return name;
  }
  let css = await fs.readFile(new URL('editions.css', source), 'utf8');
  for (const image of ['arcade-concourse', 'arcade-flight', 'arcade-orbit', 'arrival-stamp']) {
    const filename = image + '.webp';
    const asset = await publish('walk-hud-' + image, 'webp', await fs.readFile(new URL(filename, source)));
    css = css.replaceAll(filename, asset);
  }
  const style = await publish('walk-hud', 'css', css);
  const script = await publish('walk-hud', 'js', await fs.readFile(new URL('editions.js', source)));
  for (const old of await fs.readdir(out)) {
    if (generated.test(old) && !files.has(old)) await fs.unlink(path.join(out, old));
  }
  return html.replace('</head>', '<link rel="stylesheet" href="' + style + '"><script type="module" src="' + script + '"></script></head>');
}
