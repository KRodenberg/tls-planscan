# PlanScan

A terrestrial laser scanning station planner for TLS Tools. Place stations and targets on an image, PDF page or SIX Maps aerial underlay, assign density profiles, estimate scan time, and export an annotated QA plan.

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

The browser suite starts an isolated local server, exercises import/edit/save/export workflows, checks interrupted gestures and aerial overlays, scans desktop and phone settings for accessibility, and prints its temporary artifact directory.

The build emits a self-contained Worker ES module at `dist/server/index.js`. It default-exports a `fetch(request, env)` handler and serves both assets and the map endpoint. Use a Worker-compatible host at the domain root with HTTPS. GitHub stores the source; GitHub Pages alone does not run the map endpoint. An existing checkout-local `.openai/hosting.json`, when present, is copied into the build; a fresh clone builds without it.

## Planning

- Upload PNG, JPG, WEBP or PDF, up to 25 MiB. PDF import includes a page picker and preview. Images preserve their orientation and aspect ratio.
- Select **Low**, **Medium** or **High**, then click the plan. Time per scan accepts minutes (`5`) or minutes and seconds (`02:30`). Valid edits update totals immediately. Invalid fields retain the last valid estimate and block save/export until corrected.
- **Set scale** accepts two image coordinates and their known separation in metres. **Pick points on plan** provides the pointer workflow. View zoom remains separate from physical calibration. Coordinates use metres when calibrated.
- Use **Select**, the station list, or **Add scan / Add target** to edit positions. Selection exposes density, coordinates, a note and **Edit links**. Clicking two stations with the Link tool adds or removes their link.
- Rotation moves the underlay and all stations together. Clear, replacement, rotation and station edits support undo/redo. Station numbers remain monotonic after deletion.

Keyboard shortcuts: **V** select, **S** scan, **T** target, **L** link, **C** pick scale points, **H** or hold **Space** to pan, **F** fit, arrow keys to move the selected station, **Delete** remove, **Ctrl/Cmd Z** undo, **Ctrl/Cmd Shift Z** redo, **Ctrl/Cmd S** save, and **Ctrl/Cmd O** open. Native buttons also support Enter and Space.

## Projects and QA exports

**Save project** downloads a portable `.planscan.json` with uploaded imagery, stations, targets, links, identities, profile durations, allowance, calibration, display settings and output choices. **Open** restores it. IndexedDB saves the current draft on this device. Save a separate project file before starting another plan if you need both copies; undo can also recover the previous plan in the current session.

Legacy Fabric TXT templates can be imported. Inspect their scan times and links because the predecessor did not serialize all settings.

**Export QA plan** previews PDF or PNG output with explicit A4/A3 paper and portrait/landscape orientation. The output includes project/site, revision/date, underlay and PDF page, station IDs, density counts and times, setup allowance, target count/time, total, and a calibrated scale bar when available. Export geometry is independent of browser dimensions. Export choices are retained with the project.

## SIX Maps aerials and overlays

Choose **SIX Maps aerial**. Search an NSW address, or enter GDA2020 latitude/longitude, then choose the coverage width in metres. No API key is required. The server uses the [public NSW imagery service](https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer) and requests a map in the appropriate MGA2020 zone. Address results come from the SIX Maps NSW address-point service.

The app uses the **actual returned image extent**, rather than the requested bounding box, to calculate scale and station coordinates, as required by the [ArcGIS export contract](https://developers.arcgis.com/rest/services-reference/enterprise/export-map/). Each aerial station records MGA2020 zone, EPSG, easting and northing. Selection shows editable eastings/northings in metres. Northing decreases as a station moves down the image. Coordinates are limited by the source imagery's accuracy and alignment.

After uploading an image or selecting a PDF page, choose **Blank canvas** or **SIX Maps aerial**. An aerial overlay keeps the existing stations. Use **Adjust image** to set position, width, rotation and opacity, or **Move image on plan** / the Image tool to drag it into place. **Set image scale** uses the same numeric / two-point calibration flow to resize the uploaded image against the aerial; its first calibration point remains fixed and the aerial MGA2020 grid stays unchanged. Geometry and opacity are preserved in project files, drafts and QA exports. Replacing the base underlay clears stations with confirmation and supports undo.

The lower-right scale bar changes with zoom. Unscaled images show **Not to scale** beside **Set scale**. Both that button and the sidebar Set scale control use the same numeric / two-point calibration flow. All distances are in metres. A standalone uploaded image has local coordinates; calibration does not assign it an MGA2020 location.

**Target scan time**, directly below Move / setup, is added once per target. The total is scan-profile time + movement/setup per scan + target scan time × target count. Invalid durations block save/export; changing or deleting targets updates totals immediately. The QA footer includes the target count, duration and subtotal.

Aerial imagery, projected extents, uploaded overlays and station coordinates are saved in version 3 project files for reopening on the same device or elsewhere. Version 2 projects remain importable; older map canvases without imagery become local blank canvases. SIX Maps / NSW Spatial Services attribution appears on the canvas and QA output. Location and address requests are sent to SIX Maps. Uploaded image bytes stay in the browser.

## Source and checks

- `client/`: browser editor, project model, export renderer and SVG sample.
- `server/handler.mjs`: asset and SIX Maps imagery and address request handler.
- `scripts/`: local server and Worker build.
- `tests/`: duration, identity, persistence, geometry and server regressions.
- `.github/workflows/ci.yml`: clean install, tests, build and browser checks on pushes and pull requests.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md): product requirements and interface direction.
- [Review follow-up](docs/REVIEW_FOLLOW_UP.md): scope, completed fixes and verification limits.

The sample underlay is authored in `client/assets/sample-plan.svg`; its stations are illustrative data.
