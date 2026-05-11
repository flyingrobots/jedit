#!/usr/bin/env bash
set -euo pipefail

# Ask Echo to rebuild its local WASM package, then run jedit's opt-in Stack
# Witness 0001 real-transport proof.
#
# This is intentionally sibling-repo explicit. Default jedit tests must not
# depend on Echo build state, and the real witness remains opt-in through
# JEDIT_ECHO_WASM_MODULE.

ECHO_WARP_WASM_DIR="${ECHO_WARP_WASM_DIR:?set ECHO_WARP_WASM_DIR to echo/crates/warp-wasm}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_JEDIT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
JEDIT_DIR="${JEDIT_DIR:-${DEFAULT_JEDIT_DIR}}"
ECHO_WASM_MODULE="${ECHO_WASM_MODULE:-${ECHO_WARP_WASM_DIR}/pkg/rmg_wasm.js}"
ECHO_REPO_ROOT="$(cd "${ECHO_WARP_WASM_DIR}/../.." && pwd)"
ECHO_WASM_BUILD_SCRIPT="${ECHO_WASM_BUILD_SCRIPT:-${ECHO_REPO_ROOT}/scripts/build-warp-wasm-package.sh}"

if [[ ! -x "${ECHO_WASM_BUILD_SCRIPT}" ]]; then
  echo "error: Echo WASM build script is missing or not executable: ${ECHO_WASM_BUILD_SCRIPT}" >&2
  exit 127
fi

WARP_WASM_DIR="${ECHO_WARP_WASM_DIR}" "${ECHO_WASM_BUILD_SCRIPT}"

cd "${JEDIT_DIR}"
npm run build

JEDIT_ECHO_WASM_MODULE="${ECHO_WASM_MODULE}" \
  node --test spec/jedit-echo-wasm-stack-witness.spec.mjs
