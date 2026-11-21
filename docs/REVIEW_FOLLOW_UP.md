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

- 29 model/server regression tests pass under Node.js 22.23.4.
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
