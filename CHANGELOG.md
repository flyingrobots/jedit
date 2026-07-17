# Changelog

## Unreleased

- Made the range-why fact budget constrain actual graph work. Narrow windows now
  traverse only the overlapping root-to-leaf region plus the UTF-8 boundary
  byte, branch and blob reads count toward `inspectedFactCount`, and checkpoint
  and anchor indexes return deterministic bounded slices instead of cloning and
  sorting their complete contents during an observation.
- Aligned range-why historical-text bounds across the codec and domain. A zero
  byte budget is now valid while CR-06 traverses provenance facts without
  materializing historical text; future deleted-text readers must debit that
  budget before returning historical bytes.
- Preserved typed graph-rope observation obstructions across the installed
  transport boundary, so range evidence limits and other text-authority
  refusals reach clients as their original stable codes instead of collapsing
  into a generic query-runtime error.
- Connected causal gutter and footer explanations to the same structured,
  basis-pinned range report used by `:why`. Applied gutter readings expose
  report-backed rewrite/diff/tick evidence only when every identity is also
  supported by the causal marker; stale or mismatched reports contribute no
  explanation. While the panel is active, the lower-right posture cites exact
  head, tick, optional anchor, and coverage evidence, omits unsupported claims,
  and localizes its labels across every installed locale.
- Added range-origin witnesses for untouched imports, retained rewrites,
  checkpointed heads, and unsupported generated-text attribution. Rewrite
  reports now expose a typed producer-evidence obstruction instead of treating
  the transitional `author` field as causal proof. Ordinary Jim checkpoint
  declarations no longer request Echo anchors implicitly; explicit anchoring
  remains a separate operation that fails closed without an injected Echo
  admission capability.
- Replaced prose-only range explanations with a persistent, cursor-anchored
  causal evidence panel. The panel derives bounded detail rows from the same
  machine-readable range report, preserves opaque head/leaf/blob/rewrite/diff/
  receipt/checkpoint identities, wraps long identifiers, renders below the
  source line or above when space is exhausted, and closes when the cursor,
  active buffer, admitted head, focus owner, or `Esc` invalidates its basis.
- Added the bounded, basis-pinned `whyRange` query to the generated hot-text
  contract and installed Echo transport. Graph-rope observations now return
  ordered head/leaf/blob fragments with actual imported or rewrite origins,
  distinct rewrite/diff/text-tick receipt identities, checkpoint declarations,
  and optional anchor associations. Product `explainRange` no longer reverse
  walks local `TickMetadata` or aliases one identifier as another; unsupported
  authorities, invalid bases, and exceeded evidence bounds fail closed.
- Designed the CR-06 runtime-backed range-why contract and rope fact inspector.
  One bounded, basis-pinned observation will supply the human panel, developer
  inspector, gutter/footer explainers, and machine output with fragmented
  head/leaf/blob/rewrite/diff/text-tick/checkpoint evidence. Checkpoint
  declarations remain separate from optional Echo anchor associations, stale
  evidence fails closed, and standalone token-driven mockups cover wide,
  narrow, and extra-small terminal profiles.
- Added receipt-backed gutter execution posture. Applied `+`, `~`, and `-`
  markers now require retained graph-rope tick-receipt support; `?` identifies
  an app proposal that has not become causal history, and `!` identifies an
  obstructed proposal without fabricating Echo identity. The bounded causal
  line-diff reading is now version 4 and exposes opaque tick-receipt fact IDs at
  reading, line-marker, and deletion-marker scope. Optimistic projections hide
  stale admitted line coordinates until a basis-matched reading is available.
- Added dedicated normal and dimmed causal-gutter theme tokens for background,
  ordinary/current line numbers, rule, inserted, modified, deleted, pending,
  and obstructed roles.
  Every token now carries the named `surface` background, built-in light and
  dark themes witness at least 3:1 contrast with a named `ink` fallback, and
  source rendering no longer borrows syntax tokens or exposes terminal-default
  backgrounds. A `Dim gutter` setting selects the dimmed token set and reports
  the old and new value through the standard settings toast.
