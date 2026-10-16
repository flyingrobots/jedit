#!/usr/bin/env bash
# Point this clone, and every linked worktree that shares its config, at the
# repository's hooks. core.hooksPath is local configuration: merging the hooks
# does not install them for anyone.
set -euo pipefail

git config --local core.hooksPath scripts/hooks
echo "core.hooksPath = $(git config --local core.hooksPath)"
