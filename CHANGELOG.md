# Changelog

## Unreleased

- Established a GitHub Actions CI workflow to automatically run build, tests, and quality checks on every push and pull request.
- Fixed settings navigation on the title screen by routing settings keys before
  title camera controls.
- Improved settings interaction by accepting both the literal space character
  and the canonical 'space' key string for activating rows.
- Documented the `JEDIT_WESLEY_ROOT` checkout requirement for contract codegen
  and added a regression test that keeps the README example executable.
- Added explicit runtime decoders for Graft MCP outline and structural diff
  payloads so malformed tool results fail at the adapter boundary.
- Copied the title bunny OBJ asset during `npm run build` and made startup mesh
  loading return structured failures instead of silently swallowing asset errors.
- Bounded title-logo spring evaluation to a short settling window so repeated
  frame renders no longer replay full animation cycles per letter.
- Replaced title-screen camera/seed positional arguments with explicit render
  options so regression tests pin deterministic scene seeds independently of
  camera angle.
- Stabilized title-screen checkerboard floor contrast across built-in dark and
  light themes by deriving explicit floor dark/light material roles before
  lighting and reflections.
- Added geometry-based title-screen floor shadows and subtle caustic-style
  highlights inside the shader material path.
- Rendered the title logo as a smaller lower-screen solid/hatch glyph overlay
  instead of mixing it into the Braille raytrace shader.
- Added Bijou spring-driven title-screen camera controls so arrow-key orbit and
  zoom changes ease smoothly instead of stepping instantly.
- Added Monokai-, Solarized-, Dracula-, Nord-, and Catppuccin-inspired built-in
  jedit themes through the shared theme builder pipeline.
- Added light/dark theme companion metadata, generated opposite-mode fallback
  themes, authored Solarized companion overrides, and a settings row for
  toggling the current theme mode.
- Added deterministic seeded title-scene generation with randomized initial
  camera placement, mixed sphere/column geometry, varied materials, and
  non-overlapping object footprints.
- Fixed a settings-screen crash caused by starting the Bijou runtime before
  settings handlers were initialized, corrected the Markdown preview footer to
  use `f3` as a source/preview toggle, and added duplicate keybinding checks.
- Bounded title-camera spring updates with a fixed timestep so slow terminal
  frames cannot make arrow-key camera motion explode.
