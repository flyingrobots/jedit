# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Both hooks validate a commit that is about to become authoritative, so they
# run their checks in a temporary detached worktree of exactly that commit.
# Git performs the checkout itself, with the commit's own file modes,
# symlinks, and .gitattributes, unaffected by anything staged, unstaged, or
# untracked in the developer's checkout.
#
# Run these from the developer checkout's top level, after enter_repository.

add_temporary_checkout() {
  local checkout="$1" commit="$2"
  git worktree add --quiet --detach "$checkout" "$commit"
}

# Untracked dependencies. node_modules is borrowed only when the checkout's
# lockfile is byte-identical to the developer checkout's; otherwise the
# checkout installs the tree its own lockfile names. The Rust build cache is
# always shared: cargo keys it by the checkout's own Cargo.lock and sources.
provide_checkout_dependencies() {
  local checkout="$1"
  if [[ -f "$checkout/package-lock.json" && -f package-lock.json ]] \
    && cmp -s "$checkout/package-lock.json" package-lock.json; then
    ln -s "$PWD/node_modules" "$checkout/node_modules"
  else
    echo "hooks: lockfile differs from this checkout's; installing dependencies"
    (cd "$checkout" && npm ci --prefer-offline --no-audit --no-fund)
  fi
  if [[ -d "$checkout/native/jedit-echo-host" ]]; then
    mkdir -p native/jedit-echo-host/target
    ln -s "$PWD/native/jedit-echo-host/target" "$checkout/native/jedit-echo-host/target"
  fi
}

# Deletes a temporary checkout, then unregisters exactly that worktree.
remove_temporary_checkout() {
  local repository="$1" checkout="$2"
  rm -rf "$checkout"
  git -C "$repository" worktree remove "$checkout"
}
