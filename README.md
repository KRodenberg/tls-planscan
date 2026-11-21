# PlanScan

A terrestrial laser scanning station planner for TLS Tools. Place stations and targets on an image, PDF page or NSW Imagery Basemap underlay, assign density profiles, estimate scan time, and export an annotated QA plan.

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

The browser suite starts an isolated local server, exercises import/edit/save/export workflows, checks interrupted gestures and basemap overlays, scans desktop and phone settings for accessibility, and prints its temporary artifact directory.

The build bundles OpenLayers and Proj4 for browser map rendering, then emits a self-contained Worker ES module at `dist/server/index.js`. It default-exports a `fetch(request, env)` handler and serves both assets and the map endpoint. Use a Worker-compatible host at the domain root with HTTPS. GitHub stores the source; GitHub Pages alone does not run the map endpoint. An existing checkout-local `.openai/hosting.json`, when present, is copied into the build; a fresh clone builds without it.

## Docker and Docker Compose

Build and run the production image:

```sh
docker build -t tls-planscan:latest .
docker run --detach --name planscan --restart unless-stopped -p 4173:4173 tls-planscan:latest
```

Open **http://localhost:4173**. The multi-stage image builds the frontend once and runs the compiled app as the unprivileged `node` user. The runtime contains no installed application dependencies or build tools. Its health check uses `/api/status`, and SIGTERM stops the HTTP server gracefully.

A ready-to-use service is in [compose.example.yml](compose.example.yml):

```sh
docker compose -f compose.example.yml up -d --build
```

Set `PLANSCAN_HOST_PORT=4175` before that command if port 4173 is already in use. Copy the `planscan` service into an existing Compose file and point `build.context` at this checkout, or build the image first and remove the `build` section. Keep the container port at **4173** and change the host-side port as needed. The example runs with a read-only filesystem and needs no volumes; projects and drafts remain in the user's browser or downloaded project files.

For a reverse proxy on the same Compose network, remove `ports` and forward to **http://planscan:4173**. Preserve the original `Host` header. If the proxy terminates HTTPS, set `TRUST_PROXY: "1"` and forward `X-Forwarded-Proto` (and `X-Forwarded-Host` if the original host is not preserved). Enable this only behind your trusted proxy so same-origin basemap requests use the correct public origin. Serve the app at the domain root.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | HTTP port inside the container. Match any changed port mapping. |
| `HOST` | `0.0.0.0` | Bind address for the production server. |
| `TRUST_PROXY` | disabled | Set to `1` to accept the trusted proxy's forwarded scheme/host. |
| `PLANSCAN_HOST_PORT` | `4173` | Host port used by the example Compose file. |

Outbound HTTPS access to NSW Spatial Services is required for live imagery and address lookup. No API key is needed. For a production Node deployment without Docker, run `npm run build` then `npm start`.

For a Servarr stack with automatic updates and Cloudflare Tunnel, use [compose.servarr.yml](compose.servarr.yml) and the [deployment guide](docs/SERVARR_DEPLOYMENT.md). Pushes to `main` reach the server after CI passes and Watchtower detects the advanced `deploy` branch.

## Planning

- Upload PNG, JPG, WEBP or PDF, up to 25 MiB. PDF import includes a page picker and preview. Images preserve their orientation and aspect ratio.
- Select **Low**, **Medium** or **High**, then click the plan. Time per scan accepts minutes (`5`) or minutes and seconds (`02:30`). Valid edits update totals immediately. Invalid fields retain the last valid estimate and block save/export until corrected.
- **Set scale** accepts two image coordinates and their known separation in metres. **Pick points on plan** provides the pointer workflow. View zoom remains separate from physical calibration. Coordinates use metres when calibrated.
- Use **Select**, the station list, or **Add scan / Add target** to edit positions. Each new scan links to the previous scan, skipping targets. Link labels show the current straight-line distance in metres and update when either station moves or the plan scale changes; uncalibrated plans show **Not to scale**. Selection exposes density, coordinates, a note and **Edit links**. Clicking two stations with the Link tool adds or removes their link.
- Rotation moves the underlay and all stations together. Clear, replacement, rotation and station edits support undo/redo. Station numbers remain monotonic after deletion.

