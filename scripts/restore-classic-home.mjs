import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// The full model inspector remains the home page. The redesigned walk uses its
// own prepared assets and manifest; never replace these with the legacy walk.
export async function restoreClassicHome(out, {source = 'dist'} = {}) {
  if (path.resolve(out) === path.resolve(source)) throw new Error('Classic source and destination must differ');
  const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
  if (!html.includes('id="explode-dial"') || !html.includes('LEO_PUBLIC_ASSETS=')) {
    throw new Error('Expected the complete, publicly packaged classic viewer');
  }
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'asset-manifest.json'), 'utf8'));
  const files = new Set(['README.md', 'gl-check.html', 'THREE-LICENSE.txt']);
  for (const entry of Object.values(manifest)) for (const part of entry.parts) files.add(part.split('?')[0]);
  for (const name of await fs.readdir(source)) {
    if (/^(viewer|cosmo)\.[0-9a-f]{10}\.js$/.test(name) || /^hydro-nip-main-logo\.[0-9a-f]{10}\.jpg$/.test(name)) files.add(name);
  }
  async function addDirectory(relative) {
    for (const entry of await fs.readdir(path.join(source, relative), {withFileTypes:true})) {
      const file = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await addDirectory(file); else files.add(file);
    }
  }
  await addDirectory('brand');
  // Check every collision before writing: the current walk owns its assets.
  for (const file of files) {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error('Unsafe classic asset path');
    const data = await fs.readFile(path.join(source, file));
    try {
      const existing = await fs.readFile(path.join(out, file));
      if (!existing.equals(data)) throw new Error('Classic asset conflicts with current walk: ' + file);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(out, file)), {recursive:true});
    await fs.copyFile(path.join(source, file), path.join(out, file));
  }
  await fs.copyFile(path.join(out, 'index.html'), path.join(out, 'layout2.html'));
  await fs.writeFile(path.join(out, 'index.html'), html);
  const provenance = {viewer:'classic', layout:1, indexSha256:createHash('sha256').update(html).digest('hex'), walk:'layout 2', layout2Viewer:'layout2.html'};
  await fs.writeFile(path.join(out, 'viewer-version.json'), JSON.stringify(provenance, null, 2) + '\n');
  return provenance;
}
