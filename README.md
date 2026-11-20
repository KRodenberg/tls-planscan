# PlanScan

A terrestrial laser scanning station planner for TLS Tools. Place stations and targets on an image, PDF page or Google Maps underlay, assign density profiles, estimate scan time, and export an annotated QA plan.

## Run locally

Use **Node.js 22.13 or newer** (Node 22 is recorded in `.nvmrc`).

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. The app starts with a labelled illustrative sample. Choose **New** for an empty plan or **Upload plan** to replace the sample.

```sh
npm test
npm run build
```

For browser regression and accessibility checks:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite starts an isolated local server, exercises import/edit/save/export workflows, checks interrupted gestures and map reloads, scans desktop and phone settings for accessibility, and prints its temporary artifact directory.

The build emits a self-contained Worker ES module at `dist/server/index.js`. It default-exports a `fetch(request, env)` handler and serves both assets and the map endpoint. Use a Worker-compatible host at the domain root with HTTPS. GitHub stores the source; GitHub Pages alone does not run the map endpoint. An existing checkout-local `.openai/hosting.json`, when present, is copied into the build; a fresh clone builds without it.

## Planning

- Upload PNG, JPG, WEBP or PDF, up to 25 MiB. PDF import includes a page picker and preview. Images preserve their orientation and aspect ratio.
- Select **Low**, **Medium** or **High**, then click the plan. Time per scan accepts minutes (`5`) or minutes and seconds (`02:30`). Valid edits update totals immediately. Invalid fields retain the last valid estimate and block save/export until corrected.
- **Set scale** accepts two image coordinates and their known separation in metres or feet. **Pick points on plan** provides the pointer workflow. View zoom remains separate from physical calibration. Coordinates use the chosen unit.
- Use **Select**, the station list, or **Add scan / Add target** to edit positions. Selection exposes density, coordinates, a note and **Edit links**. Clicking two stations with the Link tool adds or removes their link.
- Rotation moves the underlay and all stations together. Clear, replacement, rotation and station edits support undo/redo. Station numbers remain monotonic after deletion.

Keyboard shortcuts: **V** select, **S** scan, **T** target, **L** link, **C** pick scale points, **H** or hold **Space** to pan, **F** fit, arrow keys to move the selected station, **Delete** remove, **Ctrl/Cmd Z** undo, **Ctrl/Cmd Shift Z** redo, **Ctrl/Cmd S** save, and **Ctrl/Cmd O** open. Native buttons also support Enter and Space.

## Projects and QA exports

**Save project** downloads a portable `.planscan.json` with uploaded imagery, stations, targets, links, identities, profile durations, allowance, calibration, display settings and output choices. **Open** restores it. IndexedDB saves the current draft on this device. Save a separate project file before starting another plan if you need both copies; undo can also recover the previous plan in the current session.

Legacy Fabric TXT templates can be imported. Inspect their scan times and links because the predecessor did not serialize all settings.

**Export QA plan** previews PDF or PNG output with explicit A4/A3 paper and portrait/landscape orientation. The output includes project/site, revision/date, underlay and PDF page, station IDs, density counts and times, setup allowance, total, and a calibrated scale bar when available. Export geometry is independent of browser dimensions. Export choices are retained with the project.

## Google Maps

Enable the [Maps Static API](https://developers.google.com/maps/documentation/maps-static/start) and billing, then provide a key in the map dialog. Alternatively, copy `.env.example` to `.env` and set `GOOGLE_MAPS_API_KEY`; `npm run dev` loads that file. On a deployed Worker, configure the key as a runtime secret.

Keys entered in the dialog last for the browser session and are excluded from project files and drafts. Uploaded plans stay in the browser. The server sends map locations to Google, fetches imagery without caching, and does not persist the key or map image. Google imagery is omitted from saved projects; reopen the project and reload its map. Reload preserves manual calibration and station positions when dimensions match. Coordinate-based Maps scale is approximate Web Mercator scale; confirm it with a known distance for measured work. Attribution remains part of the image. Use is subject to Google's terms and imagery permissions.

Live Google Maps success requires a configured credential. Provider failures and map restoration are tested with simulated responses; no live API key is included.

## Source and checks

- `client/`: browser editor, project model, export renderer and SVG sample.
- `server/handler.mjs`: asset and Google Maps request handler.
- `scripts/`: local server and Worker build.
- `tests/`: duration, identity, persistence, geometry and server regressions.
- `.github/workflows/ci.yml`: clean install, tests, build and browser checks on pushes and pull requests.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md): product requirements and interface direction.
- [Review follow-up](docs/REVIEW_FOLLOW_UP.md): scope, completed fixes and verification limits.

The sample underlay is authored in `client/assets/sample-plan.svg`; its stations are illustrative data.
