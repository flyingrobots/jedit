#!/usr/bin/env bash
set -euo pipefail

# Rebuild Echo's local WASM package, then run jedit's opt-in Stack Witness 0001
# real-transport proof.
#
# This is intentionally sibling-repo explicit. Default jedit tests must not
# depend on Echo build state, and the real witness remains opt-in through
# JEDIT_ECHO_WASM_MODULE.

ECHO_WARP_WASM_DIR="${ECHO_WARP_WASM_DIR:?set ECHO_WARP_WASM_DIR to echo/crates/warp-wasm}"
JEDIT_DIR="${JEDIT_DIR:-$(pwd)}"
ECHO_WASM_MODULE="${ECHO_WASM_MODULE:-${ECHO_WARP_WASM_DIR}/pkg/rmg_wasm.js}"

cd "${ECHO_WARP_WASM_DIR}"
wasm-pack build --target bundler --out-dir pkg --out-name rmg_wasm -- --features engine

cd "${JEDIT_DIR}"
JEDIT_ECHO_WASM_MODULE="${ECHO_WASM_MODULE}" \
  node --test spec/jedit-echo-wasm-stack-witness.spec.mjs
