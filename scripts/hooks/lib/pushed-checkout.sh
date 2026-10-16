# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# The pre-push suite runs on the checkout, but git pushes commits. The suite
# only speaks for a pushed commit when the checkout is exactly that commit:
# HEAD is what every pushed ref points at, and nothing tracked, staged, or
# untracked differs from it. require_pushed_checkout reads the ref lines
# git gives pre-push on stdin and refuses the push otherwise. It prints how
# many refs need testing; deleting a remote ref pushes no content.

require_pushed_checkout() {
  local head local_ref local_oid remote_ref remote_oid commit dirty
  local tested=0
  head="$(git rev-parse --verify HEAD)"
  while read -r local_ref local_oid remote_ref remote_oid; do
    if [[ "$local_oid" =~ ^0+$ ]]; then
      continue
    fi
    commit="$(git rev-parse --verify --quiet "$local_oid^{commit}" || true)"
    if [[ "$commit" != "$head" ]]; then
      {
        echo "pre-push: $local_ref is not the checked-out commit."
        echo "The suite runs on the checkout, so check out $local_ref and push again."
      } >&2
      return 1
    fi
    tested=$((tested + 1))
  done
  if ((tested > 0)); then
    dirty="$(git status --porcelain --untracked-files=all)"
    if [[ -n "$dirty" ]]; then
      {
        echo "pre-push: the checkout differs from the commit being pushed:"
        sed 's/^/  /' <<<"$dirty"
        echo "The suite runs on the checkout, so commit or stash these, then push again."
      } >&2
      return 1
    fi
  fi
  echo "$tested"
}
