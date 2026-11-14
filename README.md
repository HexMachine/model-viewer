# Model Viewer

Static in-browser viewer for `.glb`, `.gltf`, `.fbx` and `.obj` (Three.js + Vite).

- **Demos** – every model in `public/models/` is listed for all visitors.
- **Local files** – visitors can open/drag-drop their own files; they are read in the browser and never uploaded.
  Multi-file models work: select the model plus its `.mtl`, `.bin` and textures together.

## Develop
```
npm install
npm run dev
```

## Add a demo
Drop the file (or a folder with the model + textures) into `public/models/`, commit, push. The demo list is generated at build time.

## Publish on GitHub Pages
1. Push this repo to GitHub (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Each push to `main` builds and deploys via `.github/workflows/deploy.yml`.

Note: GitHub rejects files over 100 MB; keep demos small.
