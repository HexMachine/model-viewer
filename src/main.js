import './style.css';
import { Viewer, extOf } from './viewer.js';

const $ = (id) => document.getElementById(id);
const viewer = new Viewer($('canvas'));
const status = $('status');
const BASE = import.meta.env.BASE_URL + 'models/';
const enc = (p) => BASE + p.split('/').map(encodeURIComponent).join('/');

function say(msg, isError = false) {
  status.hidden = !msg;
  status.textContent = msg || '';
  status.classList.toggle('error', isError);
}

function showInput(src) {
  $('pane-input').hidden = !src;
  if (src) $('input-img').src = src;
  $('label-3d').textContent = src ? '3D output' : '3D model';
  viewer.resize();
}

async function run(promise, name) {
  say(`Loading ${name}…`);
  try {
    const info = await promise;
    say('');
    $('empty').classList.add('gone');
    const s = info.size;
    const n = (v) => v.toLocaleString();
    $('st-tris').textContent = n(info.triangles);
    $('st-tris').title = info.triangles >= 1000 ? `${(info.triangles / 1000).toFixed(1)}k` : '';
    $('st-verts').textContent = n(info.vertices);
    $('st-meshes').textContent = n(info.meshes);
    $('st-size').textContent = `${s.x.toPrecision(3)} × ${s.y.toPrecision(3)} × ${s.z.toPrecision(3)}`;
    $('stats').hidden = false;
    const sel = $('anim-select');
    sel.hidden = !info.clips.length;
    sel.innerHTML = '<option value="-1">No animation</option>' +
      info.clips.map((c, i) => `<option value="${i}">${c.name || 'Clip ' + (i + 1)}</option>`).join('');
    sel.value = info.clips.length ? '0' : '-1';
  } catch (e) {
    console.error(e);
    say(`Could not load ${name}: ${e.message || e}`, true);
  }
}

// --- local files (never leave the browser) ---
function openFiles(files) {
  files = [...files];
  if (!files.length) return;
  document.querySelectorAll('.card.active').forEach((b) => b.classList.remove('active'));
  showInput(null);
  const main = files.find((f) => ['glb', 'gltf', 'fbx', 'obj'].includes(extOf(f.name)));
  run(viewer.load(files), main?.name ?? 'files');
}
$('file-input').addEventListener('change', (e) => { openFiles(e.target.files); e.target.value = ''; });
$('dropzone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file-input').click(); } });

let depth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; $('drop').hidden = false; });
addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('drop').hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); depth = 0; $('drop').hidden = true; openFiles(e.dataTransfer.files); });

// --- examples: input image -> 3D output ---
async function loadDemos() {
  const list = $('demo-list');
  try {
    const res = await fetch(BASE + 'manifest.json');
    if (!res.ok) throw new Error(res.status);
    const demos = await res.json();
    list.innerHTML = '';
    if (!demos.length) { list.innerHTML = '<p class="hint">No examples yet — add files to public/models/.</p>'; return; }
    for (const d of demos) {
      const card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.innerHTML = `<div class="thumb">${d.image ? `<img src="${enc(d.image)}" alt="" loading="lazy" />` : ''}` +
        `${d.image ? '<span class="arrow">→</span>' : ''}<div class="ph">3D</div></div>` +
        `<div class="meta"><span></span><span class="badge">${d.format}</span></div>`;
      card.querySelector('.meta span').textContent = d.name;
      card.onclick = () => {
        list.querySelectorAll('.card').forEach((x) => x.classList.remove('active'));
        card.classList.add('active');
        showInput(d.image ? enc(d.image) : null);
        run(viewer.load(enc(d.file), { mtl: d.mtl && enc(d.mtl) }), d.name);
      };
      list.append(card);
    }
    list.querySelector('.card')?.click();
  } catch {
    list.innerHTML = '<p class="hint">Could not load the example list.</p>';
  }
}
loadDemos();

// --- view controls ---
function toggle(id, fn) {
  const b = $(id);
  b.onclick = () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); fn(on);
  };
}
toggle('opt-rotate', (v) => viewer.setAutoRotate(v));
toggle('opt-wire', (v) => viewer.setWireframe(v));
toggle('opt-grid', (v) => viewer.setGrid(v));
toggle('opt-light', (v) => viewer.setLightBackground(v));
$('btn-reset').onclick = () => viewer.resetCamera();
$('anim-select').onchange = (e) => viewer.playClip(+e.target.value);
