#!/usr/bin/env bash
# Install this repository's hooks for this clone and every linked worktree.
# Hook installation is local: merging the hooks does not install them for
# anyone.
#
# The installer writes launchers into the repository's own hooks directory
# (the common git directory's hooks/), which every worktree shares and which
# moves with the clone. It leaves core.hooksPath unset: a relative path
# would resolve inside each worktree, where a sparse checkout can omit
# scripts/hooks, and an absolute one breaks when the clone moves. It checks
# every configuration scope and every registered worktree before changing
# anything, refuses when a registered worktree is unavailable to check, and
# restores what it found if any later step fails or the result would not
# take effect.
#
# Each launcher decides from the commit or push itself, never from which
# files happen to be in the worktree: a hook the recorded tree or a pushed
# tip contains must run, and must be recorded as an executable file; a
# missing one is skipped only when that history never had it, which a
# shallow clone cannot show. A branch cannot bypass its hooks by deleting or
# unstaging them or by dropping their executable mode.
set -euo pipefail

marker="installed by jedit scripts/install-hooks.sh"
hooks="$(git rev-parse --path-format=absolute --git-common-dir)/hooks"

refuse() {
  echo "install-hooks: $1" >&2
  exit 1
}

# --- validate, changing nothing -------------------------------------------

legacy="$(git config --local --get core.hooksPath || true)"
case "$legacy" in
  "" | scripts/hooks | */jedit-hooks) ;;
  *) refuse "core.hooksPath is set to $legacy in this clone's config; remove it, then run this again." ;;
esac

# A registered worktree that is absent (a locked worktree on a disconnected
# drive, say) may carry its own core.hooksPath, which would resume bypassing
# the launchers when it returns, so it cannot be skipped.
worktrees=()
while IFS= read -r line; do
  if [[ "$line" == worktree\ * ]]; then
    worktree="${line#worktree }"
    if [[ ! -d "$worktree" ]]; then
      refuse "the registered worktree $worktree is unavailable, so its hook configuration cannot be checked; reconnect it, or remove it with 'git worktree remove' or 'git worktree prune', then run this again."
    fi
    worktrees+=("$worktree")
  fi
done < <(git worktree list --porcelain)

for worktree in "${worktrees[@]}"; do
  while IFS=$'\t' read -r scope value; do
    if [[ -n "$scope" && "$scope" != local ]]; then
      refuse "core.hooksPath = $value ($scope scope) applies to $worktree and would override the repository hooks directory; remove it, then run this again."
    fi
  done < <(git -C "$worktree" config --show-scope --get-all core.hooksPath || true)
done

# This script never installs a symbolic link, so any link in a hook slot,
# dangling or not, belongs to someone else; writing through it would replace
# its target.
mkdir -p "$hooks"
for name in pre-commit pre-push; do
  if [[ -L "$hooks/$name" ]]; then
    refuse "$hooks/$name is a symbolic link this script did not install; leaving it alone."
  fi
  if [[ -e "$hooks/$name" ]] && ! grep -qF "$marker" "$hooks/$name"; then
    refuse "$hooks/$name exists and was not installed by this script; leaving it alone."
  fi
done

# --- install, or put back what was there ------------------------------------