- Added a causal gutter comparison-basis setting with `Last save`, `Import`,
  `Selected checkpoint`, and `Selected tick` choices. Selected history evidence
  keeps Echo-returned head, tick, checkpoint, and receipt identities opaque;
  missing evidence fails closed. Changing the setting refreshes only a bounded,
  disposable causal-line reading, and stale results cannot apply after the
  active buffer, admitted head, or selected comparison head changes.
- Added an explicit workspace buffer durability model that keeps pending Jim
  intents, Echo-admitted rope heads, saved-file projection bases, local Git
  commits, and remote Git durability independent. Queuing an edit no longer
  advances the durability model's causal head, admitted edits do not silently
  move its saved-file basis, and a checkpoint declaration is associated with a
  saved projection only when both name the same opaque rope head. Git posture
  remains explicitly unknown until supplied by an external Git observer.
- Derived authoritative file dirtiness from the current Echo-admitted rope head
  and the last successful host projection basis. Pending or obstructed intents
  no longer counterfeit an admitted change, checkpoint declarations no longer
  clear unsaved edits, and only a successful export of the current head moves
  the file basis back to clean. Missing-file opens now require an explicit
  host-absence basis instead of inferring causal evidence from a legacy boolean.
- Reworked the lower-right footer posture around the five durability layers:
  pending intent, admitted causal head, saved/exported file basis, local Git,
  and remote Git. Cursor `line:col` remains separate UI state, Git readings stay
  unknown until externally observed, and oversized status claims are omitted
  whole instead of being clipped into misleading fragments on narrow terminals.
- Added versioned text-window materialization provenance and a bounded,
  disposable cache. Cache coordinates now name the requested rope head, exact
  branded UTF-8 coverage, request namespace, observer plan, materializer
  version, and policy. Stale or unsupported entries fail closed, materialized
  projection bytes are metered separately from retained authoritative bytes,
  and cache eviction cannot mutate rope history. Local cache digests and
  request-frontier labels are explicitly acceleration metadata, not Echo
  identities or admitted frontier evidence.
- Separated authoritative rope line-count summaries from disposable line-offset
  indexes. Text-window observers now rebuild versioned indexes from complete,
  basis-pinned UTF-8 head coverage, isolate equal head labels across
  worldlines, preserve Unicode and CRLF byte boundaries, reuse indexes for
  bounded reads, and evict mismatched projections without changing history or
  `:why` evidence.
- Required every product text-window materialization to name an opaque rope
  head and branded UTF-8 byte range. Historical windows now resolve retained
  head authority rather than current session state, and generated readings use
  a minimal immutable text-basis record instead of fabricating complete
  `RopeHead` metadata from bounded bytes.
- Added explicit UTF-8 byte, UTF-16 code-unit, and zero-based line-column
  coordinate adapters for graph-backed text. Coordinate conversion now rejects
  split surrogate pairs, split UTF-8 sequences, CRLF-interior positions, and
  out-of-bounds coordinates; workspace edit plans preserve branded byte
  offsets until the transitional text-session serialization boundary.
- Quarantined retained full-root text authority behind an allowlisted guard
  witness: the only permitted `HotTextBufferState.roots` readers are the type
  definition, the production-unsafe full-snapshot fixture, root-fact evidence
  emission, and the transport schema. The witness flags `state.roots` access
  directly and any roots binding in files that name the retained-root types,
  independent of binding shape; it is a source-pattern tripwire, not a type
  checker.
- Added a dist/source parity witness so stale compiled artifacts for deleted
  sources cannot mask missing imports in dist-driven specs, cycle proofs, or
  release gates; the RED run caught and removed two real orphaned artifacts.
- Named undo and redo in command provenance and settlement evidence: `u` and
  `ctrl+r` now produce `history`-family command events (so `:why` and the
  footer explain reversals), edit settlements carry additive
  `provenanceKind` and `reversedReceiptId` fields referencing the reversed
  edit's settlement receipt, and the WSC history listing exposes them to
  agent-facing JSON surfaces. History events keep their `history:` event
  identity and refresh their receipt summary at settlement, and Shift+U is
  never classified as the undo key. Reversal correlation follows request
  identity through the undo/redo stacks and resolves to admitted receipts in
  the serialized operation sequencer, including edits still unsettled when a
  history command is queued.
  The sequencer's receipt index is an acceleration structure, not retained
  evidence: after resolving a queued reversal, it prunes request receipts that
  are no longer reachable from the editor's undo or redo history.

