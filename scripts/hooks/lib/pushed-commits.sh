# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Prints each distinct commit a pushed ref will point to, from the ref lines
# git gives pre-push on stdin. Deleting a remote ref pushes no content and
# prints nothing. Intermediate commits of a pushed range are not listed:
# pre-push tests what each ref will point to, not every commit it publishes.
pushed_commits() {
  local local_ref local_oid remote_ref remote_oid
  while read -r local_ref local_oid remote_ref remote_oid; do
    if [[ ! "$local_oid" =~ ^0+$ ]]; then
      git rev-parse --verify "$local_oid^{commit}"
    fi
  done | awk '!seen[$0]++'
}
