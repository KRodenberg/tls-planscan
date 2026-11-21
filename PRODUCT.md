# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Implementation choice for this authorized build: HTML, CSS and browser JavaScript; a small Worker-compatible server for SIX Maps basemap requests; Node build and tests. User has not specified a framework.

## Users

Terrestrial laser scanning planners placing stations on an underlay and estimating scanning time. The exported annotated plan is used for QA.

## Product Purpose

Upload an image or PDF, or use SIX Maps basemap as an underlay; scale the plan, place scan stations, assign density profiles and calculate approximate time from station counts. Save a project for later editing and download a legible QA plan.

## Capabilities and Constraints

Low, Medium and High are density profiles assigned to individual stations, each with a user-editable time per station. Preserve station identity, project settings and geometry through save/open/export. Include targets, links, undo/redo and physical calibration as recommended by the reviewed findings. Known-distance calibration is an implementation recommendation; visual zoom also remains available. SIX Maps uses the user-specified NSW Base Map WMTS capabilities document, public_NSW_Base_Map layer and default028mm EPSG:3857 tile grid, without an API key. Read the advertised capabilities and reproject tiles into a north-up MGA2020 canvas; retain the projected canvas extent. Clicking or moving stations on a basemap records zone, EPSG, easting and northing. Standalone uploaded imagery has local coordinates; a distance calibration alone does not establish a global position.

Images and PDF pages can use a blank canvas or form an adjustable overlay over a basemap. Overlay translation, proportional size, rotation and opacity persist with the project and are included in QA exports. Use metres throughout. A bottom-right scale bar follows physical scale and view zoom; unscaled images show “Not to scale” and a Set scale button using the existing calibration flow. Target scan time is an editable duration multiplied by target count and added to the total.

## Brand Commitments

PlanScan / TLS Tools. User requires clean, professional UI and minimal wording or flavour text.

## Evidence on Hand

The live predecessor was reviewed at https://www.tls.tools/PlanScan/. The parent workspace holds PLANSCAN_REVIEW.md, screenshots and reproducible functional evidence. The starter floor plan and station arrangement are illustrative and must be labelled Sample.

## Product Principles

- The plan, current tool and estimate stay visible together.
- Estimates follow current valid profile settings immediately.
- Edits are reversible; station IDs remain stable.
- QA exports preserve geometry and identify their assumptions.
- Short labels and direct controls carry the workflow.
