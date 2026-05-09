---
title: "randomized-title-scene"
legend: "ui"
cycle: "0015-randomized-title-scene"
source_backlog: "conversation: jedit-random-camera-and-non-overlapping-geometry"
---

# randomized-title-scene

Source backlog item: `conversation: jedit-random-camera-and-non-overlapping-geometry`
Legend: UI

## Sponsored Users

- A developer returning to the title screen who wants the raytraced scene to
  feel alive without flickering between frames.
- A user moving the camera around the title scene and noticing more than the
  same three fixed spheres every time.
- A future maintainer validating that procedural scene generation never spawns
  overlapping objects.

## Hills

1. A user starts jedit and sees the title camera begin from a seeded random
   orbit angle and radius instead of a fixed frontal placement.
2. A user sees a deterministic mixed scene with varied material colors, sizes,
   spheres, and column-like objects.
3. A maintainer can test the scene generator directly and prove generated
   object footprints do not overlap.

## Playback Questions

1. Does a fixed scene seed produce the same camera placement and object layout?
2. Do different scene seeds produce different camera placements?
3. Does the scene include multiple shape kinds, sizes, reflectivity values, and
   material colors?
4. Are all generated object footprints separated by at least the required
   margin?
5. Does the title shader render the generated objects without changing the
   post-processing/color philosophy?

## Requirements

- Generate title-scene camera placement from a scene seed.
- Generate title-scene objects from a scene seed and current theme material
  colors.
- Include at least one sphere and at least one column-like shape.
- Use deterministic seeded pseudo-randomness after startup.
- Reject or avoid overlapping object footprints.
- Preserve interactive arrow-key camera controls after the seeded placement.
- Keep raytraced material colors and lighting natural.

## Acceptance Criteria

- RED tests fail because no title scene generator exists and the title camera
  always starts from fixed values.
- GREEN tests prove deterministic generation, seed variation, mixed shape
  kinds/materials/sizes, and non-overlap.
- `node --test spec/title-scene.spec.mjs spec/title-screen.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The title scene remains decorative and appears only before editing. Camera
randomization must not alter editor controls or file-opening behavior.

## Localization / Directionality Posture

No text or localized layout changes.

## Agent Inspectability / Explainability Posture

Scene generation should be isolated in a testable module with named shape tags,
seeded random helpers, and explicit footprint checks.

## Implementation Outline

1. Add failing specs for seeded camera/object generation and non-overlap.
2. Implement a deterministic title-scene generation module.
3. Extend the title shader to render generated sphere and column objects.
4. Seed the initial app title camera and pass the scene seed into rendering.
5. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `title scene generation is deterministic and seed-sensitive`
- `title scene generation creates varied non-overlapping objects`
- `initial title camera state can use a seeded scene placement`

## Drift Check

RED drift matched the design: there was no scene-generation seam, no seeded
camera placement, and the title shader still built a fixed three-sphere scene
inline.

Implementation drift is intentional and bounded:

- Startup uses `Math.random()` once to choose a scene seed; generated scene data
  is deterministic after that seed so frames do not flicker.
- The shader now consumes generated scene objects but still applies the same
  material lighting, reflection, shadows, caustics, and Braille resampling.
- Column objects are rendered as finite vertical cylinder sides; caps are left
  out of scope for this cycle.

## Playback

Playback answers:

1. A fixed scene seed produces stable camera placement and identical generated
   objects.
2. Different seeds produce different camera placements and object layouts.
3. The generator creates at least six objects with sphere and column shape tags,
   varied material colors, radii, and reflectivity values.
4. Tests check every object footprint pair against
   `TITLE_SCENE_OBJECT_MARGIN`.
5. `renderTitleScreen` now receives the scene seed and renders generated
   objects without post-render color mutation.

Validation:

- `node --test spec/title-scene.spec.mjs spec/title-screen.spec.mjs
  spec/title-camera-session.spec.mjs` passed.
- `npm run build` passed.
- `npm run quality` passed with no regressions.
- `npm run test` passed 125 tests.
- `git diff --check` passed.

## Retrospective

Keeping generation in `src/ui/title-scene.ts` kept `title-screen.ts` under the
500-line rule while making non-overlap directly testable. The floor-shadow
regression caught during playback was useful: shadow rays can begin inside a
shape, so sphere intersection now uses the positive exit root when needed.
