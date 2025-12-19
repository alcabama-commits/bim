<!-- Copilot / AI agent instructions for the bim repo -->
# Copilot instructions — bim

Purpose
- Help an AI code assistant become productive quickly in this multi-project repository (DXF/IFC/PDF viewers, utilities, and static sites).

Quick orientation
- Top-level projects: `VSR_DWG`, `VSR_DWG - copia`, `VSR_IFC`, `VSR_PDF`, `visorIFC`, plus `libs` and `Models` with large IFC/DXF files.
- Many subprojects are independent web apps (some Vite + TypeScript, some plain HTML/JS). Check the subfolder `package.json` before changing build scripts.

Key files & locations (examples)
- Project README (DXF viewer): [VSR_DWG - copia/README.md](VSR_DWG%20-%20copia/README.md)
- DXF parsing and viewer logic: [VSR_DWG - copia/services/dxfParser.ts](VSR_DWG%20-%20copia/services/dxfParser.ts) and [VSR_DWG - copia/viewer.ts](VSR_DWG%20-%20copia/viewer.ts)
- IFC viewer code and wasm assets: [VSR_IFC/src](VSR_IFC/src) and [VSR_IFC/public/wasm](VSR_IFC/public/wasm)
- Shared/utility libs: [libs](libs) (contains `package.json`, jest config and `web-ifc-viewer` helper)

Big-picture architecture
- This repo is a monorepo-like collection of small, mostly independent viewers and demos.
- Data flow pattern: large model files live under `Models/` or `VSR_IFC/models/`; viewer code loads these assets (via fetch or direct file input) and renders in-browser using WebGL/three.js or WebAssembly-based viewers.
- Integration points: viewers link to compiled JS/CSS in each project's `assets/` or to local `wasm` under `public/` for IFC; many pages are designed to be served as static sites (GitHub Pages).

Developer workflows (discovered from READMEs and package.json files)
- Check for a `package.json` in the subfolder before running commands.
- Typical commands per project:
  - Install: `npm install`
  - Dev (Vite projects): `npm run dev` (look for `vite` in `package.json`)
  - Build: `npm run build`
  - Serve static builds (simple): use `npx serve` or `npm run serve` if provided
- Example (DXF viewer): go to `VSR_DWG - copia`, run `npm install`, then `npm run build` and open the generated `index.html` or serve the folder.

Project-specific conventions
- TypeScript + Vite is used in several viewer projects (`visorIFC`, `VSR_IFC`, `VSR_PDF`). Expect `src/`, `assets/`, and `vite.config.ts` in those folders.
- Some folders (e.g., `dist-MAG/`, `docs/`) contain prebuilt static outputs — avoid editing generated files in `assets/` unless updating build sources.
- Large binary assets (.ifc, wasm) are stored in `Models/`, `VSR_IFC/models/`, and `VSR_IFC/public/wasm/`. When changing loaders, update paths used by the pages.

Patterns to follow when authoring code or pull requests
- Respect per-project package.json scripts — mirror the project's existing build/dev pattern.
- Prefer editing TypeScript source under `src/` (or `.ts` files in the project root) rather than editing compiled JS under `assets/`.
- When adding dependencies, add them to the correct subproject `package.json` (not root) and document the change in that subproject's README.

Search hints for maintainers
- Find viewers: search for `vite.config.ts` or `index.html` at a project root.
- Find parsers: search `dxfParser` or `web-ifc` in `libs/` and `services/` folders.

When you are unsure
- Run the subproject locally (install + dev/build) to confirm behavior before making broad changes.
- If a change touches compiled outputs in `dist-*/`, update the corresponding source files in that project's `src/` or root files instead.

What I didn’t find (ask the user)
- Monorepo tooling (no root-level workspace config like PNPM workspaces or Yarn workspaces detected). Confirm whether you prefer per-project npm or a unified workspace.

Next steps (ask maintainers)
- Confirm preferred local dev command for each subproject (dev vs build+serve).
- Confirm whether adding a root-level workspace is acceptable if we want unified dependency installs.

If you (maintainer) read this and want changes: reply with missing scripts, preferred dev commands, or any project-level nuance to incorporate.
