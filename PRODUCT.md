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

Low, Medium and High are density profiles assigned to individual stations, each with a user-editable time per station. Preserve station identity, project settings and geometry through save/open/export. Include targets, links, undo/redo and physical calibration as recommended by the reviewed findings. Known-distance calibration is an implementation recommendation; visual zoom also remains available. Use NSW Imagery Basemap portal item c04ce33be7a04a7884f786f5beb20b19 and its NSWWebImagery tiled service. Keep a persistent live layer that fetches new tiles and levels of detail as users pan/zoom. Reproject the published source tile grid into the project's MGA2020 zone. Station and overlay coordinates remain fixed while the view changes, with placement supported beyond the initial area.

Uploaded images/PDF pages can use a blank canvas or an adjustable imagery overlay. Preserve position, proportional size, rotation and opacity. Keep metre scale / Not to scale and shared calibration. Target scan time contributes once per target. Save live map settings and view in version 4; migrate earlier SIX projects without changing MGA2020 geometry. QA export renders fresh imagery around all project objects and keeps the editor live.

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

Each newly placed scan connects to the last remaining scan, skipping targets. Preserve existing graphs on project import. Show current straight-line link distances in metres in the editor and QA output; use Not to scale until calibration exists. Moving stations and adjusting calibration updates distances. Add the station and its automatic link as one undoable action.

Show imagery-unavailable feedback only when no basemap imagery is visible and tile loading has failed. Keep smaller attribution below the active scan-profile control.

Distribute a production Docker image and a service example that can be inserted into an existing Compose stack. Build assets once, run as an unprivileged user, expose a configurable HTTP listener with health checking and graceful shutdown, and support trusted HTTPS reverse proxies. Keep project storage in the browser; no server volume is required.

The Servarr deployment shares the existing Cloudflare tunnel network and runs the Nicholas Fedor Watchtower fork. GitHub Actions advances a deployment branch only after container and browser verification. Watchtower builds that public Git revision and updates PlanScan, while other selected containers use normal registry updates. The public hostname uses HTTPS with an internal HTTP origin. Keep all server passwords, stack environment values and tunnel credentials out of the repository.
