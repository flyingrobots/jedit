# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Both hooks validate a commit that is about to become authoritative, so they
# run their checks in a temporary detached worktree of exactly that commit.
# Git performs the checkout itself, with the commit's own file modes,
# symlinks, and .gitattributes, unaffected by anything staged, unstaged, or
# untracked in the developer's checkout.
#
# Run these from the developer checkout's top level, after enter_repository.

# Prints the absolute, symlink-free path of a new empty directory. A relative
# TMPDIR would otherwise name a different directory once the hook changes
# into the checkout, and cleanup would miss it.
make_checkout_directory() {
  local label="$1" directory
  directory="$(mktemp -d "${TMPDIR:-/tmp}/jedit-$label.XXXXXX")"
  (cd "$directory" && pwd -P)
}

# `git worktree add` copies the invoking worktree's sparse-checkout settings,
# which would leave tracked paths out of the checkout. Create the worktree
# without a checkout, then populate every path with sparse checkout disabled
# for that one command, so no configuration is written. Replacement objects
# (refs/replace) are ignored: a push sends the original objects, so the
# checkout must hold the original tree.
add_temporary_checkout() {
  local checkout="$1" commit="$2"
  git --no-replace-objects worktree add --quiet --no-checkout --detach "$checkout" "$commit"
  git --no-replace-objects -C "$checkout" \
    -c core.sparseCheckout=false -c core.sparseCheckoutCone=false \
    reset --quiet --hard "$commit"
}

# Untracked dependencies. Every checkout installs its own node_modules with
# `npm ci`, from the commit's own package.json and package-lock.json: it
# refuses a manifest that disagrees with its lockfile, as CI does, and it
# never trusts a developer's existing tree, whose provenance is unknown. From
# the npm cache this takes a few seconds. The Rust build cache is shared:
# cargo keys it by the checkout's own Cargo.lock and sources.
provide_checkout_dependencies() {
  local checkout="$1"
  if ! (cd "$checkout" && npm ci --prefer-offline --no-audit --no-fund >/dev/null); then
    echo "hooks: npm ci failed in the commit being checked (package.json and package-lock.json must agree)" >&2
    return 1
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