Keyboard shortcuts: **V** select, **S** scan, **T** target, **L** link, **C** pick scale points, **H** or hold **Space** to pan, **F** fit, arrow keys to move the selected station, **Delete** remove, **Ctrl/Cmd Z** undo, **Ctrl/Cmd Shift Z** redo, **Ctrl/Cmd S** save, and **Ctrl/Cmd O** open. Native buttons also support Enter and Space.

## Projects and QA exports

**Save project** downloads a portable `.planscan.json` with uploaded imagery, stations, targets, links, identities, profile durations, allowance, calibration, display settings and output choices. **Open** restores it. IndexedDB saves the current draft on this device. Save a separate project file before starting another plan if you need both copies; undo can also recover the previous plan in the current session.

Legacy Fabric TXT templates can be imported. Inspect their scan times and links because the predecessor did not serialize all settings.

**Export QA plan** previews PDF or PNG output with explicit A4/A3 paper and portrait/landscape orientation. The output includes project/site, revision/date, underlay and PDF page, station IDs, density counts and times, setup allowance, target count/time, total, and a calibrated scale bar when available. Export geometry is independent of browser dimensions. Export choices are retained with the project.

## Live NSW imagery and overlays

Choose **NSW imagery** and search an NSW address, or enter GDA2020 latitude/longitude. Initial view width sets the starting area. The source is the [NSW Imagery Basemap portal item](https://portal.spatial.nsw.gov.au/portal/home/item.html?id=c04ce33be7a04a7884f786f5beb20b19), using its [NSWWebImagery tile service](https://portal.spatial.nsw.gov.au/aid/tile/rest/services/NSWWebImagery/MapServer). No API key is required.

The basemap is a persistent live tile layer. Wheel/button zoom requests the appropriate level of detail; dragging the background or using Pan loads new areas. Imagery fills the work area and is not bounded by the initial view. OpenLayers reads the service tile grid and reprojects imagery into the project's MGA2020 zone.

Stations and image overlays use a fixed MGA2020 reference. Navigation changes the view, not their geographic coordinates. You can place or move stations beyond the initial area. Selection shows editable eastings/northings; the lower-right scale bar follows current metre resolution. The smaller source attribution sits below the active scan-profile control. Retry appears when failed tiles leave the current view without imagery; older failed requests do not trigger a warning over visible imagery. The plan stays intact during outages.

After uploading an image or selecting a PDF page, choose **Blank canvas** or **NSW imagery**. An overlay is added at the current view centre. Adjust position, width, rotation and opacity, or use the Image tool to drag it. **Set image scale** calibrates the uploaded image while keeping its first control point fixed. Image-only plans show **Not to scale** and Set scale until calibrated. All distances use metres. A standalone image has local coordinates until a global location reference is supplied.

**Target scan time**, below Move / setup, is multiplied by target count. The estimate includes profile scan time, movement/setup per scan, and target scan time. Invalid durations block save/export.

Version 4 projects retain live source settings, last view, uploaded overlays, station coordinates and timing. Basemap tiles are fetched when reopened; the basemap is not saved as a static image. Version 2/3 projects remain importable. Earlier SIX Maps projects upgrade to the current imagery layer while retaining their MGA2020 geometry.

QA export fetches imagery for an extent covering all placed stations and the uploaded overlay, including work beyond the initial view. With no placed objects it uses the current view. A separate render creates the PDF/PNG snapshot while the editor stays live. Output includes link distances, scale, MGA2020 reference, timing and attribution. Coordinate accuracy is limited by source imagery and datum transformations; these are planning coordinates.

Attribution: NSW DCS Spatial Services; SPOT Image (Geoimage GeoHD) © Airbus DS 2025, provided by DCCEEW. Imagery currency varies by area and zoom level. Location/tile requests go to NSW public services. Uploaded image bytes stay in the browser.

## Source and checks

- `client/`: browser editor, project model, export renderer and SVG sample.
- `server/handler.mjs`: assets, imagery metadata/tile proxy, and SIX address lookup handler.
- `scripts/`: development server, production server and Worker build.
- `Dockerfile` / `compose.example.yml`: production image and reusable Compose service.
- `tests/`: duration, identity, persistence, geometry and HTTP server regressions.
- `.github/workflows/ci.yml`: clean install, tests, Docker build/health check and browser checks against the production container on pushes and pull requests.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md): product requirements and interface direction.
- [Review follow-up](docs/REVIEW_FOLLOW_UP.md): scope, completed fixes and verification limits.

The sample underlay is authored in `client/assets/sample-plan.svg`; its stations are illustrative data.
