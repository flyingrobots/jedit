#!/usr/bin/env bash
set -euo pipefail

# Rebuild Echo's local WASM package, then run jedit's opt-in Stack Witness 0001
# real-transport proof.
#
# This is intentionally sibling-repo explicit. Default jedit tests must not
# depend on Echo build state, and the real witness remains opt-in through
# JEDIT_ECHO_WASM_MODULE.

ECHO_WARP_WASM_DIR="${ECHO_WARP_WASM_DIR:?set ECHO_WARP_WASM_DIR to echo/crates/warp-wasm}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_JEDIT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
JEDIT_DIR="${JEDIT_DIR:-${DEFAULT_JEDIT_DIR}}"
ECHO_WASM_MODULE="${ECHO_WASM_MODULE:-${ECHO_WARP_WASM_DIR}/pkg/rmg_wasm.js}"

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "error: wasm-pack is required to rebuild the Echo WASM package" >&2
  exit 127
fi

cd "${ECHO_WARP_WASM_DIR}"
wasm-pack build --target bundler --out-dir pkg --out-name rmg_wasm -- --features engine

cd "${JEDIT_DIR}"
JEDIT_ECHO_WASM_MODULE="${ECHO_WASM_MODULE}" \
  node --test spec/jedit-echo-wasm-stack-witness.spec.mjs
