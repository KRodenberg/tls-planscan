---
name: "PlanScan"
description: "A precise workspace for scan planning and QA."
colors:
  ink: "#263341"
  muted: "#647382"
  line: "#e0e5eb"
  blue: "#285cda"
  blue-soft: "#edf3ff"
  surface: "#f5f7fa"
  low: "#087f6b"
  medium: "#285cda"
  high: "#8250b8"
  danger: "#b93838"
  white: "#fff"
  canvas: "#eef1f5"
  canvas-dot: "#d7dee7"
  blue-hover: "#1748bd"
  input-border: "#ccd4de"
  button-border: "#d3dae3"
  selected-ink: "#204eaf"
  estimate-ink: "#1c304d"
  target: "#a34d16"
typography:
  estimate:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-1px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 650
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 650
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.25
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  badge: "4px"
  compact: "5px"
  base: "6px"
  dialog: "12px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "16": "16px"
  "18": "18px"
  "20": "20px"
  "22": "22px"
  "24": "24px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "35px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "35px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "35px"
  input-time:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "4px"
    height: "30px"
    width: "62px"
  tool-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.base}"
    padding: "0 10px"
    height: "34px"
  density-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "6px 5px"
  panel-section:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    padding: "18px 20px"
  estimate-summary:
    textColor: "{colors.estimate-ink}"
    typography: "{typography.estimate}"
    padding: "19px 0"
  station-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "9px 6px"
  scan-marker-medium:
    backgroundColor: "{colors.medium}"
    textColor: "{colors.white}"
---

# Design System: PlanScan

## Overview

**Creative North Star: "Professional drawing workspace"**

PlanScan uses clean white working panels around a cool slate drawing canvas. The plan is the main work surface; compact controls keep placement, density and time easy to scan.

Short labels, restrained blue selection and consistent outlined SVG icons support a professional interface with minimal wording. Color identifies density, while names and stable station numbers carry meaning.

**Key Characteristics:**

- Plan-led workspace with a persistent current tool and estimate.
- Compact system type with tabular quantities and durations.
- Labelled density roles and immediate, reversible editing.

## Colors

Blue carries selection and the primary action; green and violet distinguish density. Cool neutrals keep the architectural plan readable. Frontmatter values are normative.

### Primary

- **Blue:** primary export/upload actions, focus, caret and Medium density.
- **Soft Blue:** selected tools, profile choices and station rows.
- **Deep Blue:** primary-button hover; selected control text uses Selected Ink.

### Secondary

- **Green:** Low density and calibrated status.

### Tertiary

- **Violet:** High density.
- **Target Ochre:** target symbols, distinct from scan triangles.
- **Danger Red:** destructive actions and invalid duration feedback.

### Neutral

- **Ink / Muted:** primary labels and secondary data.
- **White / Surface / Canvas:** working panels, app ground and drawing stage.
- **Line / Input Border / Button Border:** quiet separators and control edges.
- **Canvas Dot:** the drawing stage's fine spatial texture.
- **Estimate Ink:** the large duration result.

**The Labelled Density Rule.** Show Low, Medium and High by name beside their swatches in profile controls and station lists.

## Typography

Use the system UI stack in the frontmatter. There is no expressive display face or separate monospace family. Durations, quantities, coordinates and status use tabular numerals.

- **Estimate:** the main duration output; the largest type in the workbench.
- **Headline:** dialog titles.
- **Title / Section:** the scan-plan title and section headings.
- **Body:** explanatory dialog copy; ordinary controls use the smaller Control and Label roles.
- **Control:** buttons; tool labels use a slightly smaller local size.
- **Label:** table headings, secondary data and supporting status.

The brand uses a compact wordmark with a lighter “Scan” suffix. On phones, form fields increase in size; modal fields use the base browser-friendly text size.

**The Operating Type Rule.** Keep controls compact and direct; reserve the largest type for the estimated duration.

## Layout

