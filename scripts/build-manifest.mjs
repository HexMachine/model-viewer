// Scans public/models for demo files and writes public/models/manifest.json.
// Drop a .glb/.gltf/.fbx/.obj into public/models, commit, push — it shows up in the demo list.
// An example's input image is a sibling named <name>.png|jpg|webp or <name>_input.png|jpg|webp.
// A demo may be a folder (e.g. public/models/robot/robot.gltf + textures); the first model file found is used.
import { readdirSync, statSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { join, extname, basename, relative } from 'node:path';

const root = new URL('../public/models', import.meta.url).pathname;
const EXT = new Set(['.glb', '.gltf', '.fbx', '.obj']);
const demos = [];

function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (EXT.has(extname(name).toLowerCase())) {
      const rel = relative(root, full).split('\\').join('/');
      const stem = full.slice(0, -extname(name).length);
      const image = ['', '_input'].flatMap((suf) => ['.png', '.jpg', '.jpeg', '.webp'].map((e) => stem + suf + e)).find(existsSync);
      const mtl = full.replace(/\.obj$/i, '.mtl');
      demos.push({
        ...(extname(name).toLowerCase() === '.obj' && existsSync(mtl) ? { mtl: relative(root, mtl).split('\\').join('/') } : {}),
        ...(image ? { image: relative(root, image).split('\\').join('/') } : {}),
        name: basename(name, extname(name)).replace(/[_-]+/g, ' '),
        file: rel,
        format: extname(name).slice(1).toLowerCase(),
        size: statSync(full).size,
      });
    }
  }
}
walk(root);
writeFileSync(join(root, 'manifest.json'), JSON.stringify(demos, null, 2));
console.log(`manifest: ${demos.length} demo(s)`);

// Copy Draco decoder so compressed .glb files work with no CDN requests.
const draco = new URL('../node_modules/three/examples/jsm/libs/draco/gltf', import.meta.url).pathname;
if (existsSync(draco)) cpSync(draco, new URL('../public/draco', import.meta.url).pathname, { recursive: true });
