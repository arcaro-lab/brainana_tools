<p align="center">
  <img src="docs/_static/brainana_logo_side.png" alt="Brainana Viewer logo" width="500">
</p>

# Brainana Viewer

**Brainana Viewer** is a free, cross-platform desktop app for exploring **macaque (monkey) brain MRI** —
anatomical volumes, 3D cortical surfaces, atlases, and functional maps — from the
[**Brainana**](https://github.com/xingyu-liu/brainana) preprocessing pipeline
([preprint](https://www.biorxiv.org/content/10.64898/2026.06.03.729972v1)).
Built on [NiiVue](https://github.com/niivue/niivue) + WebGL2; runs on **macOS, Windows, and Linux**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL--v3-blue.svg)](LICENSE)

## Features

<p align="center">
  <img src="docs/_static/brainana_viewer_big.png" alt="Brainana Viewer — macaque brain MRI: cortical surface, atlas overlay, and slice views" width="900">
</p>

- **Volume & surface views** — volume slices and rotatable 3D surface.
- **Surface morphometry** —  curvature, depth, or thickness on cortex.
- **Atlases & regions** — automatically overlay brain parcellations and read the region under your cursor.
- **Functional maps** — retinotopy and somatotopy on both volume and surface.
- **Local or remote data** — dataset on your computer or a lab workstation.
- **Compare monkeys** — easily switch subjects to compare across monkeys.

## Download & install

Grab the app for your operating system from the **[Releases page](../../releases/latest)** 

| Your system | Download |
| ----------- | -------- |
| **macOS — Apple Silicon** (M1/M2/M3…) | `Brainana Viewer-*-arm64.dmg` |
| **macOS — Intel** | `Brainana Viewer-*.dmg` |
| **Windows** | `Brainana Viewer Setup *.exe` |
| **Linux** | `Brainana Viewer-*.AppImage` or `brainana-viewer_*_amd64.deb` |

> **First launch:** the app is currently **unsigned**, so macOS and Windows show a one-time
> "unidentified developer" prompt. On macOS **right-click → Open**; on Windows choose **More info
> → Run anyway**. Linux has no prompt.

Not sure which Mac chip you have? **Apple menu → About This Mac.** No account, dataset, or setup
is required — a demo subject is bundled so you can open the app and look around immediately.

## Quick start

Open the app — a demo monkey is bundled, so you can look around immediately. To load your own data:

1. **Add a dataset.** Click **dataset** (top-left) and point the Viewer at a **brainana output directory**
   (a folder containing `sub-*` subjects) — either a **local** folder or a **remote** workstation over
   **SSH/SFTP**. Add more than one if you like.
2. **Choose a monkey.** Pick a subject from the **monkey** dropdown; the default anatomy + surface view loads.
3. **Explore.** Use the toolbar and side panel to switch base volume and surface, add an **atlas**, apply
   **morphology** shading or a **func map**, and tune colormaps. Click anywhere to move the crosshair and
   read out values.
4. **Compare.** Reopen the **monkey** dropdown to switch subjects — your view settings carry over.

### Try the demo dataset

A [demo dataset](datasets/demo_viewer) is already bundled in the app. To try the **add a dataset → local folder** flow,
download just the demo (one macaque subject, `sub-example`) from this repo — needs git ≥ 2.25:

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/xingyu-liu/brainana_tools.git
cd brainana_tools
git sparse-checkout set datasets/demo_viewer     # a real brainana output dir
```

Then in the app, add `brainana_tools/datasets/demo_viewer` as a **local** dataset. On older git,
clone the whole repo instead: `git clone https://github.com/xingyu-liu/brainana_tools.git`.

---

## For developers

Everything below is for building and contributing to the Viewer, not for using the app.

**Requirements:** **Node ≥ 22.18** (unit tests import `.ts` sources directly via Node type
stripping) and a WebGL2-capable browser (Chrome/Edge baseline; Firefox/Safari supported).

```sh
npm install                                                       # workspace deps (single lockfile)
npm run server -- --port 5174 --output-dir datasets/demo_viewer   # Terminal 1: API + bundled demo data
npm run dev:web                                                   # Terminal 2: Vite UI → http://localhost:5173
```

Open the URL Vite prints and select `sub-example`. Other common commands:

```sh
npm test               # headless: domain math, server, security, sftp, built-frontend token injection, core-purity guard
npm start              # launch the Viewer: free port, 127.0.0.1 bind, open browser
npm run dev:desktop    # launch as a native Electron app (bundled Chromium)
npm run dist:desktop   # build desktop installers for THIS OS → apps/viewer/release/
```

## Architecture

An **npm-workspaces monorepo**: tool-agnostic shared `packages/*` consumed by per-tool
`apps/*`. Adding a sibling tool (Aligner, Editor) means a new `apps/<tool>/` — no duplicated
platform code.

| Package             | Responsibility                                                        |
| ------------------- | --------------------------------------------------------------------- |
| `core-server`       | HTTP runtime, security, DataSource registry (local + SFTP), cache, export |
| `core-launcher`     | `bootServer()` (token → free port → server) + `launch()` (opens browser)   |
| `core-desktop`      | Electron shell: `runDesktop()` loads the loopback URL natively        |
| `core-client`       | Browser platform: runtime/source/filesystem clients, session, WebGL2 gate |
| `ui` / `niivue-kit` | Design-token theme + DOM helpers / generic NiiVue helpers             |
| `imaging-math`      | Pure headless math (ROI warp, volume→surface projection)              |
| `apps/viewer`       | The Viewer: SPA + manifest/FreeSurfer server + launch/desktop entries |

Cross-package imports use `@brainana/*` specifiers whose `exports` map points at **raw
source**, so Vite and Node's `.ts` tests resolve identically — no build step in the test path.

## Citing Brainana

If you use the Brainana Viewer or the Brainana pipeline in your research, please cite the
Brainana preprint and link the software:

- **Paper:** Brainana — preprint,
  <https://www.biorxiv.org/content/10.64898/2026.06.03.729972v1>
- **Pipeline:** <https://github.com/xingyu-liu/brainana>
- **Viewer:** this repository.

## Acknowledgements & references

The Viewer is built on the shoulders of excellent open-source work. The key pieces:

**Core rendering & data**
- [**NiiVue**](https://github.com/niivue/niivue) ([docs](https://niivue.github.io/niivue/)) — the WebGL2 neuroimaging engine that draws every slice and surface (BSD-2-Clause).
- [**fflate**](https://github.com/101arrowz/fflate) — fast zlib/gzip for compressed NIfTI/GIFTI payloads (MIT).
- [**nifti-reader-js**](https://github.com/rii-mango/NIFTI-Reader-JS) — NIfTI-1/2 header & data parsing (MIT).
- [**ssh2**](https://github.com/mscdex/ssh2) — pure-JS SSH/SFTP client backing the remote data source (MIT).

**Build, packaging & language**
- [**TypeScript**](https://www.typescriptlang.org/) (Apache-2.0) ·
  [**Vite**](https://vitejs.dev/) (MIT) ·
  [**Electron**](https://www.electronjs.org/) (MIT) ·
  [**electron-builder**](https://www.electron.build/) (MIT) ·
  [**Node.js**](https://nodejs.org/) (≥ 22.18).

**Bundled fonts** (self-hosted, no CDN) — under the [SIL Open Font License 1.1](https://openfontlicense.org/)
- [**Source Sans 3**](https://github.com/adobe-fonts/source-sans) (UI sans-serif) ·
  [**IBM Plex Mono**](https://github.com/IBM/plex) (numeric/technical labels).

**Standards** — [NIfTI](https://nifti.nimh.nih.gov/) and
[GIFTI](https://www.nitrc.org/projects/gifti/) neuroimaging formats, and
[WebGL 2.0](https://www.khronos.org/webgl/).

## License

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0), the same license
as the parent [**Brainana**](https://github.com/xingyu-liu/brainana) pipeline. See [LICENSE](LICENSE).