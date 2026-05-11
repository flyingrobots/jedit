---
title: "title-floor-material-contrast"
legend: "ui"
cycle: "0009-title-floor-material-contrast"
source_backlog: "conversation: jedit-title-scene-light-theme-checkerboard"
---

# title-floor-material-contrast

Source backlog item: `conversation: jedit-title-scene-light-theme-checkerboard`
Legend: UI

## Sponsored Users

- A developer using the title screen while switching between dark and light
  editor themes.
- A future agent adjusting title-scene materials without accidentally making
  semantic theme tokens stand in for physical scene materials.

## Hills

1. A user can switch between built-in light and dark themes and still read the
   title floor as the same checkerboard, with dark tiles darker than light
   tiles.
2. A maintainer can explain that the checker floor uses theme-derived material
   colors, not hard-coded post-processing and not raw semantic token order.
3. An agent can add future lighting effects without reintroducing the light
   theme inversion.

## Playback Questions

1. For every built-in theme, does the title scene expose a floor-light material
   whose luminance is greater than its floor-dark material?
2. Does the rendered scene still use the theme's source/accent colors for
   spheres and logo materials?
3. Does the floor remain part of the shader/material model instead of a
   post-render color rewrite?

## Requirements

- Add a title-scene material palette seam that names floor dark/light colors.
- Derive floor dark/light ordering by luminance from the theme's title-scene
  near/far tokens.
- Keep theme token lookups symbol-based.
- Do not add `setRGB()` or surface post-processing loops.
- Keep sphere and logo material color lookup behavior unchanged.

## Acceptance Criteria

- RED test proves the title scene material palette is missing or does not
  guarantee floor-light luminance greater than floor-dark luminance.
- GREEN test proves all built-in themes maintain the floor contrast contract.
- `npm run build` passes.
- `npm run test -- spec/title-screen.spec.mjs` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The checkerboard is decorative spatial context. This cycle improves visual
consistency but does not make the floor carry editor information.

## Localization / Directionality Posture

No localized text or directional layout is affected.

## Agent Inspectability / Explainability Posture

The palette seam should let agents answer the user's question directly: yes,
the inversion came from theme semantics, and the fix is to derive explicit
floor material roles before lighting.

## Implementation Outline

1. Add a failing title-screen spec for floor material luminance ordering across
   built-in themes.
2. Export a small title-scene material palette function from
   `src/ui/title-screen.ts`.
3. Use the ordered floor material colors in floor shading and floor
   reflections.
4. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `title scene keeps checker floor material contrast stable across built-in themes`

## Drift Check

- RED observed:
  `npm run test -- spec/title-screen.spec.mjs` failed because
  `titleSceneMaterialColors` did not exist.
- GREEN observed:
  `node --test spec/title-screen.spec.mjs` passed with 6 tests.
- Full suite observed:
  `npm run test` passed with 112 tests.
- Build observed:
  `npm run build` passed.
- Quality observed:
  `npm run quality` passed with no regressions.
- Whitespace drift:
  `git diff --check` passed.

## Playback

1. The title-screen spec now checks every built-in theme and asserts
   `floorLight` has greater luminance than `floorDark`.
2. The palette seam answers the diagnosis directly: the old behavior came from
   using semantic theme token order as physical checker material order.
3. Floor shading now uses explicit dark/light material colors for both
   checker parities, and reflections sample the same material roles.

## Retrospective

The light theme did not need a post-render color correction. The scene needed
material roles that survive theme polarity changes. Sorting the title-scene
near/far colors by luminance keeps the shader theme-native while making the
checkerboard's dark/light meaning stable.
