# shellcheck shell=bash
# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Prints each distinct commit a pushed ref will point to, from the ref lines
# git gives pre-push on stdin. Deleting a remote ref pushes no content and
# prints nothing. Intermediate commits of a pushed range are not listed:
# pre-push tests what each ref will point to, not every commit it publishes.
pushed_commits() {
  local local_oid
  while read -r _ local_oid _ _; do
    if [[ ! "$local_oid" =~ ^0+$ ]]; then
      git --no-replace-objects rev-parse --verify "$local_oid^{commit}"
    fi
  done | awk '!seen[$0]++'
}
