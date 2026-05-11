---
title: "title-scene-shadows-caustics"
legend: "ui"
cycle: "0010-title-scene-shadows-caustics"
source_backlog: "conversation: jedit-title-scene-caustics-and-shadows"
---

# title-scene-shadows-caustics

Source backlog item: `conversation: jedit-title-scene-caustics-and-shadows`
Legend: UI

## Sponsored Users

- A developer seeing the jedit title scene as the editor's first visual tone.
- A future agent adding title-scene lighting without returning to broad
  post-render color hacks.

## Hills

1. A user can see floor shadows and subtle caustic-style highlights as part of
   the raytraced scene, not as a color remap after rendering.
2. A maintainer can test floor light effects as numeric material facts before
   they become terminal cells.
3. An agent can tune future scene effects through named helpers and constants
   instead of hidden shader branches.

## Playback Questions

1. Does a floor point under a sphere report reduced key-light visibility?
2. Does a floor point near a reflective sphere report nonzero caustic strength?
3. Does a far floor point stay unshadowed and free of caustics?
4. Does the rendered title scene still pass the existing material color,
   reflection, and deterministic rendering specs?

## Requirements

- Add a pure floor-light-effect helper that returns shadow and caustic facts.
- Shadowing must come from scene geometry and the key light direction.
- Caustics must be bounded and based on reflective sphere proximity.
- Apply the effects inside the shader material color path.
- Do not add post-render `setRGB()` loops or hard theme-color remapping.

## Acceptance Criteria

- RED test proves the floor-light-effect helper is missing.
- GREEN test proves shadow, caustic, and far-field behavior.
- `node --test spec/title-screen.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The effects are decorative and must not carry editor state. They should remain
subtle enough not to reduce title logo legibility.

## Localization / Directionality Posture

No localized text or directional layout is affected.

## Agent Inspectability / Explainability Posture

The effect helper should make the shader explainable: a floor sample first
gets theme-derived material color, then a shadow multiplier and caustic
strength, then lighting composition.

## Implementation Outline

1. Add a failing title-screen spec for floor light effects.
2. Export a small floor-light-effect helper from `src/ui/title-screen.ts`.
3. Apply shadow and caustic effects to floor material shading and reflected
   floor color.
4. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `title floor light effects expose sphere shadows and caustics`

## Drift Check

- RED observed:
  `node --test spec/title-screen.spec.mjs` failed because
  `titleFloorLightEffectsAt` did not exist.
- GREEN observed:
  `node --test spec/title-screen.spec.mjs` passed with 7 tests.
- Full suite observed:
  `npm run test` passed with 113 tests.
- Build observed:
  `npm run build` passed.
- Quality observed:
  `npm run quality` passed with no regressions.
- Whitespace drift:
  `git diff --check` passed.

## Playback

1. `title floor light effects expose sphere shadows and caustics` proves a
   floor point under a sphere has reduced key-light visibility.
2. The same spec proves a nearby reflective sphere contributes nonzero caustic
   strength.
3. The far-field assertion proves distant floor points stay unshadowed and
   free of caustics.
4. Existing title-screen specs still pass for material colors, reflections,
   floor contrast, and deterministic rendering.

## Retrospective

The useful boundary was a small numeric effect helper rather than another
rendering mode. The shader now composes material color, shadow multiplier, and
caustic strength before the Braille cell is produced, which keeps the effect in
the raytraced scene instead of pushing it into terminal post-processing.
