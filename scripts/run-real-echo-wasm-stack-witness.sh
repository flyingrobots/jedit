#!/usr/bin/env bash
set -euo pipefail

# Ask Echo to rebuild its local WASM package, then run jedit's opt-in Stack
# Witness 0001 real-transport proof.

ECHO_WARP_WASM_DIR="${ECHO_WARP_WASM_DIR:?set ECHO_WARP_WASM_DIR to echo/crates/warp-wasm}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

node "${SCRIPT_DIR}/jedit-echo-witness.mjs" "$@"
