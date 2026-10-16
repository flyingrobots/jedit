# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Git pushes commits, not the working tree. pre-push therefore tests each
# pushed commit in its own temporary detached worktree: a real checkout of
# exactly that commit, with git's modes, symlinks, and filters, unaffected by
# anything staged, unstaged, or untracked in the developer's checkout, and
# whether or not the pushed branch is checked out.

# Prints each distinct commit named by the ref lines git gives pre-push on
# stdin. Deleting a remote ref pushes no content and prints nothing.
pushed_commits() {
  local local_ref local_oid remote_ref remote_oid
  while read -r local_ref local_oid remote_ref remote_oid; do
    if [[ ! "$local_oid" =~ ^0+$ ]]; then
      git rev-parse --verify "$local_oid^{commit}"
    fi
  done | awk '!seen[$0]++'
}

# Untracked dependencies and build caches the checkout borrows from the
# developer's checkout. Run from the developer checkout's top level.
link_checkout_dependencies() {
  local checkout="$1"
  ln -s "$PWD/node_modules" "$checkout/node_modules"
  if [[ -d "$checkout/native/jedit-echo-host" ]]; then
    mkdir -p "$PWD/native/jedit-echo-host/target"
    ln -s "$PWD/native/jedit-echo-host/target" "$checkout/native/jedit-echo-host/target"
  fi
}

# Deletes a temporary checkout, then unregisters exactly that worktree.
remove_checkout() {
  local checkout="$1"
  rm -rf "$checkout"
  git worktree remove "$checkout"
}
