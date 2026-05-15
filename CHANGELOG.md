# Changelog

## Unreleased

- Ratcheted the quality gate to reject non-structural inline comparison
  literals in `src/app` and `src/domain`, with boundary-scope regression
  coverage and settings key actions moved to symbol-backed runtime tokens.
- Ratcheted the quality gate to reject runtime function bodies with more than
  25 top-level statements, with isolated regression coverage that does not
  overlap the function-length ratchet.
- Ratcheted the quality gate to reject runtime function nesting deeper than
  four levels, with deterministic regression coverage for over-nested control
  flow.
- Ratcheted the quality gate to reject hand-authored source lines above 160
  characters, with generated source exempted and current overlong readability
  debt split into human-scale declarations and helpers.
- Ratcheted the quality gate to reject runtime functions above 35 body lines
  and cyclomatic complexity above 8, with deterministic regression fixtures and
  targeted source splits to keep the current tree clean.
- Ratcheted the quality gate to reject raw `throw new Error`, non-`as const`
  type assertions, and runtime functions with more than five parameters, with
  regression fixtures for each rule.
- Ratcheted the quality gate to reject direct boolean parameters, anonymous
  public option bags, and runtime import fan-in above twelve imports per file.
- Split workspace key dispatch into focused reducers with structural regression
  coverage for import fan-in, parameter count, function length, nesting, and
  cyclomatic complexity, and serialized the test runner to prevent concurrent
  `dist` rebuild races.
- Preserved the backtick perf toggle while workspace overlays such as settings
  and the scene picker are open.
- Addressed the latest PR #8 CodeRabbit follow-up by adding typed codec and
  runtime-id errors, centralizing notification/profiler/workspace animation
  tokens, hardening scene-load failure conversion, and localizing footer
  context labels.
- Addressed the current PR #8 CodeRabbit follow-up by centralizing workspace
  runtime message and footer i18n tokens, making graft lifecycle timestamps
  deterministic through the runtime clock, preserving scene-load failure detail,
  and tightening the remaining review-standard docs and magic-number nits.
- Addressed the follow-up PR #8 review pass by splitting the oversized
  workspace keybinding spec, tightening runtime token objects, hardening
  read-only/editor lifecycle behavior, and adding deterministic regression
  coverage for profiler, graft, scene-loader, and mesh-footprint fixes.
- Addressed PR #8 review feedback for built-in scene resolution, editor mode
  transitions, contract runtime IDs, scene math, markdown detection, and
  reviewer-requested runtime constants.
- Fixed raytracer column math intersection which caused caps to be hollow when viewed from above or below.
- Added a new `.jedit-scene` file format for defining scenes and created a scene loader adapter.
- Added an interactive Scene Picker overlay to the title screen (toggleable via `F5`) for loading `.jedit-scene` debug scenes.
- Fixed naive RTL string reversal in footer that corrupted UI labels; now correctly utilizes Bijou surface blitting.
- Fortified the Bijou i18n adapter object traversal logic to enforce safe property access.
- Added the app-facing text buffer optic GraphQL contract so Wesley can compile
  product-safe `createBuffer`, `replaceRange`, and `textWindow` surfaces while
  tests reject runtime coordinate root nouns and id-shaped variants from the
  app SDL.
- Introduced the first `TextBufferOptic` capability wrapper: app-facing code can
  create a buffer, apply a `replaceRange` intent, and read a bounded text window
  through the optic while raw runtime coordinates remain below the optic/session
  boundary.
- Defined the first `ReadBasisHandle` boundary for optic/session bootstrap:
  transport-backed `textWindow` calls now accept an opaque read-basis handle
  while the adapter resolves the handle into existing runtime coordinates, and
  handle IDs are deterministic diagnostic tokens rather than buffer keys or
  substrate coordinates. The registry now rejects cloned/forged handles by
  object identity instead of trusting `id` replay.
- Hardened the real Echo WASM Stack Witness basis regression so it asserts the
  encoded request coordinate comes from the resolved read basis instead of
  inspecting request-construction source text.
- Moved the real Echo WASM Stack Witness fixture basis behind a witness-only
  optic session resolver so request construction no longer directly references
  Echo's raw fixture worldline id.
- Updated the real Echo WASM Stack Witness runner to delegate package
  construction to Echo's `scripts/build-warp-wasm-package.sh` instead of
  duplicating Echo's `wasm-pack` invocation in jedit.
- Added an opt-in real Echo WASM Stack Witness 0001 transport witness that
  proves `ReadingEnvelope + QueryBytes("hello")` can be consumed through the
  existing jedit transport boundary when `JEDIT_ECHO_WASM_MODULE` is set.
- Hardened the witness tooling so Wesley emission does not depend on a global
  CLI, the Echo WASM runner resolves sibling paths explicitly, and the real
  transport witness asserts Echo artifact identity before mapping test bytes.
- Added a Stack Witness 0001 jedit consumer spec that walks create, edit, and
  bounded text-window observation through the Echo-shaped transport port.
- Added a hot-text contract readiness spec that verifies the authored SDL and
  generated Wesley operation metadata stay aligned before the deferred Echo Rust
  binding cutover.
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
