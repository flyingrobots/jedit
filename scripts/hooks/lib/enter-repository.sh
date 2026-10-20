# shellcheck shell=bash
# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Git exports repository-local variables (GIT_DIR, GIT_INDEX_FILE, and
# others) into hook processes. A tool the hook starts that asks git about
# the repository from another directory then gets the wrong answer: with
# GIT_DIR set, `git rev-parse --show-toplevel` reports the current
# directory. enter_repository moves to the checkout's top level, then
# clears exactly the variables git names as repository-local.

enter_repository() {
  local toplevel var
  toplevel="$(git rev-parse --show-toplevel)"
  cd "$toplevel" || return 1
  while IFS= read -r var; do
    if [[ -n "$var" ]]; then
      unset "$var"
    fi
  done < <(git rev-parse --local-env-vars)
}
