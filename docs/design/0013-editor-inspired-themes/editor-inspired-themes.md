---
title: "editor-inspired-themes"
legend: "ui"
cycle: "0013-editor-inspired-themes"
source_backlog: "conversation: jedit-more-custom-themes"
---

# editor-inspired-themes

Source backlog item: `conversation: jedit-more-custom-themes`
Legend: UI

## Sponsored Users

- A developer who wants jedit to feel familiar when cycling themes.
- A user evaluating whether title-screen materials, source tokens, markdown,
  drawers, and cursor styles remain coherent across very different palettes.
- A future theme author looking for more examples than one dark and one light
  theme.

## Hills

1. A user can cycle through several built-in themes inspired by familiar editor
   palettes, not only the existing graphite and morning themes.
2. A user sees each added theme use the full jedit theme token system so source,
   markdown, chrome, title-scene, and surface tokens remain complete.
3. A maintainer can add future palettes without duplicating variable binding
   boilerplate for every theme.

## Playback Questions

1. Do built-in theme names include editor-inspired dark and light options?
2. Does every built-in theme still expose the canonical variable names needed
   by existing token assertions?
3. Are the added palettes distinct enough that cycling themes is visually
   meaningful?
4. Does the implementation keep a single token application path?

## Requirements

- Add multiple built-in themes inspired by well-known editor themes.
- Keep existing `graphite` and `morning` themes and their order.
- Use the current `defineJeditTheme`/`applyThemeTokens` pipeline.
- Keep canonical variables: ink, muted, accent, info, warning, success, surface,
  surface.raised, and surface.muted.
- Do not add a separate theme runtime or ad hoc rendering branch.

## Acceptance Criteria

- RED tests fail because the new built-in theme names are missing.
- GREEN tests prove the added names exist, built-ins have unique names, each
  theme exposes canonical variables, and added surface palettes are distinct.
- `node --test spec/theme-switch.spec.mjs` passes.
- `npm run build` passes.
- `npm run test` passes.
- `npm run quality` passes.
- `git diff --check` passes.

## Accessibility / Assistive Reading Posture

The themes should preserve foreground/background pairs for workspace, drawer,
footer, source, markdown, title scene, and cursor tokens. Contrast auditing is
out of scope for this cycle but should be easier with more representative
palettes.

## Localization / Directionality Posture

Theme names are stable ASCII identifiers and do not affect localized content or
directional layout.

## Agent Inspectability / Explainability Posture

Palettes should be declared as data and then adapted once into the theme
builder. Future agents should inspect a small palette list rather than diffing
repeated token-assignment blocks.

## Implementation Outline

1. Add failing specs for the desired theme names and palette completeness.
2. Factor the existing theme variable construction into a palette adapter.
3. Add editor-inspired palettes through the existing token application path.
4. Record drift, playback, and retrospective in this design packet.

## Tests To Write First

- `built-in jedit themes include editor-inspired palettes`
- `built-in jedit themes keep unique complete palettes`

## Drift Check

RED drift matched the design: the existing theme switch spec could prove the
current two-theme system, but the requested editor-inspired names were absent.

Implementation drift is positive and contained:

- Existing `graphite` and `morning` themes were preserved in order.
- Theme construction now flows through a palette adapter before the existing
  `applyThemeTokens` function, reducing duplication without changing token
  semantics.
- The added palettes are inspiration-level jedit palettes rather than a new
  runtime theme format.

## Playback

Playback answers:

1. Built-ins now include `monokai`, `solarized-dark`, `solarized-light`,
   `dracula`, `nord`, and `catppuccin`.
2. Every built-in theme exposes the canonical variable names required by the
   existing token assertions.
3. Workspace surface backgrounds are unique across built-ins, so theme cycling
   has visible palette movement.
4. All palettes pass through `definePaletteTheme`, `paletteVariables`, and the
   existing `applyThemeTokens` path.

Validation:

- `node --test spec/theme-switch.spec.mjs` passed.
- `npm run build` passed.
- `npm run quality` passed with no regressions.
- `npm run test` passed 120 tests.
- `git diff --check` passed.

## Retrospective

The key cleanup was factoring variables into palette data before adding more
themes. That kept the feature from becoming a copy-paste block and creates a
natural place for the later generated light/dark companion-theme work.