- Added WF-0154, the E-Brake goalpost (issue #267), locking in four audit
  remediations: undo/redo settlements named as reversals in provenance (the
  mechanism already submits Echo replacement edits), a title-scene freeze
  guard, chain-threaded root-id allocation replacing the process-global
  counter, and an executable doc-path witness with an `ADVANCED_GUIDE.md`
  rewrite. Corrected the stale BEARING claim that production undo/redo is
  unsupported.
- Added a generic projection review payload viewer so jedit can display bounded
  provider-owned review payloads for Edict Core and Echo Target IR projection
  lanes without interpreting, validating, lowering, executing, canonicalizing,
  or assigning semantic meaning to those payloads.
- Added a generic Graft projection-lane panel so jedit can render
  provider-neutral projection state, digest, metadata, and bounded summaries
  while preserving the current Edict Core and Echo Target IR display and
  avoiding runtime, debugger, REPL, execution, or admission claims.
- Updated the Graft dependency to 0.11.1 and added a display-only Edict
  projection lens for dirty `.edict` buffers. The Graft drawer can now show
  upstream Edict Core and Echo Target IR projection state, domains, targets,
  and digests without jedit compiling Edict, executing Echo, or admitting Jim
  artifacts.
- Added a display-only obstruction receipt lane to the Graft drawer so upstream
  Edict/Echo projection receipt facts can show outcome kind, Target IR digest,
  reason kind, and reason payload without jedit executing Echo, admitting Jim
  artifacts, rendering a receipt digest, or interpreting obstruction semantics.
- Added WF-0121 for Strand/Braid Worldline UX, locking in copy-on-write
  strands, braid preview/admission, TTD observer commands, and agent-isolated
  proposal strands as the product lane after the current trust/provenance work.
- Updated the Graft dependency to 0.10.1 so the default Colorful prose
  projection path accepts real `colorful 0.2.1` numeric IR identifiers.
- Updated the Graft source-highlighter adapter to consume Graft 0.10.0, warm the
  real parser runtime before default projections, and map Colorful prose spans
  for `.txt` buffers when `colorful >= 0.2.1` is available on `PATH`.
- Pinned the Jim causal product roadmap around the
  `explain -> preview -> admit -> recover` loop; added WF-0108 for Jim Command
  Provenance And `:why` and moved release planning off the active roadmap.
- Stabilized Vim repeat-search match identity so `n` and `N` preserve the same
  `matchId` for the same physical match while exposing traversal direction as a
  separate fact.
- Added `VimSearchDirections` as the runtime truth for Vim repeat-search
  direction values used by editor state and search motion resolution.
- Added runtime paragraph-motion tokens and rejection for invalid paragraph
  motion names instead of silently treating them as backward paragraph motions.
- Routed Vim motion resolution through runtime strategy tags so structural,
  search, paragraph, section, primitive, target-shape, and range-policy behavior
  are normalized once at the resolver boundary.
- Added the next Jim/Vim power-move runtime batch: transformed dot-repeat
  metadata, `gu`/`gU`/`g~` case operators, `J`/`gJ` line joins, local marks
  with exact and line jumps, and `:q!`/`:quit!` forced quit commands.
- Fixed the idle title-scene performance governor so slow ray-traced frames
  stay in low-rate cached rendering until the refresh window expires instead
  of bouncing between slow traced frames and fast cached frames.
- Added FPS-style title-screen camera controls: `w` and `s` move along the
  camera view vector, `a` and `d` strafe, mouse movement rotates the look
  vector, Space jumps, and Shift crouches with slower movement.
- Restored and populated the default bunny title scene's surrounding authored
  geometry with varied spheres and boxes, a raised camera, mixed materials, and
  wall-clock day/night lighting.
- Stopped the startup file selector from auto-opening or reopening from the
  title screen so it cannot steal Vim command-completion Tab or Enter keys.
- Added live invalid-command footer feedback while typing unknown Vim command
  fragments such as `:exi`.
- Retired the retained startup file drawer's duplicate type-to-search input so
  command mode is the only type-to-open surface.
- Added localized command-mode footer hints and catalog-backed Vim command
  completion copy.
- Documented the completed Vim command-line completion surface in the technical
  teardown, design retrospective, and docs-release closeout witness.
- Added an unavailable-preview lower mode for Graft-backed editor completions
  so adapter failures can render honestly through the shared popup.
- Added render witnesses for editor completion documentation, source-definition,
  and causal-history preview kinds.
- Added a Graft outline-backed editor symbol completion provider witness that
  renders through the shared inline completion popup.
- Added an editor-context completion registry seam that can return the same
  provider-neutral inline completion items used by Vim command completions.
- Highlighted invalid Vim command-line input in the footer and added a
  localized help message for unrecognized commands.
- Added a title ray allocation facts contract for the zero-allocation title
  rendering roadmap.
- Added honest title-scene profile allocation witness facts for deterministic
  Braille bunny workloads, including retained-heap lower-mode evidence.
- Rendered the startup file selector rows through Bijou's browsable list
  surface, added themed scrollbar affordance for overflowing directories, and
  made Escape dismissal recoverable from the title screen with Enter or `o`.
- Fixed the title intro timeline so `FLYINGROBOTS PRESENTS` fades before the
  `jedit` logo, the `jedit` logo fades before the startup file browser appears,
  and the modal still opens at the 7 second boundary.
- Split the CI contract shard into `contract-api` and `cycle-proofs`, and added
  a Bijou-only package dependency fast path that runs `contract-api`,
  `echo-authority`, `title-rendering`, `workspace-ui`, and the Echo release gate
  instead of the full shard set.
- Restored generated structural-history descriptor sources into CI shard jobs
  so `cycle-proofs` can typecheck source contracts from the shared build
  artifact.
- Fixed Echo-hosted normal-mode undo and redo so `u` and `Ctrl-R` submit
  production text replacement edits through Echo instead of emitting an
  unsupported runtime-error toast.
- Fixed Echo-hosted production text save so `Ctrl-S` requests a full-buffer
  export aperture before writing a file, preventing bounded viewport readings
  from truncating long files on disk.
- Preserved jedit contract root history in the Echo-facing runtime state so
  tick and checkpoint facts do not reference roots without corresponding root
  facts.
- Updated architecture and user-facing documentation to describe the
  structural-history GraphQL authority slice, build-generated Wesley metadata,
  and the current fake-versus-real Echo witness posture.
- Routed the current replace/tick in-memory adapter boundary through generated
  structural-history `replaceTextRange` Wesley operation metadata while leaving
  the transitional TypeScript runtime executor unchanged. The metadata is now
  generated during build/test from `wesley-cli` 0.0.4 instead of being checked
  in as source.
- Added the canonical structural-history GraphQL schema for text revisions,
  admitted replace events, edit groups, checkpoints, provenance, command
  status, and evidence-bearing readings, plus readiness coverage and an
  authority note that keeps the in-memory TypeScript model transitional.
- Fixed docs file-size witness line counting so a trailing LF or CRLF does not
  add a phantom line.
- Documented and named the quality-gate catch-depth convention: catch bodies
  continue the surrounding `try` nesting level rather than adding a new level.
- Fixed `max-statements-25` accounting so nested executable statements count
  toward the function statement limit instead of only top-level body entries.
- Split quality-gate ratchet fixtures into a dedicated spec file so the legacy
  gate spec stays within the 500-line file-size doctrine.
- Split quality-gate syntax counting into a dedicated module so the executable
  gate stays within the 500-line file-size doctrine.
- Fixed nesting-depth accounting so `catch` clauses share the surrounding
  `try` control level instead of adding a false extra nesting level.
- Ratcheted the quality gate to reject non-structural inline comparison and
  switch-case literals in `src/app` and `src/domain`, with boundary-scope regression
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