The viewport is a fixed-height workbench. A header (68px) sits above a settings rail (312px) and a flexible drawing workspace. The drawing workspace stacks a tool strip (59px), an expanding canvas and a status bar (30px). Settings scroll independently; the station list has its own maximum height (204px).

Sections use the extracted spacing scale, with panel padding (18px 20px), grouped controls and thin separators. The canvas fits the underlay proportionally and keeps tool status and zoom controls along its lower edge.

At widths up to 1100px, the rail narrows (288px) and tool labels hide. From 1500px, the rail expands (328px) with wider panel gutters. At widths up to 760px, the header becomes shorter (61px), tools stay in a compact strip (53px), and settings move to a fixed drawer up to 340px wide. The bottom status bar (38px) retains the estimate. Up to 380px, icon controls tighten and the wordmark text hides.

## Elevation & Depth

Use borders and tonal surfaces for working panels; reserve shadows for paper, floating feedback and overlays. A faint paper drop shadow separates the plan from the dotted canvas. Notices and toasts have low shadows; the dialog and phone drawer use broader shadows and a dim backdrop. Exact shadow values and loading motion are in the sidecar.

**The Flat Panel Rule.** Use borders and tonal surfaces for working panels; reserve shadows for paper, floating feedback and overlays.

## Shapes

Controls have gently rounded corners using Base; selected list rows and compact status surfaces use Compact. Tags use Badge, while dialogs use the larger Dialog radius. The main panel divisions remain square. Thin borders define control edges. Scan stations are triangles; targets are concentric circles; numbered labels stay attached to their geometry.

## Components

- **Buttons:** primary blue for Export QA plan and the empty-state upload action; bordered white for secondary actions; quiet controls for local actions. Hover changes tone, keyboard focus uses a blue outline (2px with 3px offset), and disabled controls reduce opacity (.4).
- **Inputs:** white fields with Input Border and Base corners. Duration fields are centered and compact; invalid values use Danger with a pale red fill and an adjacent message. The last valid estimate remains visible and export is disabled until correction.
- **Tool navigation:** inline outlined SVG icons, short labels and a Soft Blue active state. On narrow screens labels hide while accessible names remain. The current tool is repeated in the canvas status.
- **Density choices:** named Green, Blue and Violet dots with a subtle bordered selected state. Each profile has an editable time per station, quantity and subtotal.
- **Panels:** flat white sections divided by Line; use these for settings rather than raised dashboard cards.
- **Estimate:** a prominent duration with station count and a short breakdown of scan time and move/setup allowance. Valid edits update counts, subtotals and the total immediately.
- **Stations:** a selectable list of stable IDs, labelled density and calibrated coordinates. Selection exposes density, X/Y and note fields and highlights the corresponding canvas marker.
- **Canvas:** proportional underlay, numbered triangles, circle targets, dashed links and selection rings. The illustrative starter is visibly marked Sample.
- **Dialogs:** native modal behavior, short title, direct fields and right-aligned actions. QA export includes a geometry-preserving preview, paper/orientation controls and the current estimate.
- **Feedback:** direct notices and toasts; loading uses a spinner that respects reduced motion. Empty canvas actions offer Upload plan, Google Maps and the sample.

## Do's and Don'ts

### Do:

- **Do** keep the plan, current tool and estimate available together.
- **Do** pair density colors with names in controls and station lists.
- **Do** align durations, quantities and coordinates with tabular numerals.
- **Do** preserve visible focus, invalid fields, empty states and concise feedback.

### Don't:

- **Don't** add flavour text around working controls.
- **Don't** rely on color alone to identify a density profile.
- **Don't** present editable profile times as instrument guarantees.
- **Don't** distort the underlay or station geometry in previews and QA exports.


## Continuation: 21 November 2026

Selected station metadata uses Selected Ink on Soft Blue to meet text contrast. Phone editing fields use 16px text. Station creation exposes Add scan and Add target together; selection includes a labelled link editor. Set scale supports numeric point coordinates as well as pointer picking. The mobile settings drawer contains focus and restores it on close.
