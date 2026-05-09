---
title: "title-logo-cell-overlay"
legend: "ui"
cycle: "0011-title-logo-cell-overlay"
source_backlog: "conversation: jedit-title-logo-smaller-non-braille"
---

# title-logo-cell-overlay

Source backlog item: `conversation: jedit-title-logo-smaller-non-braille`
Legend: UI

## Sponsored Users

- A developer evaluating the title screen's visual balance on first launch.
- A future agent adjusting logo placement without coupling logo rendering to
  the raytraced scene shader.

## Hills

1. A user sees the jedit logo at roughly 40% of its previous width, centered
   horizontally and visually anchored around the lower two-thirds of the title
   screen.
2. A user sees the logo rendered with solid and fading hatch glyphs, not
   Braille cells.
3. A maintainer can explain that the logo is an intentional cell-resolution
   overlay above the raytraced background, not a post-render color repair pass.

## Playback Questions

1. Does the title logo bounds helper center the logo horizontally?
2. Does the title logo bounds helper place the logo center near two-thirds of
   the available height?
3. Are bold logo cells non-Braille glyphs?
4. Does the logo retain themed gradient material color?

## Requirements

- Render the raytraced scene independently from the logo.
- Paint the logo as a cell-resolution overlay using solid/hatch glyphs.
- Use coverage sampling from the existing logo mask to choose glyph density.
- Keep the logo themed through the existing title logo/source colors.
- Do not add color post-processing loops.

## Acceptance Criteria

- RED tests prove the current logo is still Braille and the cell-bounds helper
  is missing.
- GREEN tests prove non-Braille logo glyphs and lower-two-thirds placement.
- `node --test spec/title-screen.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The title logo remains decorative. The first interactive editor screen still
needs usable controls without relying on the logo's shape.

## Localization / Directionality Posture

No localized text or directional layout is affected.

## Agent Inspectability / Explainability Posture

The bounds helper and glyph chooser should make the logo experiment easy to
audit: placement is a named ratio, and glyph choice follows mask coverage.

## Implementation Outline

1. Add failing specs for logo bounds and non-Braille logo glyphs.
2. Render the scene without the logo inside the Braille shader.
3. Paint the logo overlay at cell resolution from sampled mask coverage.
4. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `title logo bounds center the smaller logo in the lower two thirds`
- `title screen renders the logo as a non-Braille themed glyph layer`

## Drift Check

RED drift matched the design: the pre-change title surface still marked logo
cells as bold Braille glyphs, and no cell-bounds helper existed for direct
placement assertions.

Implementation drift is intentional and bounded:

- The logo is now painted after the raytraced Braille scene, but this is a
  decorative content layer rather than a color correction pass.
- The overlay uses `surface.set` for the logo cells only, so it does not
  mutate raytraced colors after rendering.
- The logo scale is expressed as 40% of the previous 80% width ratio, yielding
  a 32% screen-width target.

## Playback

Playback answers:

1. The exported bounds helper centers the logo horizontally within one cell.
2. The bounds helper places the logo center near two-thirds of the available
   height, clamping only when the screen is too short.
3. Bold logo cells render with solid and hatch glyphs instead of Braille.
4. Logo foreground color still uses the existing accent-to-info title gradient,
   while the raytraced background keeps natural lighting and material colors.

Validation:

- `node --test spec/title-screen.spec.mjs` passed.
- `npm run build` passed.
- `npm run quality` passed with no regressions.
- `npm run test` passed 114 tests.
- `git diff --check` passed.

## Retrospective

This split made the logo easier to reason about. The raytraced scene owns
material lighting, reflection, shadow, and Braille resampling; the logo owns
cell placement and mask coverage. That separation should also make it easier to
remove or revise the experiment later without disturbing the shader path.
