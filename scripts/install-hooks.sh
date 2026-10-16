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
# every configuration scope and every linked worktree before changing
# anything, and restores what it found if the result would not take effect.
#
# Each launcher decides from the commit or push itself, never from which
# files happen to be in the worktree: a hook the recorded tree or a pushed
# tip contains must run, and a missing one is skipped only when that history
# never had it, so a branch cannot bypass its hooks by deleting or unstaging
# them.
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

worktrees=()
while IFS= read -r line; do
  if [[ "$line" == worktree\ * && -d "${line#worktree }" ]]; then
    worktrees+=("${line#worktree }")
  fi
done < <(git worktree list --porcelain)

for worktree in "${worktrees[@]}"; do
  while IFS=$'\t' read -r scope value; do
    if [[ -n "$scope" && "$scope" != local ]]; then
      refuse "core.hooksPath = $value ($scope scope) applies to $worktree and would override the repository hooks directory; remove it, then run this again."
    fi
  done < <(git -C "$worktree" config --show-scope --get-all core.hooksPath || true)
done

mkdir -p "$hooks"
for name in pre-commit pre-push; do
  if [[ -e "$hooks/$name" ]] && ! grep -qF "$marker" "$hooks/$name"; then
    refuse "$hooks/$name exists and was not installed by this script; leaving it alone."
  fi
done

# --- install ----------------------------------------------------------------

if [[ -n "$legacy" ]]; then
  git config --local --unset-all core.hooksPath
fi

for name in pre-commit pre-push; do
  cat > "$hooks/$name" <<LAUNCHER
#!/usr/bin/env bash
# $marker.
LAUNCHER
  cat >> "$hooks/$name" <<'LAUNCHER'
# Git runs hooks from the worktree's top level. This decides from the commit
# being recorded or the commits being pushed whether the tracked hook must
# run, then runs this worktree's copy of it.
set -euo pipefail
name="$(basename "$0")"
tracked="scripts/hooks/$name"
hook="$PWD/$tracked"

# Whether any of the given revisions' full history has ever had the hook.
# --full-history keeps a merge from hiding a parent that had it.
had_hook() {
  [[ -n "$(git --no-replace-objects log --full-history -1 --format=%H "$@" -- "$tracked" 2>/dev/null)" ]]
}

refuse() {
  echo "jedit hooks: $1 $tracked." >&2
  echo "Refusing to skip it. Restore $tracked, then try again." >&2
  exit 1
}

if [[ "$name" == pre-push ]]; then
  updates="$(cat)"
  required=0
  while read -r local_ref local_oid remote_ref remote_oid; do
    if [[ -z "$local_oid" || "$local_oid" =~ ^0+$ ]]; then
      continue
    fi
    if git --no-replace-objects cat-file -e "$local_oid:$tracked" 2>/dev/null; then
      required=1
    elif had_hook "$local_oid"; then
      refuse "$local_ref would publish history that deleted"
    fi
  done <<<"$updates"
  if ((required)); then
    [[ -x "$hook" ]] || refuse "a pushed commit has $tracked, but this worktree is missing"
    exec "$hook" "$@" <<<"$updates"
  fi
else
  # The index git is about to record (GIT_INDEX_FILE during commit -a or
  # commit <paths>) decides; a pending merge's other parent counts as history.
  if git ls-files --error-unmatch -- "$tracked" >/dev/null 2>&1; then
    [[ -x "$hook" ]] || refuse "this commit records $tracked, but this worktree is missing"
    exec "$hook" "$@"
  fi
  revisions=()
  for revision in HEAD MERGE_HEAD; do
    if git rev-parse --verify --quiet "$revision" >/dev/null; then
      revisions+=("$revision")
    fi
  done
  if ((${#revisions[@]})) && had_hook "${revisions[@]}"; then
    refuse "this commit would drop"
  fi
fi
echo "jedit hooks: this history never had $tracked; skipping it." >&2
LAUNCHER
  chmod +x "$hooks/$name"
done

# --- verify, or put back what was there -------------------------------------

for worktree in "${worktrees[@]}"; do
  effective="$(git -C "$worktree" rev-parse --path-format=absolute --git-path hooks)"
  if [[ "$effective" != "$hooks" ]]; then
    if [[ -n "$legacy" ]]; then
      git config --local core.hooksPath "$legacy"
    fi
    refuse "git uses $effective for hooks in $worktree, not $hooks; restored the previous setting."
  fi
done

echo "hooks installed in $hooks"
