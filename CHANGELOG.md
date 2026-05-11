# Changelog

## Unreleased

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
