# Review follow-up

21 November 2026

The original review assessed the predecessor at https://www.tls.tools/PlanScan/. This repository continues the redesigned browser workspace described in PRODUCT.md and DESIGN.md.

| Review priority | Current behavior |
| --- | --- |
| Reliable estimates | Immediate valid duration recalculation, explicit min:sec format, inline validation, last valid totals, separate per-scan allowance. |
| Project integrity | Versioned project data, stable station and link IDs, monotonic labels, retained timestamps and output settings, draft recovery, undo/redo. Invalid identities and broken link endpoints produce an import error. |
| Maps and scaling | Image/PDF upload, page preview and selection, SIX Maps aerial dialog, known-distance calibration, metric coordinates, independent zoom and rotation. Aerials use the returned MGA2020 extent; image overlays preserve position, size, rotation and opacity. |
| Accessible workspace | Responsive canvas and settings drawer, native buttons, labelled inputs, visible focus, accessible station/target creation and editing, link controls and numeric calibration. Phone drawer contains keyboard focus and returns it when closed. |
| QA handoff | PDF/PNG preview, explicit paper/orientation, proportional geometry, project/revision/source, profile assumptions, counts, allowance, total and calibrated scale bar. |

This continuation also fixes pointer cancellation, lost capture and window blur, prevents a second pointer taking over an active drag, retains native Space activation on buttons, and cleans up PDF resources and out-of-order previews.

## Verification

- 49 model/server regression tests pass under Node.js 22.23.4.
- Worker build passes. A fresh source checkout builds without a Sites hosting manifest.
- Chromium browser checks pass for immediate estimates, invalid duration handling, targets/links, metres calibration, project save/open, draft recovery, clear/undo, image rotation, explicit PDF page selection and PDF/PNG downloads.
- QA output was rendered and visually inspected. Portrait/landscape geometry uses the selected paper aspect ratio.
- Interrupted input checks use real mouse input plus synthetic secondary-pointer, cancellation, lost-capture and window-blur events. The next interaction remains usable.
- Simulated aerials verify projected coordinate placement, target timing, image overlays, undo and draft recovery. Invalid extents and provider failures produce recoverable errors.
- axe reports zero WCAG 2 A/AA and WCAG 2.1 AA violations in the checked desktop state and open settings drawers at 390px and 320px widths. Screenshots were visually inspected at desktop and phone sizes.
- Browser checks and model/server tests are included in GitHub Actions.

## Limits

Physical multi-touch hardware, native screen readers and other browser engines were not tested. SIX Maps uses the public NSW imagery and address services without a user API key. Automated accessibility and emulated phone checks do not replace native screen-reader or physical-device testing.

## SIX Maps continuation

The provider is now the public SIX Maps NSW aerial service. Aerial requests use MGA2020 output spatial references and the returned extent for station coordinates. Uploaded images/PDF pages can use a blank canvas or a translated, rotated, proportionally sized and faded aerial overlay. Project version 3 retains both layers and MGA2020 coordinates. All distances use metres. The lower-right canvas shows a scale bar or Not to scale with the existing calibration action. Target scan time is counted once per target and appears in both live estimates and QA exports.

Live provider verification loaded SIX Maps imagery over Sydney through the local app and recorded a station in MGA2020 zone 56 (EPSG:7856). Image calibration keeps the first control point fixed while preserving the aerial coordinate reference.

## Specified WMTS source

The SIX Maps picker now uses the supplied NSW_Base_Map WMTS capabilities URL, layer public_NSW_Base_Map, default style and default028mm tile matrix set. OpenLayers reads the capabilities and reprojects the EPSG:3857 tiles into an MGA2020 canvas. This replaces the previous NSW_Imagery map export path for new map loads. Uploaded overlays, project persistence, metre scale and target timing continue to work. Saved legacy map images remain intact; load SIX Maps basemap to use the new source.

Live verification loaded 88 advertised WMTS tiles without errors at the Sydney test location and recorded a station in MGA2020 zone 56. Regression coverage includes the exact capabilities URL and tile path, invalid tile indices, tile failures, projection/scale and persisted WMTS source metadata.

## Portal imagery and live navigation

The active source is the user's NSW Imagery Basemap portal item c04ce33be7a04a7884f786f5beb20b19 and its NSWWebImagery tiled service. It supersedes the NSW_Base_Map WMTS selection above. A persistent visible OpenLayers layer loads imagery during pan/zoom. Stations and overlays retain fixed MGA2020 positions. Placement extends beyond the initial area. Version 4 restores the last view and source settings without storing a static basemap.

Regression checks inspect requests for new zoom levels and new tile areas, compare MGA2020 positions before/after navigation, place stations outside the initial area, verify overlay/view persistence and full-plan export, and test failed-tile retry. Live service verification loaded 88 tiles initially and 136 after zoom across levels 19 and 20, with no page errors.

## Imagery feedback and automatic scan links

The unavailable warning now checks rendered basemap coverage. Browser regressions force failed zoom tiles while cached imagery remains visible, then reload into a complete outage and verify Retry. Attribution uses 10px type directly below the active profile control on desktop and 390px/320px phone layouts.

New scans connect to the preceding scan, skipping targets; imported projects retain their existing graphs. Editor and QA link labels derive straight-line metre distances from the current scale and endpoints, with Not to scale for uncalibrated plans. Model and browser checks cover movement/calibration, MGA2020 view independence, export reprojection, target skipping, deletion, save/restore and atomic undo/redo.

## Docker runtime

A multi-stage Node 22 image contains only the built Worker module and a small Node HTTP adapter. The runtime uses the node user and supports read-only operation, health checks and graceful shutdown. The Compose example can be copied into a larger stack. Trusted proxy configuration preserves the public HTTPS origin for map requests.

HTTP integration tests cover GET/HEAD assets, health, POST bodies, origin checks, trusted proxy headers, oversized fixed/chunked bodies and recoverable adapter errors. The browser runner accepts an existing server URL so GitHub Actions builds the image, waits for container health and runs the complete suite against the production container.

## Servarr deployment

The Servarr service example joins the existing cloudflared network, uses trusted proxy headers and includes the requested Nicholas Fedor Watchtower fork. Successful main-branch verification advances deploy; Git monitoring rebuilds only the promoted revision. The deployment guide documents the internal HTTP tunnel origin and the five-minute polling interval. Server credentials and tunnel tokens are excluded from public source.