staged=()
legacy_unset=0
finish() {
  local status=$?
  if ((status != 0)); then
    if ((${#staged[@]})); then
      rm -f "${staged[@]}"
    fi
    if ((legacy_unset)); then
      git config --local core.hooksPath "$legacy"
      echo "install-hooks: restored core.hooksPath = $legacy." >&2
    fi
  fi
}
trap finish EXIT

# Write every launcher beside its slot first, so a failure here leaves the
# hooks directory and the configuration as they were.
for name in pre-commit pre-push; do
  launcher="$hooks/.$name.install.$$"
  staged+=("$launcher")
  cat > "$launcher" <<LAUNCHER
#!/usr/bin/env bash
# $marker.
LAUNCHER
  cat >> "$launcher" <<'LAUNCHER'
# Git runs hooks from the worktree's top level. This decides from the commit
# being recorded or the commits being pushed whether the tracked hook must
# run, then runs this worktree's copy of it.
set -euo pipefail
name="$(basename "$0")"
tracked="scripts/hooks/$name"
hook="$PWD/$tracked"

fail() {
  printf 'jedit hooks: %s\n' "$@" >&2
  exit 1
}

refuse() {
  fail "$1 $tracked." "Refusing to skip it. Restore $tracked, then try again."
}

# An entry for the hook must be exactly one executable file: a plain blob,
# a symlink, or a tree at that path cannot run from a fresh checkout.
executable_entry() {
  [[ "$1" == "100755 "* && "$1" != *$'\n'* ]]
}

# Whether any of the given revisions' full history has ever had the hook.
# --full-history keeps a merge from hiding a parent that had it.
had_hook() {
  [[ -n "$(git --no-replace-objects log --full-history -1 --format=%H "$@" -- "$tracked" 2>/dev/null)" ]]
}

# A shallow clone's history stops at its boundary, so finding no hook in it
# does not show that the full history never had one.
require_complete_history() {
  if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
    fail "this clone is shallow, so it cannot show whether $1 ever had $tracked." \
      "Refusing to skip it. Run 'git fetch --unshallow', then try again."
  fi
}

if [[ "$name" == pre-push ]]; then
  updates="$(cat)"
  required=0
  while read -r local_ref local_oid _ _; do
    if [[ -z "$local_oid" || "$local_oid" =~ ^0+$ ]]; then
      continue
    fi
    entry="$(git --no-replace-objects ls-tree "$local_oid" -- "$tracked")"
    if executable_entry "$entry"; then
      required=1
    elif [[ -n "$entry" ]]; then
      fail "$local_ref would publish $tracked without executable mode 100755." \
        "Run 'git update-index --chmod=+x $tracked', commit, then try again."
    elif had_hook "$local_oid"; then
      refuse "$local_ref would publish history that deleted"
    else
      require_complete_history "$local_ref"
    fi
  done <<<"$updates"
  if ((required)); then
    [[ -x "$hook" ]] || refuse "a pushed commit has $tracked, but this worktree is missing"
    exec "$hook" "$@" <<<"$updates"
  fi
else
  # The index git is about to record (GIT_INDEX_FILE during commit -a or
  # commit <paths>) decides; a pending merge's other parent counts as history.
  entry="$(git ls-files --stage -- "$tracked")"
  if executable_entry "$entry"; then
    [[ -x "$hook" ]] || refuse "this commit records $tracked, but this worktree is missing"
    exec "$hook" "$@"
  elif [[ -n "$entry" ]]; then
    fail "this commit would record $tracked without executable mode 100755." \
      "Run 'git update-index --chmod=+x $tracked', then try again."
  fi
  revisions=()
  for revision in HEAD MERGE_HEAD; do
    if git rev-parse --verify --quiet "$revision" >/dev/null; then
      revisions+=("$revision")
    fi
  done
  if ((${#revisions[@]})); then
    if had_hook "${revisions[@]}"; then
      refuse "this commit would drop"
    fi
    require_complete_history "this commit's history"
  fi
fi
echo "jedit hooks: this history never had $tracked; skipping it." >&2
LAUNCHER
  chmod +x "$launcher"
done

# Put the launchers in place before removing a legacy setting, so a failure
# at any point leaves the clone with working hooks.
for name in pre-commit pre-push; do
  mv -f "$hooks/.$name.install.$$" "$hooks/$name"
done
staged=()

if [[ -n "$legacy" ]]; then
  legacy_unset=1
  git config --local --unset-all core.hooksPath
fi

# --- verify -----------------------------------------------------------------

for worktree in "${worktrees[@]}"; do
  effective="$(git -C "$worktree" rev-parse --path-format=absolute --git-path hooks)"
  if [[ "$effective" != "$hooks" ]]; then
    refuse "git uses $effective for hooks in $worktree, not $hooks."
  fi
done

echo "hooks installed in $hooks"
