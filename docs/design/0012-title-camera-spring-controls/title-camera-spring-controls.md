---
title: "title-camera-spring-controls"
legend: "ui"
cycle: "0012-title-camera-spring-controls"
source_backlog: "conversation: jedit-title-camera-bijou-springs"
---

# title-camera-spring-controls

Source backlog item: `conversation: jedit-title-camera-bijou-springs`
Legend: UI

## Sponsored Users

- A developer on the title screen using arrow keys to inspect the raytraced
  scene.
- A future maintainer tuning title-screen motion without editing the full app
  reducer.
- A future agent verifying that jedit consumes Bijou v5 motion primitives for
  real UI behavior, not only theme metadata.

## Hills

1. A user presses left or right on the title screen and the camera eases toward
   the new orbit angle instead of stepping instantly.
2. A user presses up or down on the title screen and the camera radius eases
   toward the new zoom distance, keeping the existing minimum radius.
3. A maintainer can inspect a small title-camera session module and see that
   Bijou spring animation commands, critically damped physics, and stale-frame
   guards drive the camera.

## Playback Questions

1. Does an arrow-key camera update change the target immediately while leaving
   the visible angle/radius to be animated by spring frames?
2. Does the spring config use critical damping for its stiffness and mass?
3. Does a stale spring frame from an older key press fail to overwrite the
   newest camera motion?
4. Does the main reducer render the title screen from the animated camera
   value rather than the target value?

## Requirements

- Use Bijou's exported animation/spring facilities for title camera motion.
- Preserve existing left/right angle and up/down radius deltas.
- Preserve the minimum camera radius.
- Keep repeated arrow presses target-relative so input remains responsive while
  an earlier animation is still in flight.
- Ignore stale animation frames by motion id.
- Keep title camera behavior outside the large main reducer where practical.

## Acceptance Criteria

- RED tests fail because no title-camera spring session exists and the main
  reducer still steps camera values immediately.
- GREEN tests prove target-relative arrow updates, critical damping, stale-frame
  guards, and non-terminal spring frame values.
- `node --test spec/title-camera-session.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The arrow keys remain the same. Motion is decorative and should not hide editor
functionality because it only runs before a file is open.

## Localization / Directionality Posture

No text or localized layout is affected.

## Agent Inspectability / Explainability Posture

Camera motion should have named constants for deltas, spring physics, axis
tags, and message tags. Tests should cover the reducer seam directly so a
future agent can tune the motion without launching the app.

## Implementation Outline

1. Add a failing title-camera session spec.
2. Implement a small app-level camera session using Bijou `animate` with a
   critically damped spring config.
3. Wire `src/main.ts` to store animated camera state, delegate title-screen
   arrow keys, and apply spring frame messages.
4. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `title camera arrow keys move targets through spring commands`
- `title camera spring config is critically damped`
- `title camera ignores stale spring frames`
- `title camera spring command emits interpolated frames before target`

## Drift Check

RED drift matched the design: the session module did not exist, so the focused
spec failed before any app wiring could claim spring-driven camera behavior.

Implementation drift is limited to the app shell boundary:

- The main reducer keeps the same title-screen-only arrow-key affordance but
  delegates the target math and spring command creation to
  `src/app/title-camera-session.ts`.
- `src/main.ts` stores a single `titleCamera` object instead of separate
  `camAngle` and `camRadius` fields.
- Existing `renderTitleScreen` still receives plain numeric angle and radius
  values, so the raytracer stays independent of Bijou command scheduling.

## Playback

Playback answers:

1. Arrow-key updates change `angleTarget`/`radiusTarget` immediately while the
   visible `angle`/`radius` wait for spring frame messages.
2. `TITLE_CAMERA_SPRING` sets damping to
   `2 * sqrt(stiffness * mass)`, so the configured motion is critically
   damped.
3. `reduceTitleCameraMotion` ignores stale frame messages whose motion id no
   longer matches the active axis.
4. `renderViewer` passes `model.titleCamera.angle` and
   `model.titleCamera.radius` into `renderTitleScreen`, leaving targets as
   reducer state rather than render inputs.

Validation:

- `node --test spec/title-camera-session.spec.mjs` passed.
- `npm run build` passed.
- `npm run quality` passed with no regressions.
- `npm run test` passed 118 tests.
- `git diff --check` passed.

## Retrospective

The app already used Bijou `animate` for the clock, so the right fix was not a
custom easing loop. Pulling the title camera into a small session module made
the behavior testable without importing the top-level app, and motion ids avoid
the common overlapping-animation bug when users press arrows repeatedly.
