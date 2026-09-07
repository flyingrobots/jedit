#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
application_root="$project_root/edict/replace-range"

exec node "$application_root/tests/package-chain.mjs"
