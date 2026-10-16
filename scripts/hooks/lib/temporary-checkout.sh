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
# for that one command, so no configuration is written.
add_temporary_checkout() {
  local checkout="$1" commit="$2"
  git worktree add --quiet --no-checkout --detach "$checkout" "$commit"
  git -C "$checkout" -c core.sparseCheckout=false -c core.sparseCheckoutCone=false \
    reset --quiet --hard "$commit"
}

# Untracked dependencies. First the checkout's package.json and
# package-lock.json must agree, as `npm ci` in CI requires; `npm ci --dry-run`
# checks that without installing anything. node_modules is then borrowed only
# when the checkout's lockfile is byte-identical to the developer checkout's,
# since the lockfile names the installed tree; otherwise the checkout installs
# its own. The Rust build cache is always shared: cargo keys it by the
# checkout's own Cargo.lock and sources.
provide_checkout_dependencies() {
  local checkout="$1"
  if ! (cd "$checkout" && npm ci --dry-run --ignore-scripts --no-audit --no-fund >/dev/null); then
    echo "hooks: package.json and package-lock.json disagree in the commit being checked" >&2
    return 1
  fi
  if [[ -f "$checkout/package-lock.json" && -f package-lock.json ]] \
    && cmp -s "$checkout/package-lock.json" package-lock.json; then
    ln -s "$PWD/node_modules" "$checkout/node_modules"
  else
    echo "hooks: package-lock.json differs from this checkout's; installing dependencies"
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
