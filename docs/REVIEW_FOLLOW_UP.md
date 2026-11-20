# Review follow-up

21 November 2026

The original review assessed the predecessor at https://www.tls.tools/PlanScan/. This repository continues the redesigned browser workspace described in PRODUCT.md and DESIGN.md.

| Review priority | Current behavior |
| --- | --- |
| Reliable estimates | Immediate valid duration recalculation, explicit min:sec format, inline validation, last valid totals, separate per-scan allowance. |
| Project integrity | Versioned project data, stable station and link IDs, monotonic labels, retained timestamps and output settings, draft recovery, undo/redo. Invalid identities and broken link endpoints produce an import error. |
| Maps and scaling | Image/PDF upload, page preview and selection, Google Maps dialog, known-distance calibration, metres/feet coordinates, independent zoom and rotation. Reloading maps preserves manual scale and checks dimensions. |
| Accessible workspace | Responsive canvas and settings drawer, native buttons, labelled inputs, visible focus, accessible station/target creation and editing, link controls and numeric calibration. Phone drawer contains keyboard focus and returns it when closed. |
| QA handoff | PDF/PNG preview, explicit paper/orientation, proportional geometry, project/revision/source, profile assumptions, counts, allowance, total and calibrated scale bar. |

This continuation also fixes pointer cancellation, lost capture and window blur, prevents a second pointer taking over an active drag, retains native Space activation on buttons, and cleans up PDF resources and out-of-order previews.

## Verification

- 21 model/server regression tests pass under Node.js 22.23.4.
- Worker build passes. A fresh source checkout builds without a Sites hosting manifest.
- Chromium browser checks pass for immediate estimates, invalid duration handling, targets/links, metres/feet calibration, project save/open, draft recovery, clear/undo, image rotation, explicit PDF page selection and PDF/PNG downloads.
- QA output was rendered and visually inspected. Portrait/landscape geometry uses the selected paper aspect ratio.
- Interrupted input checks use real mouse input plus synthetic secondary-pointer, cancellation, lost-capture and window-blur events. The next interaction remains usable.
- Simulated map reloads preserve scale, units and stations; changed image dimensions produce a recoverable error. Provider failures do not expose credentials.
- axe reports zero WCAG 2 A/AA and WCAG 2.1 AA violations in the checked desktop state and open settings drawers at 390px and 320px widths. Screenshots were visually inspected at desktop and phone sizes.
- Browser checks and model/server tests are included in GitHub Actions.

## Limits

Physical multi-touch hardware, native screen readers and other browser engines were not tested. Google Maps requires a user-supplied API credential. Automated accessibility and emulated phone checks do not replace native screen-reader or physical-device testing.
