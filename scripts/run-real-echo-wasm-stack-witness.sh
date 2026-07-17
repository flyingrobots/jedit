#!/usr/bin/env bash
set -euo pipefail

# Rebuild Echo's WASM package, then verify Jim can initialize and query that
# real kernel boundary without inventing an application operation protocol.

ECHO_WARP_WASM_DIR="${ECHO_WARP_WASM_DIR:?set ECHO_WARP_WASM_DIR to echo/crates/warp-wasm}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
JEDIT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ECHO_ROOT="$(cd -- "${ECHO_WARP_WASM_DIR}/../.." && pwd)"
ECHO_WASM_MODULE="${JEDIT_ECHO_WASM_MODULE:-${ECHO_WARP_WASM_DIR}/pkg/rmg_wasm.js}"

WARP_WASM_DIR="${ECHO_WARP_WASM_DIR}" "${ECHO_ROOT}/scripts/build-warp-wasm-package.sh"
npm --prefix "${JEDIT_ROOT}" run build
node "${SCRIPT_DIR}/jedit-echo-kernel-smoke.mjs" --module "${ECHO_WASM_MODULE}" "$@"
