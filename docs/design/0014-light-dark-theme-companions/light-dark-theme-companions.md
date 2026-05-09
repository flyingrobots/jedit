---
title: "light-dark-theme-companions"
legend: "ui"
cycle: "0014-light-dark-theme-companions"
source_backlog: "conversation: jedit-generated-and-authored-theme-variants"
---

# light-dark-theme-companions

Source backlog item: `conversation: jedit-generated-and-authored-theme-variants`
Legend: UI

## Sponsored Users

- A developer who likes a palette but wants the opposite light/dark mode
  without manually choosing a different theme.
- A theme author who wants to provide a carefully tuned light or dark companion
  when generated inversion is not good enough.
- A future agent validating that generated companions and authored overrides
  use the same runtime theme object shape.

## Hills

1. A user can ask jedit for the opposite light/dark companion of the current
   theme and receive a usable generated theme when no authored companion exists.
2. A user gets the hand-authored Solarized light/dark pair instead of a
   generated approximation when toggling between Solarized modes.
3. A maintainer can inspect the theme metadata and see each theme's mode,
   family, companion name, and whether it was authored or generated.

## Playback Questions

1. Does an unpaired dark theme produce a generated light companion with a
   lighter workspace background?
2. Does toggling a generated companion return to the original theme?
3. Does an authored light/dark companion override the generated fallback?
4. Does the settings drawer expose light/dark mode as a first-class appearance
   control?

## Requirements

- Add explicit theme mode metadata for light and dark themes.
- Add explicit metadata for authored versus generated variants.
- Generate an opposite palette from any current theme when no authored
  companion is registered.
- Allow authored companion themes to override generated companions by name.
- Preserve existing theme cycling and existing built-in theme order.
- Add a settings row that toggles the current theme to its light/dark companion.

## Acceptance Criteria

- RED tests fail because theme mode metadata, companion generation, authored
  overrides, and the settings row do not exist yet.
- GREEN tests prove generated companions, authored Solarized override behavior,
  and settings-row exposure.
- `node --test spec/theme-switch.spec.mjs spec/settings-session.spec.mjs`
  passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

Generated companions should prioritize swapping surface/ink contrast over
preserving exact hue. Full contrast auditing remains future work, but the
feature should keep all canonical style tokens populated.

## Localization / Directionality Posture

The mode labels are short UI labels in the settings drawer. No directional
layout behavior changes.

## Agent Inspectability / Explainability Posture

Mode, family, variant source, and companion name should be plain theme metadata.
The generated path should be deterministic and testable without launching the
terminal UI.

## Implementation Outline

1. Add failing theme-switch specs for generated companions and authored
   overrides.
2. Add failing settings-session expectations for a light/dark row.
3. Extend the theme type/builder with mode and variant metadata.
4. Implement generated opposite palette fallback and authored companion lookup.
5. Wire settings activation to `oppositeJeditTheme`.
6. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `jedit generates opposite light and dark companion themes`
- `authored light and dark variants override generated companions`
- `jedit settings rows expose light dark theme mode`

## Drift Check

RED drift matched the design: theme objects had no explicit mode or variant
source metadata, no companion resolver existed, and the settings drawer exposed
only theme cycling rather than mode toggling.

Implementation drift is bounded:

- Generated companions are not added to the installed theme cycle. They are
  produced on demand by `oppositeJeditTheme`.
- The existing built-in theme order is unchanged.
- Hand-authored override behavior is demonstrated by the Solarized light/dark
  pair through companion names on the theme metadata.

## Playback

Playback answers:

1. `graphite` produces a generated `graphite-light` companion with a lighter
   workspace background.
2. Toggling that generated companion returns to the original `graphite` theme
   through its `companionThemeName`.
3. `solarized-dark` resolves to the authored `solarized-light` theme, and the
   reverse path resolves back to `solarized-dark`.
4. The settings drawer now exposes a `Light/dark` choice row and activation
   calls the host's mode-toggle handler.

Validation:

- `node --test spec/theme-switch.spec.mjs spec/settings-session.spec.mjs`
  passed.
- `node --test spec/settings-drawer.spec.mjs spec/theme-switch.spec.mjs
  spec/settings-session.spec.mjs` passed.
- `npm run build` passed.
- `npm run quality` passed with no regressions.
- `npm run test` passed 122 tests.
- `git diff --check` passed.

## Retrospective

Adding metadata to the theme object was the right substrate for this feature:
renderers still receive the same token maps, while settings and theme selection
can reason about family, mode, variant source, and companion name. Keeping
generated companions out of the installed cycle avoids turning one palette list
into a doubled theme picker.
